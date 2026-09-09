import { prisma } from "../../lib/prisma";
import { getActualCostImportIds } from "./calculators/active-scope";

/** @deprecated Exports now use the live operational source directly. */
export type ExportSourceResolution = { mode: "LIVE"; persisted: null };

/** @deprecated Kept for compatibility with repository consumers. */
export async function resolveExportSource(
	_ownerId: string,
	_workId: string,
): Promise<ExportSourceResolution> {
	return { mode: "LIVE", persisted: null };
}

async function getActiveBudgetItemIds(ownerId: string, workId: string) {
	const work = await prisma.constructionWork.findFirst({
		where: { ownerId, id: workId },
		select: { activeImportId: true },
	});
	if (!work?.activeImportId) return [];
	const items = await prisma.constructionBudgetItem.findMany({
		where: { ownerId, workId, importId: work.activeImportId },
		select: { id: true },
	});
	return items.map((item) => item.id);
}

export async function getBudgetItemsForExport(ownerId: string, workId: string) {
	const work = await prisma.constructionWork.findFirst({
		where: { ownerId, id: workId },
		select: { activeImportId: true },
	});
	return prisma.constructionBudgetItem.findMany({
		where: {
			ownerId,
			workId,
			importId: work?.activeImportId ?? "__NO_ACTIVE_IMPORT__",
		},
		orderBy: { sortOrder: "asc" },
	});
}

export async function getBudgetItemsForImportExport(
	ownerId: string,
	workId: string,
	importId: string,
) {
	return prisma.constructionBudgetItem.findMany({
		where: { ownerId, workId, importId },
		orderBy: { sortOrder: "asc" },
	});
}

export async function getOriginalBudgetImportIdForExport(
	ownerId: string,
	workId: string,
) {
	const version = await prisma.budgetVersion.findFirst({
		where: { ownerId, workId },
		orderBy: { versionNumber: "asc" },
		select: { budgetImportId: true },
	});
	return version?.budgetImportId ?? null;
}

export async function getBudgetVersionsForExport(
	ownerId: string,
	workId: string,
) {
	return prisma.budgetVersion.findMany({
		where: { ownerId, workId },
		orderBy: { versionNumber: "asc" },
		select: {
			versionNumber: true,
			label: true,
			status: true,
			isActive: true,
			reason: true,
			kind: true,
			acrescimoBruto: true,
			supressao: true,
			impactoLiquido: true,
			percentualImpacto: true,
			items: {
				orderBy: [{ sortOrder: "asc" }, { index: "asc" }],
				select: {
					index: true,
					type: true,
					description: true,
					unit: true,
					quantity: true,
					unitCost: true,
					totalCost: true,
					plannedStart: true,
					plannedEnd: true,
				},
			},
		},
	});
}

export async function getBaselineSchedulesForExport(
	ownerId: string,
	workId: string,
) {
	return prisma.constructionBaselineSchedule.findMany({
		where: { ownerId, workId },
		orderBy: { budgetItem: { sortOrder: "asc" } },
		include: {
			budgetItem: {
				select: {
					index: true,
					type: true,
					description: true,
					unit: true,
					quantity: true,
					unitCost: true,
					totalCost: true,
					plannedStart: true,
					plannedEnd: true,
					actualStart: true,
					actualEnd: true,
					completionPercentage: true,
					computedStatus: true,
					scheduleRevisions: {
						orderBy: { revisionDate: "desc" },
						take: 1,
						select: {
							version: true,
							replannedStart: true,
							replannedEnd: true,
							revisionDate: true,
							reason: true,
						},
					},
				},
			},
		},
	});
}

export async function getMeasurementsForExport(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
) {
	const budgetItemIds = await getActiveBudgetItemIds(ownerId, workId);
	return prisma.constructionMeasurement.findMany({
		where: {
			ownerId,
			workId,
			status: "ACEITO",
			budgetItemId: { in: budgetItemIds },
			...(asOfDate ? { measurementDate: { lte: asOfDate } } : {}),
		},
		orderBy: { measurementDate: "asc" },
	});
}

export async function getMeasurementsWithBudgetItemForExport(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
) {
	const workMeasurements = await prisma.workMeasurement.findMany({
		where: {
			ownerId,
			workId,
			status: "ACEITO",
			...(asOfDate ? { date: { lte: asOfDate } } : {}),
		},
		orderBy: [{ date: "asc" }, { number: "asc" }],
		include: {
			items: {
				include: {
					budgetItem: { select: { index: true, description: true } },
				},
			},
		},
	});
	if (workMeasurements.length > 0) {
		return workMeasurements.flatMap((measurement) =>
			measurement.items.map((item) => ({
				budgetItem: item.budgetItem,
				measurementDate: measurement.date,
				// WorkMeasurement stores percentages in the 0..100 scale;
				// the spreadsheet contract accepts the Excel 0..1 fraction too.
				measuredPercentageAccumulated:
					item.accumulatedPercentage != null
						? Number(item.accumulatedPercentage) / 100
						: null,
				measuredQuantityAccumulated:
					item.accumulatedQuantity != null
						? Number(item.accumulatedQuantity)
						: null,
				notes: measurement.notes,
			})),
		);
	}

	// Keep legacy imports exportable for works that have not migrated to the
	// WorkMeasurement aggregate yet.
	const budgetItemIds = await getActiveBudgetItemIds(ownerId, workId);
	return prisma.constructionMeasurement.findMany({
		where: {
			ownerId,
			workId,
			status: "ACEITO",
			budgetItemId: { in: budgetItemIds },
			...(asOfDate ? { measurementDate: { lte: asOfDate } } : {}),
		},
		orderBy: { measurementDate: "asc" },
		include: {
			budgetItem: { select: { index: true, description: true } },
		},
	});
}

export async function getActualCostsForExport(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
) {
	const budgetItemIds = await getActiveBudgetItemIds(ownerId, workId);
	const actualCostImportIds = await getActualCostImportIds(ownerId, workId);
	return prisma.constructionActualCost.findMany({
		where: {
			OR: [
				{ ownerId, workId, budgetItemId: { in: budgetItemIds } },
				{ ownerId, workId, budgetItemId: null },
				...(actualCostImportIds.length > 0
					? [{ ownerId, workId, importId: { in: actualCostImportIds } }]
					: []),
			],
			...(asOfDate ? { costDate: { lte: asOfDate } } : {}),
		},
		orderBy: { costDate: "asc" },
		include: {
			budgetItem: { select: { index: true, description: true } },
			budgetVersionItem: { select: { index: true, description: true } },
			allocations: {
				include: { budgetItem: { select: { index: true, description: true } } },
			},
		},
	});
}

export async function getContractsWithDetailsForExport(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
) {
	return prisma.contract.findMany({
		where: {
			ownerId,
			workId,
			...(asOfDate ? { createdAt: { lte: asOfDate } } : {}),
		},
		include: {
			services: { select: { description: true, totalCost: true } },
			measurements: { include: { items: { select: { measuredValue: true } } } },
			payments: { select: { paidValue: true } },
		},
	});
}

export async function getContractsSimpleForExport(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
) {
	return prisma.contract.findMany({
		where: {
			ownerId,
			workId,
			...(asOfDate ? { createdAt: { lte: asOfDate } } : {}),
		},
	});
}

export async function getWorkInfoForExport(ownerId: string, workId: string) {
	return prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: {
			code: true,
			name: true,
			clientName: true,
			baseDate: true,
			plannedStart: true,
			plannedEnd: true,
		},
	});
}
