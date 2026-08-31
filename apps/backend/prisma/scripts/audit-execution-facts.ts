import "dotenv/config";

import type { PrismaClient } from "../../generated/prisma/client";
import { createLocalPrisma } from "../../src/lib/prisma-local";

type Repair = {
	entity: string;
	id: string;
	fromBudgetItemId: string;
	toBudgetItemId: string;
	index: string;
};

type WorkAudit = {
	workId: string;
	activeImportId: string | null;
	activeItems: number;
	issues: string[];
	repairs: Repair[];
};

/**
 * Audits execution links against the active budget import. With --apply it
 * only repairs a stale link when exactly one active item has the same index.
 * Ambiguous and missing links are reported and never mutated.
 */
export async function auditExecutionFacts(
	prisma: PrismaClient,
	apply = false,
): Promise<WorkAudit[]> {
	const works = await prisma.constructionWork.findMany({
		select: { id: true, activeImportId: true },
		orderBy: { id: "asc" },
	});
	const result: WorkAudit[] = [];

	for (const work of works) {
		const fallbackImport = work.activeImportId
			? null
			: await prisma.constructionImport.findFirst({
					where: { workId: work.id },
					orderBy: { createdAt: "desc" },
					select: { id: true },
				});
		const effectiveImportId = work.activeImportId ?? fallbackImport?.id ?? null;
		const activeItems = effectiveImportId
			? await prisma.constructionBudgetItem.findMany({
					where: { workId: work.id, importId: effectiveImportId },
					select: { id: true, index: true },
				})
			: [];
		const byIndex = new Map<string, typeof activeItems>();
		for (const item of activeItems) {
			const list = byIndex.get(item.index) ?? [];
			list.push(item);
			byIndex.set(item.index, list);
		}
		const issues: string[] = [];
		const repairs: Repair[] = [];
		const writes: Promise<unknown>[] = [];

		const [
			measurements,
			baselines,
			revisions,
			workItems,
			costs,
			contractServices,
		] = await Promise.all([
			prisma.constructionMeasurement.findMany({
				where: { workId: work.id },
				include: { budgetItem: { select: { id: true, index: true } } },
			}),
			prisma.constructionBaselineSchedule.findMany({
				where: { workId: work.id },
				include: { budgetItem: { select: { id: true, index: true } } },
			}),
			prisma.constructionScheduleRevision.findMany({
				where: { workId: work.id },
				include: { budgetItem: { select: { id: true, index: true } } },
			}),
			prisma.workMeasurementItem.findMany({
				where: { measurement: { workId: work.id } },
				include: { budgetItem: { select: { id: true, index: true } } },
			}),
			prisma.constructionActualCost.findMany({
				where: { workId: work.id },
				include: { budgetItem: { select: { id: true, index: true } } },
			}),
			prisma.contractService.findMany({
				where: { contract: { workId: work.id } },
				include: { budgetItem: { select: { id: true, index: true } } },
			}),
		]);

		const inspect = (
			entity: string,
			rows: Array<{
				id: string;
				budgetItemId?: string | null;
				index?: string | null;
				budgetItem?: { id: string; index: string } | null;
				budgetIndex?: string | null;
			}>,
		) => {
			for (const row of rows) {
				const linked = row.budgetItem;
				if (linked && activeItems.some((item) => item.id === linked.id))
					continue;
				const index = row.index ?? row.budgetIndex ?? linked?.index ?? null;
				if (!index) {
					issues.push(`${entity}:${row.id}:MISSING_INDEX`);
					continue;
				}
				const candidates = byIndex.get(index) ?? [];
				if (candidates.length !== 1) {
					issues.push(
						`${entity}:${row.id}:${candidates.length === 0 ? "ORPHAN" : "AMBIGUOUS"}:${index}`,
					);
					continue;
				}
				const repair = {
					entity,
					id: row.id,
					fromBudgetItemId: row.budgetItemId ?? linked?.id ?? "",
					toBudgetItemId: candidates[0].id,
					index,
				};
				repairs.push(repair);
				if (apply && row.budgetItemId !== candidates[0].id) {
					if (entity === "constructionMeasurement") {
						writes.push(
							prisma.constructionMeasurement.update({
								where: { id: row.id },
								data: {
									budgetItemId: candidates[0].id,
									...(effectiveImportId ? { importId: effectiveImportId } : {}),
								},
							}),
						);
					} else if (entity === "constructionBaselineSchedule") {
						writes.push(
							prisma.constructionBaselineSchedule.update({
								where: { id: row.id },
								data: {
									budgetItemId: candidates[0].id,
									...(effectiveImportId ? { importId: effectiveImportId } : {}),
								},
							}),
						);
					} else if (entity === "constructionScheduleRevision") {
						writes.push(
							prisma.constructionScheduleRevision.update({
								where: { id: row.id },
								data: {
									budgetItemId: candidates[0].id,
									...(effectiveImportId ? { importId: effectiveImportId } : {}),
								},
							}),
						);
					} else if (entity === "workMeasurementItem") {
						writes.push(
							prisma.workMeasurementItem.update({
								where: { id: row.id },
								data: { budgetItemId: candidates[0].id },
							}),
						);
					} else if (entity === "contractService") {
						writes.push(
							prisma.contractService.update({
								where: { id: row.id },
								data: { budgetItemId: candidates[0].id },
							}),
						);
					} else {
						writes.push(
							prisma.constructionActualCost.update({
								where: { id: row.id },
								data: { budgetItemId: candidates[0].id },
							}),
						);
					}
				}
			}
		};

		inspect("constructionMeasurement", measurements);
		inspect("constructionBaselineSchedule", baselines);
		inspect("constructionScheduleRevision", revisions);
		inspect("workMeasurementItem", workItems);
		inspect("constructionActualCost", costs);
		inspect("contractService", contractServices);
		if (apply && writes.length > 0) await Promise.all(writes);
		result.push({
			workId: work.id,
			activeImportId: effectiveImportId,
			activeItems: activeItems.length,
			issues: [...new Set(issues)],
			repairs,
		});
	}
	return result;
}

async function main() {
	const prisma = createLocalPrisma();
	try {
		const apply = process.argv.includes("--apply");
		const rows = await auditExecutionFacts(prisma, apply);
		console.log(
			JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", rows }, null, 2),
		);
	} finally {
		await prisma.$disconnect();
	}
}

if (import.meta.main) void main();
