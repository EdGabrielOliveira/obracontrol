import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../../lib/errors";
import { buildPaginatedResponse } from "../../../lib/pagination";
import { pickDefined } from "../../../lib/pick-defined";
import { prisma } from "../../../lib/prisma";
import type { NormalizedAllocation } from "../budget-control/budget-control.types";
import { ancestorIndexesOf } from "../imports/index-helpers";
import { normalizeCostType } from "../imports/normalizers";
import type {
	ActualCostFilter,
	CreateActualCostInput,
	CreateMeasurementInput,
	ImportActualCostRow,
	UpdateActualCostInput,
} from "../schema";

type AllocationClient = Pick<
	Prisma.TransactionClient,
	"constructionBudgetItem"
>;

type CostClient = Pick<
	Prisma.TransactionClient,
	| "constructionWork"
	| "constructionBudgetItem"
	| "constructionActualCost"
	| "budgetVersionItem"
>;

async function findBudgetItemIds(
	client: Pick<Prisma.TransactionClient, "constructionBudgetItem">,
	ownerId: string,
	workId: string,
	importId: string | null,
	indexes: string[],
): Promise<Map<string, string>> {
	const indexToId = new Map<string, string>();
	if (!importId || indexes.length === 0) return indexToId;
	const items = await client.constructionBudgetItem.findMany({
		where: { ownerId, workId, importId, index: { in: indexes } },
		select: { id: true, index: true },
	});
	for (const item of items) {
		if (!indexToId.has(item.index)) indexToId.set(item.index, item.id);
	}
	return indexToId;
}

function closestBudgetItemIdFor(
	index: string,
	indexToId: Map<string, string>,
): string | null {
	for (const candidate of [index, ...ancestorIndexesOf(index)]) {
		const id = indexToId.get(candidate);
		if (id) return id;
	}
	return null;
}

function budgetLookupIndexes(indexes: string[]): string[] {
	return [
		...new Set(
			indexes.flatMap((index) => [index, ...ancestorIndexesOf(index)]),
		),
	];
}

type AllocationBasis = { percentage?: number; value?: number };

function allocationBasisCount(allocation: AllocationBasis): number {
	return [allocation.percentage, allocation.value].filter(
		(v) => v !== undefined,
	).length;
}

function allocationValue(amount: number, allocation: AllocationBasis): number {
	if (allocation.value !== undefined) return allocation.value;
	const raw = (amount * (allocation.percentage ?? 0)) / 100;
	return Math.round(raw * 100) / 100;
}

function allocationPercentage(
	amount: number,
	allocation: AllocationBasis,
): number {
	if (allocation.percentage !== undefined) return allocation.percentage;
	if (amount > 0) {
		const raw = ((allocation.value ?? 0) / amount) * 100;
		return Math.round(raw * 100) / 100;
	}
	return 0;
}

async function validateAllocations(
	client: AllocationClient,
	ownerId: string,
	workId: string,
	allocations: NonNullable<CreateActualCostInput["allocations"]>,
	amount?: number,
) {
	const allocBudgetItemIds = allocations.map((a) => a.budgetItemId);
	const validItems = await client.constructionBudgetItem.findMany({
		where: { id: { in: allocBudgetItemIds }, ownerId, workId },
		select: { id: true },
	});
	const validIds = new Set(validItems.map((i) => i.id));
	const invalidIds = allocBudgetItemIds.filter((id) => !validIds.has(id));
	if (invalidIds.length > 0) {
		throw new ConstructionError(
			"INVALID_INPUT",
			`Itens de orçamento nao encontrados: ${invalidIds.join(", ")}`,
			400,
		);
	}
	const usesValue = allocations.some(
		(a) => allocationBasisCount(a) > 0 && a.value !== undefined,
	);
	const usesPercentage = allocations.some(
		(a) => allocationBasisCount(a) > 0 && a.percentage !== undefined,
	);
	if (usesValue && usesPercentage) {
		throw new ConstructionError(
			"INVALID_INPUT",
			"Informe apenas uma base de alocação por custo (percentual ou valor)",
			400,
		);
	}
	const hasMixedBasis = allocations.some((a) => allocationBasisCount(a) !== 1);
	if (hasMixedBasis) {
		throw new ConstructionError(
			"INVALID_INPUT",
			"Cada alocação deve informar apenas uma base (percentual ou valor)",
			400,
		);
	}
	if (usesValue) {
		if (amount !== undefined) {
			const total = allocations.reduce((sum, a) => sum + (a.value ?? 0), 0);
			if (Math.abs(total - amount) > 0.1) {
				throw new ConstructionError(
					"INVALID_INPUT",
					"A soma das alocações não corresponde ao total do custo",
					400,
				);
			}
		}
		return;
	}
	const totalPct = allocations.reduce((sum, a) => sum + (a.percentage ?? 0), 0);
	if (totalPct < 99.9 || totalPct > 100.1) {
		throw new ConstructionError(
			"INVALID_INPUT",
			`A soma dos percentuais de alocacao deve ser aproximadamente 100% (atual: ${totalPct.toFixed(2)}%)`,
			400,
		);
	}
}

function persistedAllocationRows(
	amount: number,
	allocations: NonNullable<CreateActualCostInput["allocations"]>,
	normalized?: NormalizedAllocation[],
): Array<{
	budgetItemId: string;
	basis: "PERCENTAGE" | "VALUE";
	percentage: number;
	value: number;
}> {
	return allocations.map((allocation, index) => {
		const normalizedRow = normalized?.[index];
		const value =
			normalizedRow !== undefined
				? Number(normalizedRow.value)
				: allocationValue(amount, allocation);
		const percentage =
			allocation.percentage !== undefined
				? allocation.percentage
				: (normalizedRow?.percentage ??
					allocationPercentage(amount, allocation));
		return {
			budgetItemId: allocation.budgetItemId,
			basis: allocation.percentage !== undefined ? "PERCENTAGE" : "VALUE",
			percentage,
			value,
		};
	});
}

function measurementCreateData(
	ownerId: string,
	workId: string,
	importId: string | null,
	itemId: string,
	input: CreateMeasurementInput,
): Prisma.ConstructionMeasurementCreateInput {
	return {
		ownerId,
		work: { connect: { id: workId, ownerId } },
		...(importId
			? { import: { connect: { id: importId, ownerId, workId } } }
			: {}),
		budgetItem: { connect: { id: itemId, ownerId, workId } },
		index: input.index,
		title: input.title ?? null,
		measurementDate: new Date(input.measurementDate),
		measuredPercentageAccumulated: input.measuredPercentageAccumulated ?? 0,
		measuredQuantityAccumulated: input.measuredQuantityAccumulated ?? null,
		measuredValue: input.measuredValue ?? null,
		status: input.status ?? "RASCUNHO",
		notes: input.notes ?? null,
	};
}

function actualCostCreateData(
	ownerId: string,
	workId: string,
	importId: string | null,
	budgetItemId: string | null,
	input: ImportActualCostRow,
	normalized?: NormalizedAllocation[],
): Prisma.ConstructionActualCostCreateInput {
	const allocations = input.allocations;
	const hasAllocations = allocations !== undefined && allocations.length > 0;
	const amount = Number(input.amount);

	return {
		ownerId,
		work: { connect: { id: workId, ownerId } },
		...(input.budgetVersionItemId
			? { budgetVersionItem: { connect: { id: input.budgetVersionItemId } } }
			: {}),
		...(importId
			? { import: { connect: { id: importId, ownerId, workId } } }
			: {}),
		...(budgetItemId
			? { budgetItem: { connect: { id: budgetItemId, ownerId, workId } } }
			: {}),
		costDate: new Date(input.costDate),
		budgetIndex: input.budgetIndex ?? null,
		category: input.category,
		categoryDetail: input.categoryDetail ?? null,
		description: input.description ?? null,
		amount: input.amount,
		costType: normalizeCostType(input.costType) ?? input.costType,
		sourceDocument: input.sourceDocument ?? null,
		supplier: input.supplierId
			? { connect: { id: input.supplierId } }
			: undefined,
		appropriationStatus:
			hasAllocations || budgetItemId ? "APPROPRIATED" : "UNAPPROPRIATED",
		supplierName: input.supplierName ?? null,
		costGroup: input.costGroup ?? null,
		paymentStatus: input.paymentStatus,
		allocations: hasAllocations
			? {
					create: persistedAllocationRows(
						amount,
						allocations as NonNullable<CreateActualCostInput["allocations"]>,
						normalized,
					).map((row) => ({ ownerId, ...row })),
				}
			: undefined,
	};
}

async function validateBudgetVersionItemScope(
	client: CostClient,
	ownerId: string,
	workId: string,
	budgetVersionItemId: string | undefined,
) {
	if (!budgetVersionItemId) return;
	const item = await client.budgetVersionItem.findFirst({
		where: {
			id: budgetVersionItemId,
			version: { ownerId, workId, isActive: true },
			children: { none: {} },
		},
		select: { id: true, unitCost: true },
	});
	if (!item) {
		throw new ConstructionError(
			"BUDGET_ITEM_WRONG_WORK",
			"Item da versao orcamentaria nao pertence a esta obra",
			422,
		);
	}
	if (item.unitCost == null) {
		throw new ConstructionError(
			"BUDGET_VERSION_NOT_AVAILABLE",
			"Item da versao orcamentaria sem custo unitario",
			422,
		);
	}
}

export async function createMeasurement(
	ownerId: string,
	workId: string,
	importId: string | null,
	input: CreateMeasurementInput,
) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { activeImportId: true },
	});
	const item = work?.activeImportId
		? await prisma.constructionBudgetItem.findFirst({
				where: {
					ownerId,
					workId,
					importId: work.activeImportId,
					index: input.index,
				},
				select: { id: true },
			})
		: null;
	if (!item)
		throw new ConstructionError(
			"NOT_FOUND",
			"Item de orcamento nao encontrado para o indice informado",
			404,
		);

	return prisma.constructionMeasurement.create({
		data: measurementCreateData(ownerId, workId, importId, item.id, input),
	});
}

export async function importMeasurements(
	ownerId: string,
	workId: string,
	rows: CreateMeasurementInput[],
) {
	return prisma.$transaction(async (tx) => {
		const work = await tx.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const indexToId = await findBudgetItemIds(
			tx,
			ownerId,
			workId,
			work.activeImportId,
			budgetLookupIndexes(rows.map((input) => input.index)),
		);

		const results = [];
		for (const input of rows) {
			const itemId = closestBudgetItemIdFor(input.index, indexToId);
			if (!itemId) {
				throw new ConstructionError(
					"NOT_FOUND",
					`Item de orcamento nao encontrado para o indice ${input.index}`,
					404,
				);
			}
			results.push(
				await tx.constructionMeasurement.create({
					data: measurementCreateData(
						ownerId,
						workId,
						work.activeImportId,
						itemId,
						{ ...input, status: "ACEITO" },
					),
				}),
			);
		}
		return results;
	});
}

export async function listMeasurements(ownerId: string, workId: string) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { activeImportId: true },
	});
	const where = work?.activeImportId
		? {
				OR: [
					{ ownerId, workId, importId: work.activeImportId },
					{ ownerId, workId, importId: null },
				],
			}
		: { ownerId, workId, importId: null };

	return prisma.constructionMeasurement.findMany({
		where,
		orderBy: { measurementDate: "asc" },
	});
}

export async function deleteMeasurement(
	ownerId: string,
	workId: string,
	measurementId: string,
) {
	const item = await prisma.constructionMeasurement.findFirst({
		where: { id: measurementId, ownerId, workId },
	});
	if (!item) return null;
	await prisma.constructionMeasurement.delete({
		where: { id: measurementId, ownerId, workId },
	});
	return item;
}

export async function createActualCost(
	ownerId: string,
	workId: string,
	importId: string | null,
	input: CreateActualCostInput,
	client: CostClient = prisma,
	normalized?: NormalizedAllocation[],
) {
	let budgetItemId: string | null = null;
	if (input.budgetIndex) {
		const work = await client.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		if (work?.activeImportId) {
			const item = await client.constructionBudgetItem.findFirst({
				where: {
					ownerId,
					workId,
					importId: work.activeImportId,
					index: input.budgetIndex,
				},
				select: { id: true },
			});
			budgetItemId = item?.id ?? null;
		}
	}

	const allocations = input.allocations;
	await validateBudgetVersionItemScope(
		client,
		ownerId,
		workId,
		input.budgetVersionItemId,
	);
	if (allocations && allocations.length > 0) {
		await validateAllocations(
			client,
			ownerId,
			workId,
			allocations,
			Number(input.amount),
		);
	}

	return client.constructionActualCost.create({
		data: actualCostCreateData(
			ownerId,
			workId,
			importId,
			budgetItemId,
			input,
			normalized,
		),
		include: { allocations: true },
	});
}

export async function importActualCosts(
	ownerId: string,
	workId: string,
	rows: ImportActualCostRow[],
) {
	return prisma.$transaction(async (tx) => {
		const work = await tx.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const indexToId = await findBudgetItemIds(
			tx,
			ownerId,
			workId,
			work.activeImportId,
			budgetLookupIndexes(
				rows.flatMap((input) => (input.budgetIndex ? [input.budgetIndex] : [])),
			),
		);

		const results = [];
		for (const input of rows) {
			await validateBudgetVersionItemScope(
				tx,
				ownerId,
				workId,
				input.budgetVersionItemId,
			);
			let budgetItemId: string | null = null;
			if (input.budgetIndex) {
				budgetItemId = closestBudgetItemIdFor(input.budgetIndex, indexToId);
				if (!budgetItemId) {
					throw new ConstructionError(
						"NOT_FOUND",
						`Item de orcamento nao encontrado para o indice ${input.budgetIndex}`,
						404,
					);
				}
			}

			const allocations = input.allocations;
			if (allocations && allocations.length > 0) {
				await validateAllocations(tx, ownerId, workId, allocations);
			}

			results.push(
				await tx.constructionActualCost.create({
					data: actualCostCreateData(
						ownerId,
						workId,
						work.activeImportId,
						budgetItemId,
						input,
					),
					include: { allocations: true },
				}),
			);
		}
		return results;
	});
}

export async function listActualCosts(
	ownerId: string,
	workId: string,
	filters: Partial<ActualCostFilter> = {},
) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { activeImportId: true },
	});
	const conditions: Prisma.ConstructionActualCostWhereInput[] = [
		{ ownerId, workId },
		work?.activeImportId
			? { OR: [{ importId: work.activeImportId }, { importId: null }] }
			: { importId: null },
	];

	if (filters.category) conditions.push({ category: filters.category });
	if (filters.supplierName)
		conditions.push({
			supplierName: { contains: filters.supplierName },
		});
	if (filters.status) conditions.push({ paymentStatus: filters.status });
	if (filters.costType) {
		const normalizedCostType = normalizeCostType(filters.costType);
		if (normalizedCostType) conditions.push({ costType: normalizedCostType });
	}
	if (filters.q) {
		conditions.push({
			OR: [
				{ description: { contains: filters.q } },
				{ supplierName: { contains: filters.q } },
			],
		});
	}
	if (filters.startDate || filters.endDate) {
		const dateFilter: Record<string, Date> = {};
		if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
		if (filters.endDate) dateFilter.lte = new Date(filters.endDate);
		conditions.push({ costDate: dateFilter });
	}

	const where: Prisma.ConstructionActualCostWhereInput = { AND: conditions };

	const page = filters.page ?? 1;
	const limit = filters.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.constructionActualCost.findMany({
			where,
			orderBy: { costDate: "asc" },
			skip: (page - 1) * limit,
			take: limit,
			include: actualCostInclude,
		}),
		prisma.constructionActualCost.count({
			where,
		}),
	]);

	const approvalRequests = data.length
		? await prisma.approvalRequest.findMany({
				where: {
					resourceType: "ACTUAL_COST",
					resourceId: { in: data.map((cost) => cost.id) },
				},
				select: {
					id: true,
					resourceId: true,
					status: true,
					requiredApproverRole: true,
					createdAt: true,
				},
				orderBy: { createdAt: "desc" },
			})
		: [];
	const latestApprovalByCostId = new Map<
		string,
		(typeof approvalRequests)[number]
	>();
	for (const request of approvalRequests) {
		if (request.resourceId && !latestApprovalByCostId.has(request.resourceId)) {
			latestApprovalByCostId.set(request.resourceId, request);
		}
	}
	const dataWithApproval = data.map((cost) => {
		const approval = latestApprovalByCostId.get(cost.id);
		return {
			...cost,
			approval: approval
				? {
						requestId: approval.id,
						status: approval.status,
						requiredApproverRole: approval.requiredApproverRole,
						createdAt: approval.createdAt.toISOString(),
					}
				: null,
		};
	});

	return buildPaginatedResponse(dataWithApproval, total, page, limit);
}

const actualCostInclude = {
	allocations: {
		include: {
			budgetItem: {
				select: {
					id: true,
					index: true,
					type: true,
					description: true,
					unit: true,
				},
			},
		},
	},
	supplier: { select: { id: true, name: true } },
} satisfies Prisma.ConstructionActualCostInclude;

export async function deleteActualCost(
	ownerId: string,
	workId: string,
	costId: string,
	client: CostClient = prisma,
) {
	const item = await client.constructionActualCost.findFirst({
		where: { id: costId, ownerId, workId },
	});
	if (!item) return null;
	await client.constructionActualCost.delete({
		where: { id: costId, ownerId, workId },
	});
	return item;
}

export async function getActualCostById(
	ownerId: string,
	workId: string,
	costId: string,
	client: CostClient = prisma,
) {
	return client.constructionActualCost.findFirst({
		where: { id: costId, ownerId, workId },
		include: actualCostInclude,
	});
}

export async function updateActualCost(
	ownerId: string,
	workId: string,
	costId: string,
	input: UpdateActualCostInput,
	client: CostClient = prisma,
	normalized?: NormalizedAllocation[],
) {
	const existing = await client.constructionActualCost.findFirst({
		where: { id: costId, ownerId, workId },
		include: { allocations: true },
	});
	if (!existing) return null;

	const updateData = pickDefined(input, [
		"costDate",
		"budgetIndex",
		"category",
		"categoryDetail",
		"description",
		"amount",
		"costType",
		"sourceDocument",
		"supplierId",
		"supplierName",
		"costGroup",
		"paymentStatus",
	] as (keyof typeof input)[]);
	if (input.costDate !== undefined)
		(updateData as Record<string, unknown>).costDate = new Date(input.costDate);

	const amount = input.amount ?? existing.amount;
	const allocs = input.allocations;

	if (allocs !== undefined && allocs.length > 0) {
		const allocBudgetItemIds = allocs.map((a) => a.budgetItemId);
		const validItems = await client.constructionBudgetItem.findMany({
			where: { id: { in: allocBudgetItemIds }, ownerId, workId },
			select: { id: true },
		});
		const validIds = new Set(validItems.map((i) => i.id));
		const invalidIds = allocBudgetItemIds.filter((id) => !validIds.has(id));
		if (invalidIds.length > 0) {
			throw new ConstructionError(
				"INVALID_INPUT",
				`Itens de orçamento nao encontrados: ${invalidIds.join(", ")}`,
				400,
			);
		}
		await validateAllocations(client, ownerId, workId, allocs, Number(amount));
		(updateData as Record<string, unknown>).allocations = {
			deleteMany: {},
			create: persistedAllocationRows(Number(amount), allocs, normalized).map(
				(row) => ({ ownerId, ...row }),
			),
		};
	} else if (allocs !== undefined) {
		(updateData as Record<string, unknown>).allocations = {
			deleteMany: {},
		};
	} else if (normalized !== undefined && normalized.length > 0) {
		(updateData as Record<string, unknown>).allocations = {
			deleteMany: {},
			create: normalized.map((row) => ({
				ownerId,
				budgetItemId: row.budgetItemId,
				basis: row.basis,
				percentage: row.percentage,
				value: Number(row.value),
			})),
		};
	} else if (input.amount !== undefined && existing.allocations.length > 0) {
		const scale = Number(amount) / Number(existing.amount);
		(updateData as Record<string, unknown>).allocations = {
			updateMany: existing.allocations.map((a) => ({
				where: { id: a.id },
				data: { value: Math.round(Number(a.value) * scale * 100) / 100 },
			})),
		};
	}

	if (input.allocations !== undefined || input.amount !== undefined) {
		const status =
			allocs !== undefined && allocs.length > 0
				? "APPROPRIATED"
				: input.budgetIndex !== undefined
					? "APPROPRIATED"
					: existing.allocations.length > 0 || existing.budgetIndex
						? "APPROPRIATED"
						: "UNAPPROPRIATED";
		(updateData as Record<string, unknown>).appropriationStatus = status;
	}

	return client.constructionActualCost.update({
		where: { id: costId, ownerId },
		data: updateData as Record<string, unknown>,
		include: { allocations: true },
	});
}
