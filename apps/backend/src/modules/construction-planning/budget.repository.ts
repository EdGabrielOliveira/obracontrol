import { ConstructionError } from "../../lib/errors";
import { roundCurrency } from "../../lib/math-utils";
import { toFiniteNumber, toNullableNumber } from "../../lib/number-utils";
import { prisma } from "../../lib/prisma";
import { getWorkspaceIdForUser } from "../../lib/workspace";
import {
	buildBudgetTree,
	calculateBdi,
	calculateBudgetSummary,
	deriveBudgetItemTotalCost,
	rollupBudgetTree,
} from "./calculators/budget-calculator";
import { toBudgetItemDto } from "./dto/financial-dto";
import { getPhysicalFinancialSchedule } from "./management.repository";
import type {
	CreateBudgetItemInput,
	ReorderBudgetItemsInput,
	UpdateBudgetItemInput,
} from "./schemas/budget.schema";
import { getWorkMeasurementSummary } from "./work-measurement.repository";
import { getWorkById } from "./works/works.repository";

type BudgetItemPayload = {
	parentId: string | null;
	index: string;
	type: CreateBudgetItemInput["type"];
	description: string;
	unit: string | null;
	quantity: number | null;
	laborUnitCost: number;
	materialUnitCost: number;
	equipmentUnitCost: number;
	otherUnitCost: number;
	unitCostTotal: number;
	totalBudget: number;
	unitCost: number;
	totalCost: number;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	actualStart: Date | null;
	actualEnd: Date | null;
	completionPercentage: number;
	providedStatus: string | null;
	sortOrder: number;
};

function toNullableDateTime(value: string | null | undefined): Date | null {
	if (!value) return null;

	const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
		? `${value}T00:00:00.000Z`
		: value;
	const date = new Date(normalized);
	if (Number.isNaN(date.getTime())) {
		throw new ConstructionError("INVALID_DATE", "Data invalida", 400);
	}
	return date;
}

async function ensureActiveImport(ownerId: string, workId: string) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true, activeImportId: true, workspaceId: true },
	});

	if (!work) {
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	}

	if (work.activeImportId) return work.activeImportId;

	const imp = await prisma.constructionImport.create({
		data: {
			ownerId,
			workspaceId: work.workspaceId ?? (await getWorkspaceIdForUser(ownerId)),
			workId,
			fileName: "manual-budget",
			sheetName: "Manual",
			rowCount: 0,
			importedSections: ["Orcamento"],
			status: "MANUAL",
		},
	});

	await prisma.constructionWork.update({
		where: { id: workId, ownerId },
		data: { activeImportId: imp.id },
	});

	return imp.id;
}

function normalizeBudgetItemInput(
	input: CreateBudgetItemInput | UpdateBudgetItemInput,
): BudgetItemPayload {
	const unitCost = input.unitCost ?? null;
	const labor = input.laborUnitCost ?? 0;
	const material = input.materialUnitCost ?? 0;
	const equipment = input.equipmentUnitCost ?? 0;
	const other = input.otherUnitCost ?? 0;
	const derivedUnitCost = unitCost ?? labor + material + equipment + other;
	const quantity = input.quantity ?? null;
	const derivedTotalCost = deriveBudgetItemTotalCost(input);

	return {
		parentId: input.parentId ?? null,
		index: (input.index ?? "") as string,
		type: (input.type ?? "ITEM") as CreateBudgetItemInput["type"],
		description: (input.description ?? "") as string,
		unit: input.unit ?? null,
		quantity,
		laborUnitCost: input.laborUnitCost ?? 0,
		materialUnitCost: input.materialUnitCost ?? 0,
		equipmentUnitCost: input.equipmentUnitCost ?? 0,
		otherUnitCost: input.otherUnitCost ?? 0,
		unitCostTotal: derivedUnitCost,
		totalBudget: derivedTotalCost,
		unitCost: derivedUnitCost,
		totalCost: derivedTotalCost,
		plannedStart: toNullableDateTime(input.plannedStart),
		plannedEnd: toNullableDateTime(input.plannedEnd),
		actualStart: toNullableDateTime(input.actualStart),
		actualEnd: toNullableDateTime(input.actualEnd),
		completionPercentage: input.completionPercentage ?? 0,
		providedStatus: input.providedStatus ?? null,
		sortOrder: input.sortOrder ?? 0,
	};
}

export async function findByIndex(
	ownerId: string,
	workId: string,
	index: string,
	excludeId?: string,
) {
	return prisma.constructionBudgetItem.findFirst({
		where: {
			ownerId,
			workId,
			index,
			...(excludeId ? { id: { not: excludeId } } : {}),
		},
		select: { id: true },
	});
}

export async function sumChildrenTotalCost(
	ownerId: string,
	workId: string,
	parentId: string,
	excludeId?: string,
) {
	const parent = await prisma.constructionBudgetItem.findFirst({
		where: { id: parentId, ownerId, workId },
		select: { totalCost: true },
	});
	if (!parent) return null;

	const aggregate = await prisma.constructionBudgetItem.aggregate({
		where: {
			parentId,
			ownerId,
			workId,
			...(excludeId ? { id: { not: excludeId } } : {}),
		},
		_sum: { totalCost: true },
		_count: { _all: true },
	});

	return {
		parentTotalCost: roundCurrency(toFiniteNumber(parent.totalCost)),
		childrenTotalCost: roundCurrency(toFiniteNumber(aggregate._sum.totalCost)),
		childrenCount: aggregate._count._all,
	};
}

export async function getBudgetView(ownerId: string, workId: string) {
	const work = await getWorkById(ownerId, workId);
	if (!work) return null;

	const [physicalFinancial, measurementSummary] = await Promise.all([
		getPhysicalFinancialSchedule(ownerId, workId),
		getWorkMeasurementSummary(ownerId, workId),
	]);

	const rawItems = (work.items ?? []) as Array<Record<string, unknown>>;
	const itemsDto = rawItems.map(toBudgetItemDto);
	const tree = buildBudgetTree(
		itemsDto as unknown as Array<Record<string, unknown>>,
	);
	rollupBudgetTree(tree);
	const summary = calculateBudgetSummary(tree);

	const totalDirectCost = summary.totalBudgeted;
	const bdiPercentage = toFiniteNumber(
		(work as Record<string, unknown>).bdiPercentage,
	);
	const bdi = calculateBdi(totalDirectCost, bdiPercentage);
	const hasOperationalMeasurements = measurementSummary.measurementCount > 0;
	const totalMeasured = hasOperationalMeasurements
		? measurementSummary.totalMeasured
		: toFiniteNumber((work as Record<string, unknown>).earnedValue);

	return {
		work: {
			id: work.id,
			code: work.code,
			name: work.name,
			clientName: work.clientName,
			plannedStart: work.plannedStart,
			plannedEnd: work.plannedEnd,
			baseDate: work.baseDate,
			areaM2: work.areaM2,
			operationalStatus: work.operationalStatus,
			responsibleName: work.responsibleName,
			bdiPercentage: bdi.bdiPercentage,
		},
		items: tree,
		summary: {
			totalBudgeted: summary.totalBudgeted,
			totalDirectCost: bdi.totalDirectCost,
			bdiPercentage: bdi.bdiPercentage,
			bdiValue: bdi.bdiValue,
			totalFinalPrice: bdi.totalFinalPrice,
			totalMeasured,
			balanceToMeasure: summary.totalBudgeted - totalMeasured,
			measurementCount: hasOperationalMeasurements
				? measurementSummary.measurementCount
				: toFiniteNumber(
						((work as Record<string, unknown>).measurements as Array<unknown>)
							?.length ?? 0,
					),
			actualCostCount: (work.actualCosts ?? []).length,
		},
		schedule: {
			baselineSchedules: work.baselineSchedules,
			scheduleRevisions: work.scheduleRevisions,
		},
		physicalFinancial,
	};
}

export async function getBudgetItemDetail(
	ownerId: string,
	workId: string,
	itemId: string,
) {
	const item = await prisma.constructionBudgetItem.findFirst({
		where: { id: itemId, ownerId, workId },
		include: {
			parent: {
				select: { id: true, index: true, description: true, parentId: true },
			},
			children: { orderBy: { sortOrder: "asc" } },
			baselineSchedules: {
				select: {
					id: true,
					index: true,
					plannedStart: true,
					plannedEnd: true,
					plannedWeight: true,
				},
			},
			scheduleRevisions: {
				select: {
					id: true,
					index: true,
					version: true,
					replannedStart: true,
					replannedEnd: true,
				},
			},
			workMeasurementItems: {
				where: { measurement: { status: "ACEITO" } },
				include: {
					measurement: {
						select: {
							id: true,
							number: true,
							date: true,
							title: true,
						},
					},
				},
			},
			contractServices: {
				include: {
					contract: {
						select: {
							id: true,
							code: true,
							supplierName: true,
							title: true,
							status: true,
						},
					},
				},
			},
		},
	});

	if (!item) return null;

	const orderedMeasurements = [...item.workMeasurementItems].sort((a, b) => {
		const left = a.measurement.date
			? new Date(a.measurement.date).getTime()
			: 0;
		const right = b.measurement.date
			? new Date(b.measurement.date).getTime()
			: 0;
		return left - right;
	});

	const last = orderedMeasurements[orderedMeasurements.length - 1];
	const lastAccumulatedValue = toFiniteNumber(
		last?.accumulatedValue ?? last?.measuredValue,
	);
	const lastAccumulatedPercentage = toFiniteNumber(
		last?.accumulatedPercentage ?? last?.measuredPercentage,
	);
	const lastCurrentValue = toFiniteNumber(last?.measuredValue);
	const lastCurrentPercentage = toFiniteNumber(last?.measuredPercentage);

	const budgeted = toFiniteNumber(item.totalCost);
	const balance = budgeted - lastAccumulatedValue;

	return {
		item: toBudgetItemDto(item as unknown as Record<string, unknown>),
		parent: item.parent,
		children: buildBudgetTree(
			(item.children as unknown as Array<Record<string, unknown>>) ?? [],
		),
		schedule: {
			baselineSchedules: item.baselineSchedules,
			scheduleRevisions: item.scheduleRevisions,
		},
		workMeasurements: orderedMeasurements,
		contractServices: item.contractServices,
		totals: {
			budgeted,
			measuredCurrent: {
				quantity: toFiniteNumber(last?.measuredQuantity),
				value: lastCurrentValue,
				percentage: lastCurrentPercentage,
			},
			measuredAccumulated: {
				quantity: toFiniteNumber(
					last?.accumulatedQuantity ?? last?.measuredQuantity,
				),
				value: lastAccumulatedValue,
				percentage: lastAccumulatedPercentage,
			},
			balance: {
				quantity:
					toFiniteNumber(item.quantity) -
					toFiniteNumber(last?.accumulatedQuantity ?? last?.measuredQuantity),
				value: balance,
				percentage: budgeted > 0 ? (balance / budgeted) * 100 : 0,
			},
		},
	};
}

export async function createBudgetItem(
	ownerId: string,
	workId: string,
	input: CreateBudgetItemInput,
) {
	const importId = await ensureActiveImport(ownerId, workId);
	const payload = normalizeBudgetItemInput(input);
	const workDelegate = (
		prisma as unknown as {
			constructionWork?: {
				findUnique?: (
					args: unknown,
				) => Promise<{ workspaceId?: string | null } | null>;
			};
		}
	).constructionWork;
	const work = workDelegate?.findUnique
		? await workDelegate.findUnique({
				where: { id: workId },
				select: { workspaceId: true },
			})
		: null;

	return prisma.constructionBudgetItem.create({
		data: {
			ownerId,
			workspaceId: work?.workspaceId ?? (await getWorkspaceIdForUser(ownerId)),
			workId,
			importId,
			...payload,
		},
	});
}

export async function updateBudgetItem(
	ownerId: string,
	workId: string,
	itemId: string,
	input: UpdateBudgetItemInput,
) {
	const existing = await prisma.constructionBudgetItem.findFirst({
		where: { id: itemId, ownerId, workId },
	});
	if (!existing) return null;

	const payload = normalizeBudgetItemInput({
		parentId: input.parentId ?? existing.parentId,
		index: (input.index ?? existing.index) as string,
		type: (input.type ?? existing.type) as CreateBudgetItemInput["type"],
		description: input.description ?? existing.description,
		unit: input.unit ?? existing.unit,
		quantity: input.quantity ?? toNullableNumber(existing.quantity),
		laborUnitCost:
			input.laborUnitCost ?? toNullableNumber(existing.laborUnitCost),
		materialUnitCost:
			input.materialUnitCost ?? toNullableNumber(existing.materialUnitCost),
		equipmentUnitCost:
			input.equipmentUnitCost ?? toNullableNumber(existing.equipmentUnitCost),
		otherUnitCost:
			input.otherUnitCost ?? toNullableNumber(existing.otherUnitCost),
		unitCost: input.unitCost ?? toNullableNumber(existing.unitCost),
		totalCost: input.totalCost ?? toNullableNumber(existing.totalCost),
		plannedStart:
			input.plannedStart ??
			(existing.plannedStart ? existing.plannedStart.toISOString() : null),
		plannedEnd:
			input.plannedEnd ??
			(existing.plannedEnd ? existing.plannedEnd.toISOString() : null),
		actualStart:
			input.actualStart ??
			(existing.actualStart ? existing.actualStart.toISOString() : null),
		actualEnd:
			input.actualEnd ??
			(existing.actualEnd ? existing.actualEnd.toISOString() : null),
		completionPercentage:
			input.completionPercentage ?? Number(existing.completionPercentage ?? 0),
		providedStatus: input.providedStatus ?? existing.providedStatus,
		sortOrder: input.sortOrder ?? existing.sortOrder,
	});

	return prisma.constructionBudgetItem.update({
		where: { id: itemId, ownerId },
		data: payload,
	});
}

export async function deleteBudgetItem(
	ownerId: string,
	workId: string,
	itemId: string,
) {
	const item = await prisma.constructionBudgetItem.findFirst({
		where: { id: itemId, ownerId, workId },
		include: { children: { select: { id: true } } },
	});
	if (!item) return null;
	if (item.children.length > 0) {
		throw new ConstructionError(
			"HAS_DEPENDENCIES",
			"Não é possível excluir etapa com itens vinculados. Exclua os itens primeiro.",
			409,
		);
	}

	const references = await countItemReferences(ownerId, itemId);
	if (references > 0) {
		throw new ConstructionError(
			"ITEM_REFERENCED",
			"Não é possível excluir item referenciado por medição, contrato, custo ou cronograma",
			409,
		);
	}

	await prisma.constructionBudgetItem.delete({
		where: { id: itemId, ownerId },
	});
	return item;
}

async function countItemReferences(_ownerId: string, itemId: string) {
	const [
		measurements,
		contractServices,
		actualCosts,
		allocations,
		baselines,
		revisions,
	] = await Promise.all([
		prisma.workMeasurementItem.count({
			where: { budgetItemId: itemId },
		}),
		prisma.contractService.count({
			where: { budgetItemId: itemId },
		}),
		prisma.constructionActualCost.count({
			where: { budgetItemId: itemId },
		}),
		prisma.actualCostAllocation.count({
			where: { budgetItemId: itemId },
		}),
		prisma.constructionBaselineSchedule.count({
			where: { budgetItemId: itemId },
		}),
		prisma.constructionScheduleRevision.count({
			where: { budgetItemId: itemId },
		}),
	]);
	return (
		measurements +
		contractServices +
		actualCosts +
		allocations +
		baselines +
		revisions
	);
}

export async function reorderBudgetItems(
	ownerId: string,
	workId: string,
	input: ReorderBudgetItemsInput["items"],
) {
	const existing = await prisma.constructionBudgetItem.findMany({
		where: { ownerId, workId, id: { in: input.map((item) => item.id) } },
		select: { id: true },
	});

	if (existing.length !== input.length) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Item de orcamento nao encontrado",
			404,
		);
	}

	await prisma.$transaction(
		input.map((item) =>
			prisma.constructionBudgetItem.update({
				where: { id: item.id, ownerId },
				data: { sortOrder: item.sortOrder },
			}),
		),
	);

	return { count: input.length };
}

export { buildBudgetTree, rollupBudgetTree };
