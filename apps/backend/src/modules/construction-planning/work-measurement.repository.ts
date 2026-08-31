import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { roundCurrency } from "../../lib/math-utils";
import { fillMonthGaps, monthKey } from "../../lib/month-utils";
import { toFiniteNumber } from "../../lib/number-utils";
import { buildPaginatedResponse } from "../../lib/pagination";
import { prisma } from "../../lib/prisma";
import { composeMeasurementInputs } from "./bi/execution-facts";
import { toWorkMeasurementDto } from "./dto/financial-dto";
import { nextMeasurementNumber } from "./measurement-common";
import type {
	CreateWorkMeasurementInput,
	UpdateWorkMeasurementInput,
} from "./schemas/work-measurement.schema";

async function resolveCreatorNames(
	rows: Array<{ createdBy?: string | null }>,
): Promise<Map<string, string>> {
	const ids = [
		...new Set(
			rows
				.map((row) => row.createdBy)
				.filter((id): id is string => Boolean(id)),
		),
	];
	if (ids.length === 0) return new Map();
	const users = await prisma.user.findMany({
		where: { id: { in: ids } },
		select: { id: true, name: true },
	});
	return new Map(users.map((user) => [user.id, user.name]));
}

function sumLeafBudgetItems(
	items: Array<{ id: string; parentId: string | null; totalCost: unknown }>,
): number {
	const hasChildren = new Set(
		items.map((item) => item.parentId).filter(Boolean),
	);
	return items.reduce(
		(sum, item) =>
			hasChildren.has(item.id) ? sum : sum + toFiniteNumber(item.totalCost),
		0,
	);
}

async function getActiveBudgetImportId(ownerId: string, workId: string) {
	const work = await prisma.constructionWork.findFirst({
		where: { ownerId, id: workId },
		select: { activeImportId: true },
	});
	if (work?.activeImportId) return work.activeImportId;

	// Obras antigas não tinham activeImportId preenchido. Nesse caso, a
	// importação mais recente é a versão vigente usada pelo restante do BI.
	const latestImport = await (
		prisma.constructionImport as typeof prisma.constructionImport | undefined
	)?.findFirst({
		where: { ownerId, workId },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});
	return latestImport?.id ?? "__NO_ACTIVE_IMPORT__";
}

export async function listWorkMeasurements(
	ownerId: string,
	workId: string,
	filters?: { q?: string; page?: number; limit?: number },
) {
	const where: Prisma.WorkMeasurementWhereInput = { ownerId, workId };
	if (filters?.q) {
		where.OR = [
			{ title: { contains: filters.q } },
			{ notes: { contains: filters.q } },
		];
	}

	const page = filters?.page ?? 1;
	const limit = filters?.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.workMeasurement.findMany({
			where,
			include: { items: true },
			orderBy: { date: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.workMeasurement.count({ where }),
	]);

	const dataWithValue = data.map((m) =>
		toWorkMeasurementDto(
			m as unknown as Record<string, unknown>,
			m.items as unknown as Array<Record<string, unknown>>,
		),
	);
	const creatorNames = await resolveCreatorNames(data);

	return buildPaginatedResponse(
		dataWithValue.map((dto) => ({
			...dto,
			createdByName: creatorNames.get(String(dto.createdBy ?? "")) ?? null,
		})),
		total,
		page,
		limit,
	);
}

export async function getWorkMeasurementById(
	ownerId: string,
	workId: string,
	measurementId: string,
) {
	return prisma.workMeasurement.findFirst({
		where: { id: measurementId, ownerId, workId },
		include: { items: true },
	});
}

export async function getBudgetItemTotals(
	ownerId: string,
	workId: string,
	budgetItemIds: string[],
	tx?: Prisma.TransactionClient,
): Promise<Record<string, number>> {
	const ids = [...new Set(budgetItemIds)];
	if (ids.length === 0) return {};
	const db = tx ?? prisma;
	const items = await db.constructionBudgetItem.findMany({
		where: { id: { in: ids }, ownerId, workId },
		select: { id: true, totalCost: true },
	});
	return Object.fromEntries(
		items.map((item) => [item.id, toFiniteNumber(item.totalCost)]),
	);
}

export async function getBudgetItemConsumption(
	ownerId: string,
	workId: string,
	budgetItemIds: string[],
	tx?: Prisma.TransactionClient,
): Promise<Record<string, number>> {
	const ids = [...new Set(budgetItemIds)];
	if (ids.length === 0) return {};
	const db = tx ?? prisma;
	const rows = await db.workMeasurementItem.findMany({
		where: {
			budgetItemId: { in: ids },
			measurement: { ownerId, workId },
		},
		select: {
			budgetItemId: true,
			accumulatedValue: true,
			measuredValue: true,
			measurement: { select: { date: true, number: true } },
		},
	});
	const consumed: Record<string, number> = {};
	const rowsByBudgetItem = new Map<string, typeof rows>();
	for (const row of rows) {
		const itemRows = rowsByBudgetItem.get(row.budgetItemId) ?? [];
		itemRows.push(row);
		rowsByBudgetItem.set(row.budgetItemId, itemRows);
	}
	for (const [budgetItemId, itemRows] of rowsByBudgetItem) {
		const last = [...itemRows].sort((a, b) => {
			const left = new Date(a.measurement.date).getTime();
			const right = new Date(b.measurement.date).getTime();
			return right - left || b.measurement.number - a.measurement.number;
		})[0];
		consumed[budgetItemId] =
			last?.accumulatedValue != null
				? toFiniteNumber(last.accumulatedValue)
				: itemRows.reduce((sum, r) => sum + toFiniteNumber(r.measuredValue), 0);
	}
	return consumed;
}

export async function getLatestWorkMeasurementQuantities(
	ownerId: string,
	workId: string,
	budgetItemIds: string[],
	tx?: Prisma.TransactionClient,
	excludeMeasurementId?: string,
): Promise<Record<string, Decimal>> {
	const ids = [...new Set(budgetItemIds)];
	const quantities = Object.fromEntries(ids.map((id) => [id, new Decimal(0)]));
	if (ids.length === 0) return quantities;

	const db = tx ?? prisma;
	const rows = await db.workMeasurementItem.findMany({
		where: {
			budgetItemId: { in: ids },
			measurement: {
				ownerId,
				workId,
				status: "ACEITO",
				archivedAt: null,
				...(excludeMeasurementId ? { id: { not: excludeMeasurementId } } : {}),
			},
		},
		select: {
			budgetItemId: true,
			measuredQuantity: true,
			accumulatedQuantity: true,
			measurement: { select: { date: true, number: true } },
		},
	});

	const rowsByBudgetItem = new Map<string, typeof rows>();
	for (const row of rows) {
		const itemRows = rowsByBudgetItem.get(row.budgetItemId) ?? [];
		itemRows.push(row);
		rowsByBudgetItem.set(row.budgetItemId, itemRows);
	}

	for (const [budgetItemId, itemRows] of rowsByBudgetItem) {
		const ordered = [...itemRows].sort((a, b) => {
			const dateOrder =
				new Date(b.measurement.date).getTime() -
				new Date(a.measurement.date).getTime();
			return dateOrder || b.measurement.number - a.measurement.number;
		});
		const latest = ordered[0];
		if (latest?.accumulatedQuantity != null) {
			quantities[budgetItemId] = new Decimal(latest.accumulatedQuantity);
			continue;
		}
		quantities[budgetItemId] = ordered.reduce(
			(sum, row) =>
				sum.plus(
					row.measuredQuantity == null ? 0 : new Decimal(row.measuredQuantity),
				),
			new Decimal(0),
		);
	}

	return quantities;
}

async function validateBudgetItemIds(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	budgetItemIds: string[],
) {
	const ids = [...new Set(budgetItemIds)];
	if (ids.length === 0) return;
	const validItems = await tx.constructionBudgetItem.findMany({
		where: { id: { in: ids }, ownerId, workId },
		select: { id: true },
	});
	const validIds = new Set(validItems.map((i) => i.id));
	const invalidIds = ids.filter((id) => !validIds.has(id));
	if (invalidIds.length > 0) {
		throw new ConstructionError(
			"INVALID_BUDGET_ITEM",
			"Itens de orcamento invalidos ou nao pertencem a obra",
			422,
		);
	}
}

type CreateWorkMeasurementInputWithAuthor = CreateWorkMeasurementInput & {
	createdBy?: string | null;
	status?: string;
};

type PersistedWorkMeasurementItem = {
	budgetItemId: string;
	measuredQuantity: number;
	measuredValue: number;
	measuredPercentage: number;
	accumulatedQuantity: number;
	accumulatedValue: number;
	accumulatedPercentage: number;
};

type CreateWorkMeasurementInputWithDerivedItems = Omit<
	CreateWorkMeasurementInputWithAuthor,
	"items"
> & {
	items: PersistedWorkMeasurementItem[];
};

async function createWorkMeasurementInTx(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	input: CreateWorkMeasurementInputWithDerivedItems,
) {
	const nextNumber = await nextMeasurementNumber(tx, "workMeasurement", {
		ownerId,
		workId,
	});

	const measurement = await tx.workMeasurement.create({
		data: {
			ownerId,
			workId,
			number: nextNumber,
			date: new Date(input.date),
			title: input.title ?? "",
			discountValue: null,
			retentionValue: null,
			balanceOverride: input.balanceOverride ?? false,
			evidenceNote: input.evidenceNote ?? null,
			createdBy: input.createdBy ?? null,
			notes: null,
			// Toda medição criada começa como rascunho. A aceitação é uma
			// transição explícita e atômica que materializa seus efeitos.
			status: "RASCUNHO",
		},
	});

	if (input.items.length > 0) {
		await validateBudgetItemIds(
			tx,
			ownerId,
			workId,
			input.items.map((i) => i.budgetItemId),
		);
	}

	await tx.workMeasurementItem.createMany({
		data: input.items.map((item) => ({
			measurementId: measurement.id,
			budgetItemId: item.budgetItemId,
			measuredQuantity: item.measuredQuantity ?? null,
			measuredValue: item.measuredValue ?? null,
			measuredPercentage: item.measuredPercentage,
			accumulatedQuantity: item.accumulatedQuantity ?? null,
			accumulatedValue: item.accumulatedValue ?? null,
			accumulatedPercentage: item.accumulatedPercentage,
		})),
	});

	return tx.workMeasurement.findFirst({
		where: { id: measurement.id },
		include: { items: true },
	});
}

export async function createWorkMeasurement(
	ownerId: string,
	workId: string,
	input: CreateWorkMeasurementInputWithDerivedItems,
	tx?: Prisma.TransactionClient,
) {
	if (tx) {
		return createWorkMeasurementInTx(tx, ownerId, workId, input);
	}
	return prisma.$transaction((t) =>
		createWorkMeasurementInTx(t, ownerId, workId, input),
	);
}

function toItemData(item: PersistedWorkMeasurementItem) {
	return {
		budgetItemId: item.budgetItemId,
		measuredQuantity: item.measuredQuantity,
		measuredValue: item.measuredValue,
		measuredPercentage: item.measuredPercentage,
		accumulatedQuantity: item.accumulatedQuantity,
		accumulatedValue: item.accumulatedValue,
		accumulatedPercentage: item.accumulatedPercentage,
	};
}

export async function updateWorkMeasurement(
	ownerId: string,
	workId: string,
	measurementId: string,
	input: Omit<UpdateWorkMeasurementInput, "items"> & {
		items?: PersistedWorkMeasurementItem[];
	},
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const existing = await db.workMeasurement.findFirst({
		where: { id: measurementId, ownerId, workId },
		include: { items: true },
	});
	if (!existing) return null;

	const execute = async (transaction: Prisma.TransactionClient) => {
		if (input.items) {
			await validateBudgetItemIds(
				transaction,
				ownerId,
				workId,
				input.items.map((i) => i.budgetItemId),
			);
		}

		const updateData: Record<string, unknown> = {};
		if (input.title !== undefined) updateData.title = input.title;
		if (input.date !== undefined) updateData.date = new Date(input.date);
		if (input.items) {
			updateData.balanceOverride = input.balanceOverride ?? false;
			updateData.evidenceNote = input.evidenceNote ?? null;
		}

		if (Object.keys(updateData).length > 0) {
			await transaction.workMeasurement.update({
				where: { id: measurementId, ownerId },
				data: updateData,
			});
		}

		if (input.items) {
			const existingByBudgetItemId = new Map(
				existing.items.map((item) => [item.budgetItemId, item]),
			);
			const payloadBudgetItemIds = new Set(
				input.items.map((item) => item.budgetItemId),
			);

			for (const payloadItem of input.items) {
				const existingItem = existingByBudgetItemId.get(
					payloadItem.budgetItemId,
				);
				if (existingItem) {
					await transaction.workMeasurementItem.update({
						where: { id: existingItem.id },
						data: toItemData(payloadItem),
					});
				} else {
					await transaction.workMeasurementItem.create({
						data: {
							measurementId,
							...toItemData(payloadItem),
						},
					});
				}
			}

			for (const existingItem of existing.items) {
				if (!payloadBudgetItemIds.has(existingItem.budgetItemId)) {
					await transaction.workMeasurementItem.delete({
						where: { id: existingItem.id },
					});
				}
			}
		}

		return transaction.workMeasurement.findFirst({
			where: { id: measurementId },
			include: { items: true },
		});
	};

	if (tx) return execute(tx);
	return prisma.$transaction(execute);
}

export async function deleteWorkMeasurement(
	ownerId: string,
	workId: string,
	measurementId: string,
) {
	const item = await prisma.workMeasurement.findFirst({
		where: { id: measurementId, ownerId, workId },
	});
	if (!item) return null;
	await prisma.workMeasurement.delete({
		where: { id: measurementId, ownerId },
	});
	return item;
}

export async function updateWorkMeasurementStatus(
	ownerId: string,
	workId: string,
	measurementId: string,
	status: string,
	statusReason?: string | null,
	statusChangedBy?: string | null,
	tx?: Prisma.TransactionClient,
	expectedStatus?: string,
) {
	const db = tx ?? prisma;
	const result = await db.workMeasurement.updateMany({
		where: {
			id: measurementId,
			ownerId,
			workId,
			...(expectedStatus ? { status: expectedStatus } : {}),
		},
		data: {
			status,
			statusReason: statusReason ?? null,
			statusChangedAt: new Date(),
			archivedAt: status === "ARQUIVADO" ? new Date() : null,
			archivedBy: status === "ARQUIVADO" ? (statusChangedBy ?? null) : null,
		},
	});
	return result.count > 0;
}

/**
 * Compensates a create when D1's sequential transaction compatibility has
 * already persisted rows and a later side effect (for example audit) fails.
 * This is deliberately explicit and scoped to the measurement source; it is
 * not a replacement for converting the whole workflow to D1Database.batch().
 */
export async function rollbackWorkMeasurementCreation(
	ownerId: string,
	workId: string,
	measurementId: string,
) {
	await prisma.constructionLedgerEvent.deleteMany({
		where: {
			ownerId,
			workId,
			sourceType: "WORK_MEASUREMENT",
			sourceId: measurementId,
		},
	});
	await prisma.constructionBudgetImpact.deleteMany({
		where: {
			ownerId,
			workId,
			sourceType: "WORK_MEASUREMENT",
			sourceId: measurementId,
		},
	});
	await prisma.workMeasurement.deleteMany({
		where: { id: measurementId, ownerId, workId },
	});
}

export async function getWorkMeasurementMap(ownerId: string, workId: string) {
	const activeImportId = await getActiveBudgetImportId(ownerId, workId);
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true, code: true, name: true },
	});
	const items = await prisma.workMeasurementItem.findMany({
		where: {
			measurement: { ownerId, workId },
		},
		include: {
			budgetItem: {
				select: {
					id: true,
					index: true,
					description: true,
					type: true,
					quantity: true,
					totalCost: true,
				},
			},
		},
		orderBy: { budgetItem: { sortOrder: "asc" } },
	});

	const budgetItems = await prisma.constructionBudgetItem.findMany({
		where: { ownerId, workId, importId: activeImportId },
		select: {
			id: true,
			index: true,
			description: true,
			type: true,
			parentId: true,
			quantity: true,
			totalCost: true,
		},
		orderBy: { sortOrder: "asc" },
	});

	const measurementByBudget = new Map<string, (typeof items)[number]>();
	for (const item of items) {
		measurementByBudget.set(item.budgetItemId, item);
	}

	const totalBudgeted = sumLeafBudgetItems(
		budgetItems as Array<{
			id: string;
			parentId: string | null;
			totalCost: unknown;
		}>,
	);
	const totalMeasured = items.reduce(
		(sum, i) => sum + toFiniteNumber(i.accumulatedValue ?? i.measuredValue),
		0,
	);
	const totalMeasuredPct =
		totalBudgeted > 0 ? (totalMeasured / totalBudgeted) * 100 : 0;

	return {
		work,
		budgetSummary: {
			totalBudgeted,
			totalMeasured,
			totalMeasuredPercentage: totalMeasuredPct,
			balanceToMeasure: totalBudgeted - totalMeasured,
			balancePercentage:
				totalBudgeted > 0
					? ((totalBudgeted - totalMeasured) / totalBudgeted) * 100
					: 0,
			stages: budgetItems.map((bi) => {
				const totalCost = toFiniteNumber(bi.totalCost);
				const m = measurementByBudget.get(bi.id);
				const measured = toFiniteNumber(
					m?.accumulatedValue ?? m?.measuredValue,
				);
				return {
					id: bi.id,
					description: bi.description,
					type: bi.type,
					quantity: Number(bi.quantity ?? 0),
					totalValue: totalCost,
					measuredQuantity: Number(
						m?.accumulatedQuantity ?? m?.measuredQuantity ?? 0,
					),
					measuredValue: measured,
					measuredPercentage: totalCost > 0 ? (measured / totalCost) * 100 : 0,
					balanceQuantity:
						Number(bi.quantity ?? 0) -
						Number(m?.accumulatedQuantity ?? m?.measuredQuantity ?? 0),
					balanceValue: totalCost - measured,
					balancePercentage:
						totalCost > 0 ? ((totalCost - measured) / totalCost) * 100 : 0,
				};
			}),
		},
	};
}

function buildMeasurementTree(
	items: Array<
		{
			id: string;
			parentId: string | null;
			sortOrder: number;
			index: string;
		} & Record<string, unknown>
	>,
) {
	const nodes = new Map<
		string,
		(typeof items)[number] & { children: Array<(typeof items)[number]> }
	>();
	const roots: Array<
		(typeof items)[number] & { children: Array<(typeof items)[number]> }
	> = [];

	for (const item of items) {
		nodes.set(item.id, { ...item, children: [] });
	}

	for (const item of items) {
		const node = nodes.get(item.id);
		if (!node) continue;
		if (item.parentId && nodes.has(item.parentId)) {
			nodes.get(item.parentId)?.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortTree = (list: typeof roots) => {
		list.sort(
			(a, b) => a.sortOrder - b.sortOrder || a.index.localeCompare(b.index),
		);
		for (const item of list) sortTree(item.children as typeof roots);
	};

	sortTree(roots);
	return roots;
}

function rollupMeasurementTree(
	items: Array<Record<string, unknown>>,
	percentageScale = 100,
): void {
	for (const node of items) {
		const children = node.children as Array<Record<string, unknown>>;
		if (children.length > 0) {
			rollupMeasurementTree(children, percentageScale);
			let val = 0;
			let accVal = 0;
			let childrenBudgeted = 0;
			for (const child of children) {
				const mc = child.measuredCurrent as {
					value: number;
				};
				const ma = child.measuredAccumulated as {
					value: number;
				};
				val += mc?.value ?? 0;
				accVal += ma?.value ?? 0;
				childrenBudgeted += toFiniteNumber(child.totalCost);
			}
			const ownBudgeted = toFiniteNumber(node.totalCost);
			const budgeted = ownBudgeted > 0 ? ownBudgeted : childrenBudgeted;
			node.measuredCurrent = {
				quantity: 0,
				value: val,
				percentage: budgeted > 0 ? (val / budgeted) * percentageScale : 0,
			};
			node.measuredAccumulated = {
				quantity: 0,
				value: accVal,
				percentage: budgeted > 0 ? (accVal / budgeted) * percentageScale : 0,
			};
			node.balanceToMeasure = {
				quantity: 0,
				value: budgeted - accVal,
				percentage:
					budgeted > 0 ? ((budgeted - accVal) / budgeted) * percentageScale : 0,
			};
		}
	}
}

function isMeasurementEligibleForAccumulated(
	measurement: { date: Date; number: number },
	currentMeasurement: { date: Date; number: number },
): boolean {
	const date = new Date(measurement.date);
	const currentDate = new Date(currentMeasurement.date);
	const dateDay = Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
	);
	const currentDay = Date.UTC(
		currentDate.getUTCFullYear(),
		currentDate.getUTCMonth(),
		currentDate.getUTCDate(),
	);
	if (dateDay < currentDay) return true;
	if (dateDay > currentDay) return false;
	return measurement.number <= currentMeasurement.number;
}

type MeasurementTotals = {
	quantity: number;
	measuredQuantity: number;
	measuredValue: number;
	measuredPercentage: number;
};

function deriveWorkMeasurementItemValues(item: {
	measuredQuantity?: Prisma.Decimal | number | null;
	measuredValue?: Prisma.Decimal | number | null;
	measuredPercentage?: Prisma.Decimal | number | null;
	accumulatedQuantity?: Prisma.Decimal | number | null;
	accumulatedValue?: Prisma.Decimal | number | null;
	accumulatedPercentage?: Prisma.Decimal | number | null;
	budgetItem?: {
		quantity?: Prisma.Decimal | number | null;
		totalCost?: Prisma.Decimal | number | null;
	} | null;
}) {
	const budgetQuantity = toFiniteNumber(item.budgetItem?.quantity);
	const budgetValue = toFiniteNumber(item.budgetItem?.totalCost);
	const unitValue = budgetQuantity > 0 ? budgetValue / budgetQuantity : 0;
	const measuredQuantity = toFiniteNumber(
		item.accumulatedQuantity ?? item.measuredQuantity,
	);
	const measuredPercentage = toFiniteNumber(
		item.accumulatedPercentage ?? item.measuredPercentage,
	);
	const measuredValue = toFiniteNumber(
		item.accumulatedValue ??
			item.measuredValue ??
			(measuredQuantity > 0 && unitValue > 0
				? measuredQuantity * unitValue
				: measuredPercentage > 0 && budgetValue > 0
					? budgetValue * (measuredPercentage / 100)
					: 0),
	);

	return {
		quantity: measuredQuantity,
		value: roundCurrency(measuredValue),
		percentage:
			measuredPercentage || (budgetValue > 0 ? measuredValue / budgetValue : 0),
	};
}

export async function getWorkMeasurementDetail(
	ownerId: string,
	workId: string,
	measurementId: string,
) {
	const activeImportId = await getActiveBudgetImportId(ownerId, workId);
	const [work, measurement, budgetItems, allMeasurementItems] =
		await Promise.all([
			prisma.constructionWork.findFirst({
				where: { id: workId, ownerId },
				select: { id: true, code: true, name: true },
			}),
			prisma.workMeasurement.findFirst({
				where: { id: measurementId, ownerId, workId },
				include: {
					items: {
						include: {
							budgetItem: {
								select: {
									id: true,
									index: true,
									parentId: true,
									sortOrder: true,
									quantity: true,
									totalCost: true,
									description: true,
								},
							},
						},
					},
				},
			}),
			prisma.constructionBudgetItem.findMany({
				where: { ownerId, workId, importId: activeImportId },
				select: {
					id: true,
					index: true,
					parentId: true,
					sortOrder: true,
					quantity: true,
					totalCost: true,
					description: true,
				},
				orderBy: { sortOrder: "asc" },
			}),
			prisma.workMeasurementItem.findMany({
				where: { measurement: { ownerId, workId, status: "ACEITO" } },
				include: {
					measurement: { select: { id: true, number: true, date: true } },
				},
			}),
		]);

	if (!work || !measurement) return null;

	const measuredBudgetItemIds = new Set(
		measurement.items.map((item) => item.budgetItemId),
	);
	const budgetItemById = new Map(budgetItems.map((bi) => [bi.id, bi]));
	const visibleIds = new Set<string>();
	for (const id of measuredBudgetItemIds) {
		let current = budgetItemById.get(id);
		while (current && !visibleIds.has(current.id)) {
			visibleIds.add(current.id);
			current = current.parentId
				? budgetItemById.get(current.parentId)
				: undefined;
		}
	}
	const visibleBudgetItems = budgetItems.filter((bi) => visibleIds.has(bi.id));

	const currentByBudgetItem = new Map<
		string,
		{ quantity: number; value: number; percentage: number }
	>();
	for (const row of measurement.items) {
		currentByBudgetItem.set(row.budgetItemId, {
			quantity: Number(row.measuredQuantity ?? 0),
			value: Number(row.measuredValue ?? 0),
			percentage: Number(row.measuredPercentage ?? 0),
		});
	}

	const eligibleMeasurementItems = allMeasurementItems.filter((row) =>
		isMeasurementEligibleForAccumulated(row.measurement, {
			date: measurement.date,
			number: measurement.number,
		}),
	);

	const accumulatedByBudgetItem = new Map<
		string,
		{ quantity: number; value: number; percentage: number }
	>();
	const rowsByBudgetItem = new Map<string, typeof eligibleMeasurementItems>();
	for (const row of eligibleMeasurementItems) {
		const rows = rowsByBudgetItem.get(row.budgetItemId) ?? [];
		rows.push(row);
		rowsByBudgetItem.set(row.budgetItemId, rows);
	}
	for (const [budgetItemId, rows] of rowsByBudgetItem) {
		const last = [...rows].sort((a, b) => {
			const left = new Date(a.measurement.date).getTime();
			const right = new Date(b.measurement.date).getTime();
			return right - left || b.measurement.number - a.measurement.number;
		})[0];
		accumulatedByBudgetItem.set(budgetItemId, {
			quantity:
				last?.accumulatedQuantity != null
					? Number(last.accumulatedQuantity)
					: rows.reduce(
							(sum, r) => sum + toFiniteNumber(r.measuredQuantity),
							0,
						),
			value:
				last?.accumulatedValue != null
					? Number(last.accumulatedValue)
					: rows.reduce((sum, r) => sum + toFiniteNumber(r.measuredValue), 0),
			percentage:
				last?.accumulatedPercentage != null
					? Number(last.accumulatedPercentage)
					: rows.reduce(
							(sum, r) => sum + toFiniteNumber(r.measuredPercentage),
							0,
						),
		});
	}

	const items = buildMeasurementTree(
		visibleBudgetItems.map((item) => {
			const current = currentByBudgetItem.get(item.id) ?? {
				quantity: 0,
				value: 0,
				percentage: 0,
			};
			const accumulated = accumulatedByBudgetItem.get(item.id) ?? {
				quantity: 0,
				value: 0,
				percentage: 0,
			};
			const budgeted = toFiniteNumber(item.totalCost);
			const balanceValue = budgeted - accumulated.value;

			return {
				...item,
				measuredCurrent: current,
				measuredAccumulated: accumulated,
				balanceToMeasure: {
					quantity: toFiniteNumber(item.quantity) - accumulated.quantity,
					value: balanceValue,
					percentage: budgeted > 0 ? (balanceValue / budgeted) * 100 : 0,
				},
			};
		}),
	);

	rollupMeasurementTree(items);

	const totalBudgeted = sumLeafBudgetItems(
		budgetItems as Array<{
			id: string;
			parentId: string | null;
			totalCost: unknown;
		}>,
	);

	const currentTotals: MeasurementTotals = {
		quantity: 0,
		measuredQuantity: measurement.items.reduce(
			(sum, item) => sum + toFiniteNumber(item.measuredQuantity),
			0,
		),
		measuredValue: roundCurrency(
			measurement.items.reduce(
				(sum, item) => sum + toFiniteNumber(item.measuredValue),
				0,
			),
		),
		measuredPercentage: 0,
	};
	currentTotals.measuredPercentage =
		totalBudgeted > 0 ? (currentTotals.measuredValue / totalBudgeted) * 100 : 0;

	const accumulatedTotals: MeasurementTotals = {
		quantity: 0,
		measuredQuantity: 0,
		measuredValue: 0,
		measuredPercentage: 0,
	};
	for (const accumulated of accumulatedByBudgetItem.values()) {
		accumulatedTotals.measuredQuantity += accumulated.quantity;
		accumulatedTotals.measuredValue += accumulated.value;
	}
	accumulatedTotals.measuredValue = roundCurrency(
		accumulatedTotals.measuredValue,
	);
	accumulatedTotals.measuredPercentage =
		totalBudgeted > 0
			? (accumulatedTotals.measuredValue / totalBudgeted) * 100
			: 0;

	const currentMeasuredValue = roundCurrency(
		measurement.items.reduce(
			(sum, item) => sum + toFiniteNumber(item.measuredValue),
			0,
		),
	);
	const balanceToMeasure = roundCurrency(
		totalBudgeted - accumulatedTotals.measuredValue,
	);

	const [creatorNames] = await Promise.all([
		resolveCreatorNames([measurement]),
	]);

	const measurementWithValue = {
		...measurement,
		totalMeasuredValue: currentMeasuredValue,
		currentMeasuredValue,
		accumulatedMeasuredValue: accumulatedTotals.measuredValue,
		createdByName:
			creatorNames.get(String(measurement.createdBy ?? "")) ?? null,
	};

	return {
		work,
		measurement: measurementWithValue,
		budgetSummary: {
			totalBudgeted,
			totalMeasured: accumulatedTotals.measuredValue,
			balanceToMeasure,
		},
		items,
		totals: {
			current: currentTotals,
			accumulated: accumulatedTotals,
			balance: {
				quantity:
					budgetItems.reduce((sum, bi) => sum + Number(bi.quantity ?? 0), 0) -
					accumulatedTotals.quantity,
				value: balanceToMeasure,
				percentage:
					totalBudgeted > 0
						? ((totalBudgeted - accumulatedTotals.measuredValue) /
								totalBudgeted) *
							100
						: 0,
			},
		},
	};
}

export async function getWorkMeasurementMapDetail(
	ownerId: string,
	workId: string,
) {
	const activeImportId = await getActiveBudgetImportId(ownerId, workId);
	const [work, budgetItems, workMeasurements] = await Promise.all([
		prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { id: true, code: true, name: true },
		}),
		prisma.constructionBudgetItem.findMany({
			where: { ownerId, workId, importId: activeImportId },
			select: {
				id: true,
				index: true,
				parentId: true,
				sortOrder: true,
				quantity: true,
				totalCost: true,
				description: true,
			},
			orderBy: { sortOrder: "asc" },
		}),
		prisma.workMeasurement.findMany({
			where: { ownerId, workId, status: "ACEITO", archivedAt: null },
			include: {
				items: {
					include: {
						budgetItem: {
							select: {
								id: true,
								index: true,
								description: true,
								quantity: true,
								totalCost: true,
							},
						},
					},
				},
			},
			orderBy: { date: "asc" },
		}),
	]);

	if (!work) return null;

	const currentTotalsByBudgetItem = new Map<string, number>();
	const accumulatedTotalsByBudgetItem = new Map<string, number>();

	for (const measurement of workMeasurements) {
		for (const item of measurement.items) {
			const derived = deriveWorkMeasurementItemValues(item);
			currentTotalsByBudgetItem.set(
				item.budgetItemId,
				derived.value + (currentTotalsByBudgetItem.get(item.budgetItemId) ?? 0),
			);
			accumulatedTotalsByBudgetItem.set(
				item.budgetItemId,
				derived.value +
					(accumulatedTotalsByBudgetItem.get(item.budgetItemId) ?? 0),
			);
		}
	}

	const items = buildMeasurementTree(
		budgetItems.map((item) => {
			const budgeted = toFiniteNumber(item.totalCost);
			const measuredCurrentValue = currentTotalsByBudgetItem.get(item.id) ?? 0;
			const measuredAccumulatedQty =
				accumulatedTotalsByBudgetItem.get(item.id) ?? 0;
			const quantity = toFiniteNumber(item.quantity);
			return {
				...item,
				measuredCurrent: {
					quantity: 0,
					value: measuredCurrentValue,
					percentage:
						budgeted > 0 ? (measuredCurrentValue / budgeted) * 100 : 0,
				},
				measuredAccumulated: {
					quantity: 0,
					value: measuredAccumulatedQty,
					percentage:
						budgeted > 0 ? (measuredAccumulatedQty / budgeted) * 100 : 0,
				},
				balanceToMeasure: {
					quantity,
					value: budgeted - measuredAccumulatedQty,
					percentage:
						budgeted > 0
							? ((budgeted - measuredAccumulatedQty) / budgeted) * 100
							: 0,
				},
			};
		}),
	);

	rollupMeasurementTree(items);

	const workMeasurementRows = workMeasurements.map((measurement) => ({
		id: measurement.id,
		number: measurement.number,
		date: measurement.date,
		title: measurement.title,
		totalMeasured: measurement.items.reduce(
			(sum, item) =>
				sum + Number(item.measuredValue ?? item.accumulatedValue ?? 0),
			0,
		),
	}));

	const totalBudgeted = sumLeafBudgetItems(
		budgetItems as Array<{
			id: string;
			parentId: string | null;
			totalCost: unknown;
		}>,
	);
	const totalMeasured = workMeasurementRows.reduce(
		(sum, row) => sum + row.totalMeasured,
		0,
	);

	return {
		work,
		budgetSummary: {
			totalBudgeted,
			totalMeasured,
			balanceToMeasure: totalBudgeted - totalMeasured,
		},
		workMeasurements: workMeasurementRows,
		items,
		totals: {
			budgeted: totalBudgeted,
			measured: totalMeasured,
			balance: totalBudgeted - totalMeasured,
		},
	};
}

export async function getWorkMeasurementReportById(
	ownerId: string,
	workId: string,
	measurementId: string,
) {
	const detail = await getWorkMeasurementDetail(ownerId, workId, measurementId);
	if (!detail) return null;

	return {
		measurement: detail.measurement,
		items: detail.items,
		totals: detail.totals,
		report: {
			budgetSummary: detail.budgetSummary,
			generatedAt: new Date().toISOString(),
		},
	};
}

export async function getWorkMeasurementReports(
	ownerId: string,
	workId: string,
) {
	const activeImportId = await getActiveBudgetImportId(ownerId, workId);
	const [measurements, allBudgetItems, baselines] = await Promise.all([
		prisma.workMeasurement.findMany({
			where: { ownerId, workId, status: "ACEITO", archivedAt: null },
			include: {
				items: {
					include: {
						budgetItem: {
							select: { type: true, description: true, parentId: true },
						},
					},
				},
			},
			orderBy: { date: "asc" },
		}),
		prisma.constructionBudgetItem.findMany({
			where: { ownerId, workId, importId: activeImportId },
			select: {
				id: true,
				index: true,
				parentId: true,
				type: true,
				description: true,
				totalCost: true,
			},
		}),
		prisma.constructionBaselineSchedule.findMany({
			where: { ownerId, workId, importId: activeImportId },
			select: {
				budgetItemId: true,
				plannedStart: true,
				plannedEnd: true,
				plannedWeight: true,
			},
		}),
	]);

	const budgetItemsById = new Map(allBudgetItems.map((bi) => [bi.id, bi]));

	function findStageDescription(itemId: string): string {
		let current = budgetItemsById.get(itemId);
		const visited = new Set<string>();
		while (current) {
			if (visited.has(current.id)) break;
			visited.add(current.id);
			if (current.type === "STAGE" || current.type === "ETAPA") {
				return current.description;
			}
			if (current.parentId) {
				current = budgetItemsById.get(current.parentId);
			} else {
				break;
			}
		}
		return "SEM ETAPA";
	}

	const byStageKey = new Map<
		string,
		{ stageDescription: string; budgeted: number; measured: number }
	>();

	const allMonths = new Set<string>();
	const baselineByItem = new Map<string, (typeof baselines)[number]>();
	for (const b of baselines) {
		baselineByItem.set(b.budgetItemId, b);
		if (b.plannedStart) allMonths.add(monthKey(b.plannedStart));
		if (b.plannedEnd) allMonths.add(monthKey(b.plannedEnd));
	}

	for (const m of measurements) {
		allMonths.add(monthKey(m.date));
	}

	const byStageForMeasured = new Map<
		string,
		{ stageDescription: string; measured: number }
	>();

	for (const m of measurements) {
		for (const item of m.items) {
			const measured = Number(item.accumulatedValue ?? item.measuredValue ?? 0);
			const stageDesc = findStageDescription(item.budgetItemId);
			const key = stageDesc;
			const existing = byStageForMeasured.get(key);
			if (existing) existing.measured += measured;
			else
				byStageForMeasured.set(key, { stageDescription: stageDesc, measured });
		}
	}

	const hasChildren = new Set(
		allBudgetItems.map((bi) => bi.parentId).filter(Boolean) as string[],
	);

	for (const bi of allBudgetItems) {
		if (hasChildren.has(bi.id)) continue;
		const stageDesc = findStageDescription(bi.id);
		const key = stageDesc;
		const existing = byStageKey.get(key);
		if (existing) {
			existing.budgeted += toFiniteNumber(bi.totalCost);
		} else {
			byStageKey.set(key, {
				stageDescription: stageDesc,
				budgeted: toFiniteNumber(bi.totalCost),
				measured: byStageForMeasured.get(key)?.measured ?? 0,
			});
		}
	}

	const sortedMonths = fillMonthGaps([...allMonths].sort());

	const plannedVsMeasured = sortedMonths.map((month) => {
		let planned = 0;
		let measured = 0;

		for (const bi of allBudgetItems) {
			if (hasChildren.has(bi.id)) continue;
			const baseline = baselineByItem.get(bi.id);
			if (baseline?.plannedStart && baseline?.plannedEnd) {
				const bs = monthKey(baseline.plannedStart);
				const be = monthKey(baseline.plannedEnd);
				if (month >= bs && month <= be && baseline.plannedWeight) {
					planned +=
						toFiniteNumber(bi.totalCost) * Number(baseline.plannedWeight);
				}
			}
		}

		for (const m of measurements) {
			if (monthKey(m.date) !== month) continue;
			for (const item of m.items) {
				measured += Number(item.accumulatedValue ?? item.measuredValue ?? 0);
			}
		}

		return {
			month,
			planned,
			measured,
			performance: planned > 0 ? measured / planned : 0,
		};
	});

	let plannedAcc = 0;
	let measuredAcc = 0;

	return {
		measurementByStage: [...byStageKey.values()].map(
			({ stageDescription, budgeted, measured }) => ({
				stage: stageDescription,
				budgeted,
				measured,
				percentage: budgeted > 0 ? measured / budgeted : 0,
			}),
		),
		plannedVsMeasured: plannedVsMeasured.map((pvm) => {
			plannedAcc += pvm.planned;
			measuredAcc += pvm.measured;
			return {
				month: pvm.month,
				planned: pvm.planned,
				measured: pvm.measured,
				performance: pvm.performance,
				plannedAccumulated: plannedAcc,
				measuredAccumulated: measuredAcc,
				performanceAccumulated: plannedAcc > 0 ? measuredAcc / plannedAcc : 0,
			};
		}),
	};
}

export async function getWorkMeasurementSummary(
	ownerId: string,
	workId: string,
) {
	const activeImportId = await getActiveBudgetImportId(ownerId, workId);
	const importedMeasurementQuery = (
		prisma.constructionMeasurement as
			| typeof prisma.constructionMeasurement
			| undefined
	)?.findMany({
		where: {
			ownerId,
			workId,
			status: "ACEITO",
			OR: [
				...(activeImportId ? [{ importId: activeImportId }] : []),
				{ importId: null },
			],
		},
		select: {
			budgetItemId: true,
			measurementDate: true,
			measuredValue: true,
			measuredPercentageAccumulated: true,
			measuredQuantityAccumulated: true,
		},
	});
	const [measurements, importedMeasurements, budgetItems] = await Promise.all([
		prisma.workMeasurement.findMany({
			where: { ownerId, workId, status: "ACEITO", archivedAt: null },
			include: {
				items: {
					select: {
						budgetItemId: true,
						accumulatedValue: true,
						measuredValue: true,
					},
				},
			},
			orderBy: { date: "desc" },
		}),
		importedMeasurementQuery ?? Promise.resolve([]),
		prisma.constructionBudgetItem.findMany({
			where: { ownerId, workId, importId: activeImportId },
			select: { id: true, parentId: true, totalCost: true },
		}),
	]);

	const totalBudgeted = sumLeafBudgetItems(budgetItems);
	const canonicalMeasurements = composeMeasurementInputs(
		importedMeasurements,
		measurements,
	);
	const latestByBudgetItem = new Set<string>();
	let totalMeasured = 0;
	for (const item of [...canonicalMeasurements].reverse()) {
		if (!item.budgetItemId || latestByBudgetItem.has(item.budgetItemId))
			continue;
		latestByBudgetItem.add(item.budgetItemId);
		totalMeasured += Number(
			item.measuredValueAccumulated ?? item.measuredValue ?? 0,
		);
	}
	const normalizedTotalMeasured = roundCurrency(totalMeasured);

	return {
		totalMeasured: normalizedTotalMeasured,
		totalMeasuredPercentage:
			totalBudgeted > 0 ? normalizedTotalMeasured / totalBudgeted : 0,
		totalBudgeted,
		balanceToMeasure: roundCurrency(totalBudgeted - normalizedTotalMeasured),
		measurementCount:
			measurements.length > 0
				? measurements.length
				: importedMeasurements.length,
		lastMeasurementDate:
			canonicalMeasurements[
				canonicalMeasurements.length - 1
			]?.measurementDate?.toISOString() ?? null,
	};
}

export async function getWorkMeasurementsForBI(
	ownerId: string,
	workId: string,
) {
	return prisma.workMeasurement.findMany({
		where: { ownerId, workId, status: "ACEITO", archivedAt: null },
		include: {
			items: {
				select: {
					budgetItemId: true,
					measuredValue: true,
					accumulatedValue: true,
					accumulatedPercentage: true,
					accumulatedQuantity: true,
				},
			},
		},
		orderBy: { date: "asc" },
	});
}

export async function getWorkMeasurementsForManyWorks(
	ownerId: string,
	workIds: string[],
): Promise<Map<string, Awaited<ReturnType<typeof getWorkMeasurementsForBI>>>> {
	if (workIds.length === 0) return new Map();
	const rows = await prisma.workMeasurement.findMany({
		where: {
			ownerId,
			workId: { in: workIds },
			status: "ACEITO",
			archivedAt: null,
		},
		include: {
			items: {
				select: {
					budgetItemId: true,
					measuredValue: true,
					accumulatedValue: true,
					accumulatedPercentage: true,
					accumulatedQuantity: true,
				},
			},
		},
		orderBy: { date: "asc" },
	});
	const byWork = new Map<
		string,
		Awaited<ReturnType<typeof getWorkMeasurementsForBI>>
	>();
	for (const row of rows) {
		const list = byWork.get(row.workId) ?? [];
		list.push(row);
		byWork.set(row.workId, list);
	}
	return byWork;
}
