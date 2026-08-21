import { prisma } from "../../../lib/prisma";

export function buildActiveImportWhere(
	ownerId: string,
	workId: string,
	activeImportId: string | null,
): Record<string, unknown> {
	return activeImportId
		? { ownerId, workId, importId: activeImportId }
		: { ownerId, workId, importId: null };
}

export function buildManualOrActiveWhere(
	ownerId: string,
	workId: string,
	activeImportId: string | null,
): Record<string, unknown> {
	if (!activeImportId) {
		return { ownerId, workId, importId: null };
	}
	return {
		OR: [
			{ ownerId, workId, importId: activeImportId },
			{ ownerId, workId, importId: null },
		],
	} as Record<string, unknown>;
}

export async function getActiveImportId(
	ownerId: string,
	workId: string,
): Promise<string | null> {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { activeImportId: true },
	});
	return work?.activeImportId ?? null;
}

export async function resolveActiveImportId(
	ownerId: string,
	workId: string,
	activeImportId: string | null,
): Promise<string | null> {
	if (activeImportId) {
		const imp = await prisma.constructionImport.findFirst({
			where: { id: activeImportId, ownerId, workId },
			select: { id: true },
		});
		if (imp) return imp.id;
	}
	const latest = await prisma.constructionImport.findFirst({
		where: { ownerId, workId },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});
	return latest?.id ?? null;
}

export type ActiveWorkChildren = {
	items: Array<Record<string, unknown>>;
	baselineSchedules: Array<Record<string, unknown>>;
	scheduleRevisions: Array<Record<string, unknown>>;
	measurements: Array<Record<string, unknown>>;
	actualCosts: Array<Record<string, unknown>>;
};

export async function loadActiveWorkChildren(
	ownerId: string,
	workId: string,
	activeImportId: string | null,
): Promise<ActiveWorkChildren> {
	const resolvedImportId = await resolveActiveImportId(
		ownerId,
		workId,
		activeImportId,
	);

	const activeImportWhere = resolvedImportId
		? { ownerId, workId, importId: resolvedImportId }
		: null;

	const [items, baselineSchedules, scheduleRevisions] = await Promise.all([
		activeImportWhere
			? prisma.constructionBudgetItem.findMany({
					where: activeImportWhere,
					orderBy: { sortOrder: "asc" },
				})
			: Promise.resolve([]),
		activeImportWhere
			? prisma.constructionBaselineSchedule.findMany({
					where: activeImportWhere,
					orderBy: { plannedStart: "asc" },
				})
			: Promise.resolve([]),
		activeImportWhere
			? prisma.constructionScheduleRevision.findMany({
					where: activeImportWhere,
					orderBy: { revisionDate: "asc" },
				})
			: Promise.resolve([]),
	]);
	const activeItemIds = items.map((item) => item.id);
	const operationalWhere = {
		OR: [
			...(activeImportWhere ? [activeImportWhere] : []),
			{ ownerId, workId, importId: null },
			...(activeItemIds.length > 0
				? [{ budgetItemId: { in: activeItemIds } }]
				: []),
		],
	};
	const [measurements, actualCosts] = await Promise.all([
		prisma.constructionMeasurement.findMany({
			where: operationalWhere,
			orderBy: { measurementDate: "asc" },
		}),
		prisma.constructionActualCost.findMany({
			where: operationalWhere,
			orderBy: { costDate: "asc" },
		}),
	]);

	return {
		items: items as Array<Record<string, unknown>>,
		baselineSchedules: baselineSchedules as Array<Record<string, unknown>>,
		scheduleRevisions: scheduleRevisions as Array<Record<string, unknown>>,
		measurements: measurements as Array<Record<string, unknown>>,
		actualCosts: actualCosts as Array<Record<string, unknown>>,
	};
}
