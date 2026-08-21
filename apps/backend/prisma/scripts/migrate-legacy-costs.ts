import { prisma } from "../../src/lib/prisma";
import {
	type CostMigrationCandidate,
	planLegacyCostMigration,
} from "../../src/modules/construction-planning/cost-migration";

const apply = process.argv.includes("--apply");
const ownerFilter = process.argv
	.find((arg) => arg.startsWith("--owner="))
	?.slice(8);
const workFilter = process.argv
	.find((arg) => arg.startsWith("--work="))
	?.slice(7);

const sources = await prisma.constructionActualCost.findMany({
	where: {
		...(ownerFilter ? { ownerId: ownerFilter } : {}),
		...(workFilter ? { workId: workFilter } : {}),
		budgetVersionItemId: null,
		allocations: { some: {} },
		migrationSources: { none: {} },
	},
	include: { allocations: true },
	orderBy: { id: "asc" },
});

const result: Array<Record<string, unknown>> = [];
for (const source of sources) {
	const activeItems = await prisma.budgetVersionItem.findMany({
		where: {
			version: {
				workId: source.workId,
				ownerId: source.ownerId,
				isActive: true,
			},
		},
		select: { id: true, identityId: true },
		orderBy: { index: "asc" },
	});
	const candidates = new Map<string, readonly CostMigrationCandidate[]>();
	for (const allocation of source.allocations) {
		const legacy = await prisma.constructionBudgetItem.findUnique({
			where: { id: allocation.budgetItemId },
			select: { identityId: true },
		});
		candidates.set(
			allocation.budgetItemId,
			legacy?.identityId
				? activeItems
						.filter((item) => item.identityId === legacy.identityId)
						.map((item) => ({
							budgetItemId: allocation.budgetItemId,
							versionItemId: item.id,
							identityId: item.identityId,
						}))
				: [],
		);
	}
	try {
		const successors = planLegacyCostMigration({
			sourceCostId: source.id,
			amount: source.amount,
			allocations: source.allocations,
			candidates,
		});
		if (apply) {
			await prisma.$transaction(async (tx) => {
				for (const successor of successors) {
					const created = await tx.constructionActualCost.create({
						data: {
							ownerId: source.ownerId,
							workId: source.workId,
							budgetVersionItemId: successor.budgetVersionItemId,
							costDate: source.costDate,
							category: source.category,
							description: source.description,
							amount: successor.amount,
							costType: source.costType,
							sourceDocument: source.sourceDocument,
							appropriationStatus: source.appropriationStatus,
							supplierName: source.supplierName,
							supplierId: source.supplierId,
							paymentStatus: source.paymentStatus,
							competenceDate: source.competenceDate,
							dueDate: source.dueDate,
							paymentDate: source.paymentDate,
							documentNumber: source.documentNumber,
						},
					});
					await tx.costMigrationLineage.create({
						data: {
							ownerId: source.ownerId,
							sourceCostId: source.id,
							successorCostId: created.id,
							budgetVersionItemId: successor.budgetVersionItemId,
							sequence: successor.sequence,
							lineageKey: successor.lineageKey,
							amount: successor.amount,
						},
					});
				}
			});
		}
		result.push({
			sourceCostId: source.id,
			status: apply ? "APPLIED" : "MIGRATABLE",
			successors: successors.map((row) => ({
				...row,
				amount: row.amount.toString(),
			})),
		});
	} catch (error) {
		result.push({
			sourceCostId: source.id,
			status: "BLOCKED",
			code: error instanceof Error ? error.name : "UNKNOWN",
			message: error instanceof Error ? error.message : String(error),
		});
	}
}
console.log(
	JSON.stringify(
		{ mode: apply ? "apply" : "dry-run", total: sources.length, result },
		null,
		2,
	),
);
