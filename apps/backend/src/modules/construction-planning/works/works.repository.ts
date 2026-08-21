import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../../lib/errors";
import { logger } from "../../../lib/logger";
import { prisma } from "../../../lib/prisma";
import type { StructuredAddressInput } from "./work-service";

function addressCreateInput(address: StructuredAddressInput) {
	return {
		zipCode: address.zipCode.replace(/\D/g, ""),
		street: address.street?.trim() ?? "",
		district: address.district?.trim() ?? "",
		number: address.number?.trim() ?? "",
		city: address.city.trim(),
		state: address.state.trim().toUpperCase(),
		complement: address.complement?.trim() || null,
		latitude: address.latitude ?? null,
		longitude: address.longitude ?? null,
	};
}

function addressResponse(
	address: {
		zipCode: string;
		street?: string;
		district?: string;
		number?: string;
		city: string;
		state: string;
		complement: string | null;
		latitude: unknown;
		longitude: unknown;
	} | null,
) {
	if (!address) return null;
	return {
		...address,
		latitude: address.latitude === null ? null : Number(address.latitude),
		longitude: address.longitude === null ? null : Number(address.longitude),
	};
}

import { getAccessibleWorkIds } from "../../../lib/scope-access";
import { computeWorkSummary } from "../bi/work-summary";
import type { ConstructionWorksFilter } from "../schema";

export const MULTIWORKS_CAP = 1000;

export type ActiveImportChildren = {
	items: Prisma.ConstructionBudgetItemGetPayload<null>[];
	baselineSchedules: Prisma.ConstructionBaselineScheduleGetPayload<null>[];
	scheduleRevisions: Prisma.ConstructionScheduleRevisionGetPayload<null>[];
	measurements: Prisma.ConstructionMeasurementGetPayload<null>[];
	actualCosts: Prisma.ConstructionActualCostGetPayload<null>[];
};

const workListInclude = {
	imports: {
		select: { id: true, createdAt: true },
		orderBy: { createdAt: "desc" },
		take: 1,
	},
	costCenter: {
		select: {
			id: true,
			name: true,
			organizationId: true,
			organization: { select: { id: true, name: true } },
		},
	},
} satisfies Prisma.ConstructionWorkInclude;

type WorkSummaryWithHierarchy = ReturnType<typeof computeWorkSummary> & {
	organizationId: string | null;
	organizationName: string | null;
	costCenterName: string | null;
};

function attachHierarchy(
	works: Array<{
		costCenter?: {
			organizationId: string | null;
			organization?: { name: string | null } | null;
			name: string | null;
		} | null;
	}>,
	summaries: Array<ReturnType<typeof computeWorkSummary>>,
): WorkSummaryWithHierarchy[] {
	return summaries.map((summary, index) => {
		const costCenter = works[index]?.costCenter;
		return {
			...summary,
			organizationId: costCenter?.organizationId ?? null,
			organizationName: costCenter?.organization?.name ?? null,
			costCenterName: costCenter?.name ?? null,
		};
	});
}

export {
	createWorkWithImport,
	findWorkByOwnerAndCode,
	replaceWorkWithImport,
} from "../imports/import-repository";

export async function getWorkOrThrow(ownerId: string, workId: string) {
	const work = await getWorkById(ownerId, workId);
	if (!work) {
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	}
	return work;
}

type WorkWithImportCreatedAt = Prisma.ConstructionWorkGetPayload<{
	include: {
		imports: {
			select: { id: true; createdAt: true };
			orderBy: { createdAt: "desc" };
			take: 1;
		};
	};
}>;

export function buildWorkSummaries(
	works: WorkWithImportCreatedAt[],
	childMap: Map<string, ActiveImportChildren>,
) {
	return works.map((w) => {
		const lastImportAt = w.imports[0]?.createdAt ?? w.createdAt;
		const activeChildren = childMap.get(w.id) ?? null;
		return computeWorkSummary({
			id: w.id,
			code: w.code,
			name: w.name,
			costCenterId: w.costCenterId,
			clientName: w.clientName,
			plannedStart: w.plannedStart,
			plannedEnd: w.plannedEnd,
			baseDate: w.baseDate,
			createdAt: w.createdAt,
			lastImportAt,
			activeChildren,
		});
	});
}

import { buildPaginatedResponse } from "../../../lib/pagination";

async function resolveActiveImportId(
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

async function getActiveImportChildren(
	ownerId: string,
	workId: string,
	activeImportId: string | null,
) {
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
			include: { allocations: true },
		}),
	]);

	return {
		items,
		baselineSchedules,
		scheduleRevisions,
		measurements,
		actualCosts,
	};
}

async function getBatchActiveImportChildren(
	ownerId: string,
	workIds: Array<{ workId: string; activeImportId: string | null }>,
): Promise<Map<string, ActiveImportChildren>> {
	if (workIds.length === 0) return new Map();

	const missingActiveImportIds = workIds
		.filter((work) => !work.activeImportId)
		.map((work) => work.workId);
	const fallbackImports =
		missingActiveImportIds.length > 0
			? await prisma.constructionImport.findMany({
					where: { ownerId, workId: { in: missingActiveImportIds } },
					orderBy: { createdAt: "desc" },
					select: { id: true, workId: true },
				})
			: [];
	const fallbackByWork = new Map<string, string>();
	for (const imp of fallbackImports) {
		if (imp.workId && !fallbackByWork.has(imp.workId)) {
			fallbackByWork.set(imp.workId, imp.id);
		}
	}

	const effectiveImportIds = workIds.map(({ workId, activeImportId }) => ({
		workId,
		importId: activeImportId ?? fallbackByWork.get(workId) ?? null,
	}));
	const activeWhereConditions = effectiveImportIds.flatMap(
		({ workId, importId }) => (importId ? [{ ownerId, workId, importId }] : []),
	);
	const manualOrActiveWhereConditions = effectiveImportIds.flatMap(
		({ workId, importId }) =>
			importId
				? [
						{ ownerId, workId, importId },
						{ ownerId, workId, importId: null },
					]
				: [{ ownerId, workId, importId: null }],
	);

	const [
		items,
		baselineSchedules,
		scheduleRevisions,
		measurements,
		actualCosts,
	] = await Promise.all([
		activeWhereConditions.length > 0
			? prisma.constructionBudgetItem.findMany({
					where: { OR: activeWhereConditions },
					orderBy: { sortOrder: "asc" },
				})
			: Promise.resolve([]),
		activeWhereConditions.length > 0
			? prisma.constructionBaselineSchedule.findMany({
					where: { OR: activeWhereConditions },
					orderBy: { plannedStart: "asc" },
				})
			: Promise.resolve([]),
		activeWhereConditions.length > 0
			? prisma.constructionScheduleRevision.findMany({
					where: { OR: activeWhereConditions },
					orderBy: { revisionDate: "asc" },
				})
			: Promise.resolve([]),
		prisma.constructionMeasurement.findMany({
			where: { OR: manualOrActiveWhereConditions },
			orderBy: { measurementDate: "asc" },
		}),
		prisma.constructionActualCost.findMany({
			where: { OR: manualOrActiveWhereConditions },
			orderBy: { costDate: "asc" },
			include: { allocations: true },
		}),
	]);

	const groupByWork = <T extends { workId: string }>(arr: T[]) => {
		const map = new Map<string, T[]>();
		for (const item of arr) {
			const list = map.get(item.workId);
			if (list) list.push(item);
			else map.set(item.workId, [item]);
		}
		return map;
	};

	const itemsByWork = groupByWork(items);
	const baselinesByWork = groupByWork(baselineSchedules);
	const revisionsByWork = groupByWork(scheduleRevisions);
	const measurementsByWork = groupByWork(measurements);
	const costsByWork = groupByWork(actualCosts);

	const childMap = new Map<string, ActiveImportChildren>();

	for (const { workId } of workIds) {
		childMap.set(workId, {
			items: itemsByWork.get(workId) ?? [],
			baselineSchedules: baselinesByWork.get(workId) ?? [],
			scheduleRevisions: revisionsByWork.get(workId) ?? [],
			measurements: measurementsByWork.get(workId) ?? [],
			actualCosts: costsByWork.get(workId) ?? [],
		});
	}

	return childMap;
}

export async function createWorkManual(
	ownerId: string,
	data: {
		code: string;
		name: string;
		costCenterId: string;
		address: string | null;
		clientName: string | null;
		baseDate: Date | null;
		plannedStart: Date | null;
		plannedEnd: Date | null;
		areaM2: number | null;
		responsibleName: string | null;
		structuredAddress?: StructuredAddressInput | null;
		creationIdempotencyKey?: string | null;
	},
) {
	return prisma.$transaction(async (tx) => {
		const address = data.structuredAddress
			? await tx.address.create({
					data: addressCreateInput(data.structuredAddress),
				})
			: null;
		const work = await tx.constructionWork.create({
			data: {
				ownerId,
				code: data.code,
				name: data.name,
				costCenterId: data.costCenterId,
				address: data.address,
				clientName: data.clientName,
				baseDate: data.baseDate,
				plannedStart: data.plannedStart,
				plannedEnd: data.plannedEnd,
				areaM2: data.areaM2,
				responsibleName: data.responsibleName,
				structuredAddressId: address?.id ?? null,
			},
		});
		if (data.creationIdempotencyKey) {
			await tx.workCreationIdempotency.create({
				data: { ownerId, key: data.creationIdempotencyKey, workId: work.id },
			});
		}
		return work;
	});
}

export async function findWorkByOwnerAndCreationIdempotencyKey(
	ownerId: string,
	creationIdempotencyKey: string,
) {
	return prisma.constructionWork.findFirst({
		where: { ownerId, creationIdempotency: { key: creationIdempotencyKey } },
	});
}

async function mergeWorksWithChildren<
	T extends { id: string; activeImportId: string | null },
>(ownerId: string, works: T[]): Promise<(T & ActiveImportChildren)[]> {
	const activeImportIds = works.map((w) => ({
		workId: w.id,
		activeImportId: w.activeImportId,
	}));
	const childMap = await getBatchActiveImportChildren(ownerId, activeImportIds);
	const empty = {
		items: [] as ActiveImportChildren["items"],
		baselineSchedules: [] as ActiveImportChildren["baselineSchedules"],
		scheduleRevisions: [] as ActiveImportChildren["scheduleRevisions"],
		measurements: [] as ActiveImportChildren["measurements"],
		actualCosts: [] as ActiveImportChildren["actualCosts"],
	};
	return works.map((work) => ({
		...work,
		...(childMap.get(work.id) ?? empty),
	}));
}

export async function listWorks(
	ownerId: string,
	filter: ConstructionWorksFilter,
) {
	const {
		q,
		status,
		scheduleRisk: scheduleRiskFilter,
		costRisk: costRiskFilter,
		costCenterId,
		page,
		limit,
	} = filter;
	const hasComputedFilters = Boolean(
		status || scheduleRiskFilter || costRiskFilter,
	);

	const accessibleWorkIds = await getAccessibleWorkIds(ownerId);
	const where: Prisma.ConstructionWorkWhereInput = {
		id: { in: accessibleWorkIds },
	};
	if (costCenterId) where.costCenterId = costCenterId;
	if (q) {
		where.OR = [{ name: { contains: q } }, { code: { contains: q } }];
	}

	if (!hasComputedFilters) {
		const totalCount = await prisma.constructionWork.count({ where });
		const works = await prisma.constructionWork.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * limit,
			take: limit,
			include: workListInclude,
		});

		const activeImportIds = works.map((w) => ({
			workId: w.id,
			activeImportId: w.activeImportId,
		}));
		const childMap = await getBatchActiveImportChildren(
			ownerId,
			activeImportIds,
		);

		return buildPaginatedResponse(
			attachHierarchy(works, buildWorkSummaries(works, childMap)),
			totalCount,
			page,
			limit,
		);
	}

	const works = await prisma.constructionWork.findMany({
		where,
		orderBy: { createdAt: "desc" },
		include: workListInclude,
	});

	const activeImportIds = works.map((w) => ({
		workId: w.id,
		activeImportId: w.activeImportId,
	}));
	const childMap = await getBatchActiveImportChildren(ownerId, activeImportIds);

	let filteredData = attachHierarchy(
		works,
		buildWorkSummaries(works, childMap),
	);
	if (status)
		filteredData = filteredData.filter(
			(work) => work.computedStatus === status,
		);
	if (scheduleRiskFilter)
		filteredData = filteredData.filter(
			(work) => work.scheduleRisk === scheduleRiskFilter,
		);
	if (costRiskFilter)
		filteredData = filteredData.filter(
			(work) => work.costRisk === costRiskFilter,
		);

	const totalCount = filteredData.length;
	const paginatedData = filteredData.slice((page - 1) * limit, page * limit);

	return buildPaginatedResponse(paginatedData, totalCount, page, limit);
}

export async function getWorkWithItems(ownerId: string, workId: string) {
	const accessibleIds = await getAccessibleWorkIds(ownerId);
	if (!accessibleIds.includes(workId)) return null;

	const work = await prisma.constructionWork.findFirst({
		where: { id: workId },
		include: {
			imports: {
				select: { createdAt: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
		},
	});

	if (!work) return null;

	return {
		...work,
		...(await getActiveImportChildren(ownerId, work.id, work.activeImportId)),
	};
}

export async function listAllWorks(ownerId: string) {
	const accessibleWorkIds = await getAccessibleWorkIds(ownerId);
	const works = await prisma.constructionWork.findMany({
		where: { id: { in: accessibleWorkIds } },
		orderBy: { createdAt: "desc" },
	});

	return works.map((w) => ({
		id: w.id,
		code: w.code,
		name: w.name,
	}));
}

export async function getAllWorksWithItems(ownerId: string) {
	const accessibleWorkIds = await getAccessibleWorkIds(ownerId);
	const works = await prisma.constructionWork.findMany({
		where: { id: { in: accessibleWorkIds } },
		orderBy: { createdAt: "desc" },
		take: MULTIWORKS_CAP,
		include: {
			costCenter: {
				select: { organizationId: true },
			},
			imports: {
				select: { createdAt: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
		},
	});

	if (works.length >= MULTIWORKS_CAP) {
		logger.warn("bi.multiworks.cap", {
			ownerId,
			limit: MULTIWORKS_CAP,
		});
	}

	return mergeWorksWithChildren(ownerId, works);
}

export async function getWorkById(ownerId: string, workId: string) {
	const accessibleIds = await getAccessibleWorkIds(ownerId);
	if (!accessibleIds.includes(workId)) return null;

	const work = await prisma.constructionWork.findFirst({
		where: { id: workId },
		include: {
			structuredAddress: true,
			costCenter: {
				select: {
					id: true,
					name: true,
					organizationId: true,
					organization: { select: { id: true, name: true } },
				},
			},
			imports: {
				select: {
					id: true,
					fileName: true,
					sheetName: true,
					importedSections: true,
					rowCount: true,
					status: true,
					createdAt: true,
				},
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!work) return null;

	const children = await getActiveImportChildren(
		ownerId,
		work.id,
		work.activeImportId,
	);

	const summary = computeWorkSummary({
		id: work.id,
		code: work.code,
		name: work.name,
		costCenterId: work.costCenterId,
		clientName: work.clientName,
		plannedStart: work.plannedStart,
		plannedEnd: work.plannedEnd,
		baseDate: work.baseDate,
		createdAt: work.createdAt,
		lastImportAt: work.imports[0]?.createdAt ?? work.createdAt,
		activeChildren: children,
	});

	return {
		...work,
		structuredAddress: addressResponse(work.structuredAddress),
		...children,
		...summary,
		organizationId: work.costCenter?.organizationId ?? null,
		organizationName: work.costCenter?.organization?.name ?? null,
		costCenterId: work.costCenterId,
		costCenterName: work.costCenter?.name ?? null,
	};
}

export async function updateWork(
	ownerId: string,
	workId: string,
	data: {
		code?: string;
		name?: string;
		costCenterId?: string;
		address?: string;
		clientName?: string;
		areaM2?: number;
		responsibleName?: string;
		plannedStart?: string;
		plannedEnd?: string;
		structuredAddress?: StructuredAddressInput | null;
	},
) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
	});

	if (!work) return null;

	const updateData: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined && key !== "plannedStart" && key !== "plannedEnd") {
			updateData[key] = value || null;
		}
	}
	if (data.plannedStart !== undefined)
		updateData.plannedStart = data.plannedStart
			? new Date(data.plannedStart)
			: null;
	if (data.plannedEnd !== undefined)
		updateData.plannedEnd = data.plannedEnd ? new Date(data.plannedEnd) : null;
	if (data.structuredAddress !== undefined) {
		if (data.structuredAddress) {
			const address = await prisma.address.create({
				data: addressCreateInput(data.structuredAddress),
			});
			updateData.structuredAddressId = address.id;
		} else {
			updateData.structuredAddressId = null;
		}
	}

	return prisma.constructionWork.update({
		where: { id: workId, ownerId },
		data: updateData,
	});
}

type WorkDeleteClient = Prisma.TransactionClient | typeof prisma;

/**
 * Remove os registros que não possuem uma relação Prisma com ConstructionWork
 * e os vínculos que usam RESTRICT antes de deixar o banco executar as cascatas
 * das demais relações. O mesmo caso de uso é usado na exclusão direta e no
 * efeito de aprovação, garantindo que o aceite tenha o mesmo resultado final.
 */
export async function deleteWorkCascade(
	db: WorkDeleteClient,
	ownerId: string,
	workId: string,
) {
	const work = await db.constructionWork.findFirst({
		where: { id: workId, ownerId },
	});

	if (!work) return null;

	// Esses vínculos apontam para itens do orçamento com RESTRICT.
	await db.quotationBudgetItem.deleteMany({ where: { workId } });
	await db.contractRequestBudgetItem.deleteMany({ where: { workId } });

	// ImportBatch usa SET NULL para preservar o lote fora da obra, mas a
	// confirmação da exclusão deve remover também seus dados de staging.
	await db.importBatch.deleteMany({ where: { ownerId, workId } });

	// Cotações e estes agregados antigos guardam workId sem relação FK direta.
	await db.quotation.deleteMany({ where: { ownerId, workId } });
	await db.constructionBudgetReconciliation.deleteMany({
		where: { ownerId, workId },
	});
	await db.constructionMonthlyFact.deleteMany({ where: { ownerId, workId } });

	return db.constructionWork.delete({ where: { id: work.id, ownerId } });
}

export async function deleteWork(ownerId: string, workId: string) {
	return prisma.$transaction((tx) => deleteWorkCascade(tx, ownerId, workId));
}

export async function getWorkDependencyCounts(
	ownerId: string,
	workId: string,
): Promise<Record<string, number>> {
	const [
		imports,
		importBatches,
		budgetItems,
		budgetVersions,
		budgetIdentities,
		baselines,
		scheduleRevisions,
		scheduleVersions,
		measurements,
		actualCosts,
		supplierLinks,
		workMeasurements,
		contracts,
		memberships,
		photoReports,
		ledgerEvents,
		budgetImpacts,
		monthlyFacts,
	] = await Promise.all([
		prisma.constructionImport.count({ where: { ownerId, workId } }),
		prisma.importBatch.count({ where: { ownerId, workId } }),
		prisma.constructionBudgetItem.count({ where: { ownerId, workId } }),
		prisma.budgetVersion.count({ where: { ownerId, workId } }),
		prisma.budgetItemIdentity.count({ where: { ownerId, workId } }),
		prisma.constructionBaselineSchedule.count({
			where: { ownerId, workId },
		}),
		prisma.constructionScheduleRevision.count({ where: { ownerId, workId } }),
		prisma.scheduleVersion.count({ where: { ownerId, workId } }),
		prisma.constructionMeasurement.count({ where: { ownerId, workId } }),
		prisma.constructionActualCost.count({ where: { ownerId, workId } }),
		prisma.constructionWorkSupplier.count({ where: { ownerId, workId } }),
		prisma.workMeasurement.count({ where: { ownerId, workId } }),
		prisma.contract.count({ where: { ownerId, workId } }),
		prisma.workMembership.count({ where: { workId } }),
		prisma.photoReport.count({ where: { ownerId, workId } }),
		prisma.constructionLedgerEvent.count({ where: { ownerId, workId } }),
		prisma.constructionBudgetImpact.count({ where: { ownerId, workId } }),
		prisma.constructionMonthlyFact.count({ where: { ownerId, workId } }),
	]);

	return {
		imports,
		importBatches,
		budgetItems,
		budgetVersions,
		budgetIdentities,
		baselines,
		scheduleRevisions,
		scheduleVersions,
		measurements,
		actualCosts,
		supplierLinks,
		workMeasurements,
		contracts,
		memberships,
		photoReports,
		ledgerEvents,
		budgetImpacts,
		monthlyFacts,
	};
}

export async function getWorksByIdsWithItems(
	ownerId: string,
	workIds: string[],
) {
	if (workIds.length === 0) return [];

	const accessibleIds = await getAccessibleWorkIds(ownerId);
	const allowedIds = workIds.filter((id) => accessibleIds.includes(id));
	if (allowedIds.length === 0) return [];

	const works = await prisma.constructionWork.findMany({
		where: { id: { in: allowedIds } },
		include: {
			costCenter: {
				select: { organizationId: true },
			},
			imports: {
				select: { createdAt: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
		},
	});

	return mergeWorksWithChildren(ownerId, works);
}

export async function getWorksByCostCenter(
	ownerId: string,
	costCenterId: string,
) {
	const accessibleIds = await getAccessibleWorkIds(ownerId);
	const works = await prisma.constructionWork.findMany({
		where: { id: { in: accessibleIds }, costCenterId },
		include: {
			imports: {
				select: { createdAt: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
		},
	});

	return mergeWorksWithChildren(ownerId, works);
}

export async function getWorksByOrganization(
	ownerId: string,
	organizationId: string,
) {
	const costCenters = await prisma.costCenter.findMany({
		where: { ownerId, organizationId },
		select: { id: true },
	});

	if (costCenters.length === 0) {
		return [];
	}

	const costCenterIds = costCenters.map((cc) => cc.id);

	const accessibleIds = await getAccessibleWorkIds(ownerId);
	const works = await prisma.constructionWork.findMany({
		where: { id: { in: accessibleIds }, costCenterId: { in: costCenterIds } },
		include: {
			imports: {
				select: { createdAt: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
		},
	});

	return mergeWorksWithChildren(ownerId, works);
}
