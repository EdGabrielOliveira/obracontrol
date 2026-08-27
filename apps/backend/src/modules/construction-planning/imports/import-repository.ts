import Decimal from "decimal.js";
import { Prisma } from "../../../../generated/prisma/client";
import { ConstructionError } from "../../../lib/errors";
import { buildPaginatedResponse } from "../../../lib/pagination";
import { prisma } from "../../../lib/prisma";
import { normalizeText } from "../../../lib/text-utils";
import { getWorkspaceIdForUser } from "../../../lib/workspace";
import { getBudgetItemReferences } from "../budget-control/budget-control.repository";
import { deriveWorkMeasurementItem } from "../calculators/work-measurement-calculator";
import { nextMeasurementNumber } from "../measurement-common";
import type { ImportValidationError } from "../types";
import { ancestorIndexesOf, compareIndexHierarchy } from "./index-helpers";
import type {
	NormalizedActualCost,
	NormalizedBaselineSchedule,
	NormalizedBudgetItem,
	NormalizedMeasurement,
	NormalizedScheduleRevision,
	NormalizedWork,
} from "./normalized-types";

function ancestorIndexIdFor(
	index: string,
	indexToId: Map<string, string>,
): string | null {
	for (const candidate of ancestorIndexesOf(index)) {
		const id = indexToId.get(candidate);
		if (id) return id;
	}
	return null;
}

async function createBudgetItems(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	importId: string,
	items: NormalizedBudgetItem[],
	itens: NormalizedBudgetItem[] = [],
	seedIndexToId: Map<string, string> = new Map(),
	workspaceId?: string | null,
) {
	const indexToId = new Map(seedIndexToId);
	const merged = [...items, ...itens].sort(
		(a, b) =>
			compareIndexHierarchy(a.index, b.index) || a.sortOrder - b.sortOrder,
	);

	const winners = new Map<string, NormalizedBudgetItem>();
	for (const item of items) {
		if (!winners.has(item.index)) winners.set(item.index, item);
	}
	for (const item of itens) {
		if (!winners.has(item.index)) winners.set(item.index, item);
	}

	let sortPosition = 0;
	for (const item of merged) {
		if (winners.get(item.index) !== item) continue;
		sortPosition++;
		const identity = await tx.budgetItemIdentity.upsert({
			where: { workId_index: { workId, index: item.index } },
			create: {
				ownerId,
				workspaceId: workspaceId ?? null,
				workId,
				index: item.index,
			},
			update: {},
			select: { id: true },
		});

		const unitCostTotal = item.unitCostTotal ?? item.unitCost ?? null;
		const totalBudget = item.totalBudget ?? item.totalCost ?? 0;

		const created = await tx.constructionBudgetItem.create({
			data: {
				ownerId,
				workspaceId: workspaceId ?? null,
				workId,
				importId,
				identityId: identity.id,
				parentId: item.parentIndex
					? (indexToId.get(item.parentIndex) ??
						ancestorIndexIdFor(item.index, indexToId))
					: ancestorIndexIdFor(item.index, indexToId),
				index: item.index,
				type: item.type,
				description: item.description,
				unit: item.unit,
				quantity: item.quantity,
				laborUnitCost: item.laborUnitCost,
				materialUnitCost: item.materialUnitCost,
				equipmentUnitCost: item.equipmentUnitCost,
				otherUnitCost: item.otherUnitCost,
				unitCostTotal,
				totalBudget,
				unitCost: item.unitCost ?? unitCostTotal,
				totalCost: item.totalCost ?? totalBudget,
				plannedStart: item.plannedStart,
				plannedEnd: item.plannedEnd,
				actualStart: item.actualStart,
				actualEnd: item.actualEnd,
				completionPercentage: item.completionPercentage,
				providedStatus: item.providedStatus,
				computedStatus: item.computedStatus,
				sortOrder: sortPosition,
			},
			select: { id: true, index: true },
		});

		indexToId.set(created.index, created.id);
	}

	return indexToId;
}

async function createUnifiedChildren(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	importId: string,
	indexToId: Map<string, string>,
	data: {
		baselineSchedules?: NormalizedBaselineSchedule[];
		scheduleRevisions?: NormalizedScheduleRevision[];
		measurements?: NormalizedMeasurement[];
		actualCosts?: NormalizedActualCost[];
		measurementsAsWorkMeasurements?: boolean;
	},
) {
	if (data.baselineSchedules?.length) {
		await tx.constructionBaselineSchedule.createMany({
			data: data.baselineSchedules.flatMap((row) => {
				const budgetItemId =
					indexToId.get(row.index) ?? ancestorIndexIdFor(row.index, indexToId);
				if (!budgetItemId) return [];

				return {
					ownerId,
					workId,
					importId,
					budgetItemId,
					rowNumber: row.rowNumber,
					index: row.index,
					plannedStart: row.plannedStart,
					plannedEnd: row.plannedEnd,
					plannedWeight: row.plannedWeight,
				};
			}),
		});
	}

	if (data.scheduleRevisions?.length) {
		await tx.constructionScheduleRevision.createMany({
			data: data.scheduleRevisions.flatMap((row) => {
				const budgetItemId =
					indexToId.get(row.index) ?? ancestorIndexIdFor(row.index, indexToId);
				if (!budgetItemId) return [];

				return {
					ownerId,
					workId,
					importId,
					budgetItemId,
					rowNumber: row.rowNumber,
					index: row.index,
					version: row.version,
					replannedStart: row.replannedStart,
					replannedEnd: row.replannedEnd,
					revisionDate: row.revisionDate,
					reason: row.reason,
				};
			}),
		});
	}

	if (data.measurements?.length && !data.measurementsAsWorkMeasurements) {
		await tx.constructionMeasurement.createMany({
			data: data.measurements.map((row) => {
				const budgetItemId =
					indexToId.get(row.index) ?? ancestorIndexIdFor(row.index, indexToId);
				if (!budgetItemId) {
					throw new ConstructionError(
						"INTERNAL_ERROR",
						`Medicao do indice ${row.index} sem item de orcamento vinculavel`,
						500,
					);
				}

				return {
					ownerId,
					workId,
					importId,
					budgetItemId,
					rowNumber: row.rowNumber,
					index: row.index,
					measurementDate: row.measurementDate,
					measuredPercentageAccumulated: row.measuredPercentageAccumulated,
					measuredQuantityAccumulated: row.measuredQuantityAccumulated,
					notes: row.notes,
				};
			}),
		});
	}

	if (data.actualCosts?.length) {
		await tx.constructionActualCost.createMany({
			data: data.actualCosts.map((row) => {
				let budgetItemId: string | null = null;
				if (row.budgetIndex) {
					budgetItemId =
						indexToId.get(row.budgetIndex) ??
						ancestorIndexIdFor(row.budgetIndex, indexToId);
					if (!budgetItemId) {
						throw new ConstructionError(
							"INTERNAL_ERROR",
							`Custo do indice ${row.budgetIndex} sem item de orcamento vinculavel`,
							500,
						);
					}
				}

				return {
					ownerId,
					workId,
					importId,
					budgetItemId,
					rowNumber: row.rowNumber,
					costDate: row.costDate,
					budgetIndex: row.budgetIndex,
					category: row.category,
					description: row.description,
					amount: row.amount,
					costType: row.costType,
					sourceDocument: row.sourceDocument,
					appropriationStatus: row.appropriationStatus,
					supplierName: row.supplierName ?? null,
					costGroup: row.costGroup ?? null,
					paymentStatus: row.paymentStatus ?? "OPEN",
					competenceDate: row.competenceDate ?? null,
					dueDate: row.dueDate ?? null,
					paymentDate: row.paymentDate ?? null,
					documentNumber: row.documentNumber ?? null,
				};
			}),
		});
	}
}

/**
 * Converte snapshots acumulados da planilha para o agregado operacional atual.
 * O domínio WorkMeasurement armazena o incremento de cada medição, então o
 * acumulado importado é comparado com o histórico já existente.
 */
async function createWorkMeasurementsFromImport(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	measurements: NormalizedMeasurement[],
	indexToId: Map<string, string>,
) {
	if (measurements.length === 0) return;

	const rows = measurements
		.map((row) => {
			const budgetItemId =
				indexToId.get(row.index) ?? ancestorIndexIdFor(row.index, indexToId);
			return budgetItemId ? { row, budgetItemId } : null;
		})
		.filter(
			(value): value is { row: NormalizedMeasurement; budgetItemId: string } =>
				value !== null,
		)
		.sort(
			(a, b) =>
				a.row.measurementDate.getTime() - b.row.measurementDate.getTime() ||
				a.row.rowNumber - b.row.rowNumber,
		);

	const references = await getBudgetItemReferences(
		ownerId,
		workId,
		[...new Set(rows.map((entry) => entry.budgetItemId))],
		tx,
	);
	const referenceById = new Map(
		references.found.map((reference) => [reference.budgetItemId, reference]),
	);
	const accumulatedByItem = new Map<string, Decimal>();
	const existing = await tx.workMeasurement.findMany({
		where: { ownerId, workId },
		select: {
			items: {
				select: { budgetItemId: true, measuredQuantity: true },
			},
		},
	});
	for (const measurement of existing) {
		for (const item of measurement.items) {
			const previous =
				accumulatedByItem.get(item.budgetItemId) ?? new Decimal(0);
			accumulatedByItem.set(
				item.budgetItemId,
				previous.plus(item.measuredQuantity ?? 0),
			);
		}
	}

	const byDate = new Map<
		string,
		{
			date: Date;
			notes: string[];
			items: Map<string, ReturnType<typeof deriveWorkMeasurementItem>>;
		}
	>();
	for (const { row, budgetItemId } of rows) {
		const reference = referenceById.get(budgetItemId);
		if (
			!reference?.operationalBudgetItemId ||
			!reference.quantity ||
			!reference.unitCost
		) {
			throw new ConstructionError(
				"BUDGET_ITEM_NOT_PROJECTED",
				`Item do orçamento ${row.index} ainda não foi projetado para medições`,
				422,
			);
		}

		const operationalBudgetItemId = reference.operationalBudgetItemId;
		const previous =
			accumulatedByItem.get(operationalBudgetItemId) ?? new Decimal(0);
		const target =
			row.measuredQuantityAccumulated != null
				? new Decimal(row.measuredQuantityAccumulated)
				: reference.quantity.mul(row.measuredPercentageAccumulated);

		const current = target.minus(previous);
		if (!current.greaterThan(0)) continue;

		let derived: ReturnType<typeof deriveWorkMeasurementItem>;
		try {
			derived = deriveWorkMeasurementItem({
				measuredQuantity: current,
				previousAccumulatedQuantity: previous,
				plannedQuantity: reference.quantity,
				unitCost: reference.unitCost,
			});
		} catch {
			throw new ConstructionError(
				"MEASUREMENT_EXCEEDS_BALANCE",
				`Medição do item ${row.index} acima do saldo disponível`,
				422,
			);
		}

		const dateKey = row.measurementDate.toISOString().slice(0, 10);
		const group = byDate.get(dateKey) ?? {
			date: row.measurementDate,
			notes: [],
			items: new Map<string, ReturnType<typeof deriveWorkMeasurementItem>>(),
		};
		group.items.set(operationalBudgetItemId, derived);
		if (row.notes?.trim()) group.notes.push(row.notes.trim());
		byDate.set(dateKey, group);
		accumulatedByItem.set(operationalBudgetItemId, target);
	}

	for (const [dateKey, group] of byDate) {
		const items = [...group.items.entries()].map(([budgetItemId, item]) => ({
			budgetItemId,
			measuredQuantity: item.measuredQuantity,
			measuredValue: item.measuredValue,
			measuredPercentage: item.measuredPercentage,
			accumulatedQuantity: item.accumulatedQuantity,
			accumulatedValue: item.accumulatedValue,
			accumulatedPercentage: item.accumulatedPercentage,
		}));
		if (items.length === 0) continue;

		const number = await nextMeasurementNumber(tx, "workMeasurement", {
			ownerId,
			workId,
		});
		const created = await tx.workMeasurement.create({
			data: {
				ownerId,
				workId,
				number,
				date: group.date,
				title: `Medição importada - ${dateKey}`,
				discountValue: null,
				retentionValue: null,
				balanceOverride: false,
				evidenceNote: null,
				createdBy: ownerId,
				notes:
					group.notes.length > 0 ? [...new Set(group.notes)].join("; ") : null,
				status: "ACEITO",
				statusReason: "Importado e validado",
				statusChangedAt: new Date(),
			},
			select: { id: true },
		});
		await tx.workMeasurementItem.createMany({
			data: items.map((item) => ({ measurementId: created.id, ...item })),
		});
	}
}

type LegacyWorkLookup = Omit<
	Prisma.ConstructionWorkGetPayload<null>,
	"workspaceId" | "statusReason" | "statusChangedAt" | "statusChangedBy"
> & { workspaceId?: string | null };

export async function findWorkByOwnerAndCode(
	ownerId: string,
	code: string,
): Promise<LegacyWorkLookup | null> {
	return prisma.constructionWork.findFirst({
		where: { ownerId, code },
	});
}

export async function listImports(
	ownerId: string,
	filters: { workId?: string | null; page?: number; pageSize?: number } = {},
) {
	const page = filters.page && filters.page > 0 ? filters.page : 1;
	const limit = Math.min(
		filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20,
		100,
	);
	const where: Prisma.ConstructionImportWhereInput = { ownerId };
	if (filters.workId) where.workId = filters.workId;

	const [data, total] = await Promise.all([
		prisma.constructionImport.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.constructionImport.count({ where }),
	]);

	return buildPaginatedResponse(data, total, page, limit);
}

export async function getImportById(ownerId: string, importId: string) {
	return prisma.constructionImport.findFirst({
		where: { id: importId, ownerId },
	});
}

export async function existingBudgetIndexes(
	context: { ownerId: string; workId: string | null },
	indexes: string[],
): Promise<Set<string>> {
	if (!context.workId || indexes.length === 0) return new Set();
	const items = await prisma.constructionBudgetItem.findMany({
		where: {
			ownerId: context.ownerId,
			workId: context.workId,
			index: { in: indexes },
		},
		select: { index: true },
	});
	return new Set(items.map((item) => item.index));
}

export async function activeBudgetIndexes(
	ownerId: string,
	workId: string,
): Promise<Set<string>> {
	const work = await prisma.constructionWork.findFirst({
		where: { ownerId, id: workId },
		select: { activeImportId: true },
	});
	if (!work?.activeImportId) return new Set();

	// A referência pode apontar para qualquer nível da árvore vigente:
	// 1, 1.1 ou 1.1.1. A regra de item operacional é aplicada depois,
	// quando o uso exige quantidade, custo e projeção.
	const items = await prisma.constructionBudgetItem.findMany({
		where: {
			ownerId,
			workId,
			importId: work.activeImportId,
		},
		select: { index: true },
	});
	return new Set(items.map((item) => item.index));
}

/**
 * Retorna o vínculo índice -> linha do orçamento usado pela aplicação de medições.
 * A pré-validação usa este mapa para impedir que uma planilha sem referência
 * ao orçamento chegue à etapa de confirmação.
 */
async function activeBudgetItemsByIndex(
	ownerId: string,
	workId: string,
): Promise<Map<string, { id: string; description: string }>> {
	const work = await prisma.constructionWork.findFirst({
		where: { ownerId, id: workId },
		select: { activeImportId: true },
	});
	if (!work?.activeImportId) return new Map();

	const items = await prisma.constructionBudgetItem.findMany({
		where: {
			ownerId,
			workId,
			importId: work.activeImportId,
		},
		select: { id: true, index: true, description: true },
	});
	return new Map(
		items.map((item) => [
			item.index,
			{ id: item.id, description: item.description },
		]),
	);
}

export async function activeBudgetItemIdsByIndex(
	ownerId: string,
	workId: string,
): Promise<Map<string, string>> {
	const items = await activeBudgetItemsByIndex(ownerId, workId);
	return new Map([...items].map(([index, item]) => [index, item.id]));
}

/**
 * Valida as regras que antes só eram verificadas dentro da transação de
 * confirmação: existência do item no orçamento ativo, projeção operacional,
 * quantidade/custo planejados e saldo disponível para o acumulado importado.
 */
export async function validateWorkMeasurementsFromImport(
	ownerId: string,
	workId: string,
	measurements: NormalizedMeasurement[],
): Promise<ImportValidationError[]> {
	if (measurements.length === 0) return [];

	const activeItems = await activeBudgetItemsByIndex(ownerId, workId);
	const indexToId = new Map(
		[...activeItems].map(([index, item]) => [index, item.id]),
	);
	const rows = measurements
		.map((row) => {
			const budgetItemId =
				indexToId.get(row.index) ?? ancestorIndexIdFor(row.index, indexToId);
			return budgetItemId ? { row, budgetItemId } : null;
		})
		.filter(
			(value): value is { row: NormalizedMeasurement; budgetItemId: string } =>
				value !== null,
		)
		.sort(
			(a, b) =>
				a.row.measurementDate.getTime() - b.row.measurementDate.getTime() ||
				a.row.rowNumber - b.row.rowNumber,
		);

	const errors: ImportValidationError[] = measurements
		.filter(
			(row) =>
				!indexToId.has(row.index) && !ancestorIndexIdFor(row.index, indexToId),
		)
		.map((row) => ({
			sheet: "Medicoes Obra",
			row: row.rowNumber,
			field: "Indice",
			code: "UNKNOWN_BUDGET_INDEX",
			message: "Indice nao encontrado no orcamento ativo",
			dependency: row.index,
		}));

	const references = await getBudgetItemReferences(ownerId, workId, [
		...new Set(rows.map((entry) => entry.budgetItemId)),
	]);
	const referenceById = new Map(
		references.found.map((reference) => [reference.budgetItemId, reference]),
	);
	const accumulatedByItem = new Map<string, Decimal>();
	const existing = await prisma.workMeasurement.findMany({
		where: { ownerId, workId },
		select: {
			items: {
				select: { budgetItemId: true, measuredQuantity: true },
			},
		},
	});
	for (const measurement of existing) {
		for (const item of measurement.items) {
			const previous =
				accumulatedByItem.get(item.budgetItemId) ?? new Decimal(0);
			accumulatedByItem.set(
				item.budgetItemId,
				previous.plus(item.measuredQuantity ?? 0),
			);
		}
	}

	for (const { row, budgetItemId } of rows) {
		const activeItem = activeItems.get(row.index);
		if (
			row.itemName?.trim() &&
			activeItem &&
			normalizeText(row.itemName) !== normalizeText(activeItem.description)
		) {
			errors.push({
				sheet: "Medicoes Obra",
				row: row.rowNumber,
				field: "Nome do item",
				code: "BUDGET_ITEM_NAME_MISMATCH",
				message: `Nome do item nao corresponde ao indice ${row.index} do orcamento`,
				dependency: row.index,
			});
		}
		const reference = referenceById.get(budgetItemId);
		if (
			!reference?.operationalBudgetItemId ||
			!reference.quantity?.greaterThan(0) ||
			!reference.unitCost?.greaterThan(0)
		) {
			errors.push({
				sheet: "Medicoes Obra",
				row: row.rowNumber,
				field: "Indice",
				code: "BUDGET_ITEM_NOT_PROJECTED",
				message: `Item do orcamento ${row.index} ainda nao foi projetado para medicoes`,
				dependency: row.index,
			});
			continue;
		}

		const operationalBudgetItemId = reference.operationalBudgetItemId;
		const previous =
			accumulatedByItem.get(operationalBudgetItemId) ?? new Decimal(0);
		const target =
			row.measuredQuantityAccumulated != null
				? new Decimal(row.measuredQuantityAccumulated)
				: reference.quantity.mul(row.measuredPercentageAccumulated);
		const current = target.minus(previous);
		if (!current.greaterThan(0)) continue;

		try {
			deriveWorkMeasurementItem({
				measuredQuantity: current,
				previousAccumulatedQuantity: previous,
				plannedQuantity: reference.quantity,
				unitCost: reference.unitCost,
			});
		} catch {
			errors.push({
				sheet: "Medicoes Obra",
				row: row.rowNumber,
				field: "Quantidade medida acumulada",
				code: "MEASUREMENT_EXCEEDS_BALANCE",
				message: `Medicao do item ${row.index} acima do saldo disponivel`,
				dependency: row.index,
			});
			continue;
		}
		accumulatedByItem.set(operationalBudgetItemId, target);
	}

	return errors;
}

export async function existingActiveBudgetIndexes(
	context: { ownerId: string; workId: string | null },
	indexes: string[],
): Promise<Set<string>> {
	if (!context.workId || indexes.length === 0) return new Set();
	const active = await activeBudgetIndexes(context.ownerId, context.workId);
	return new Set(indexes.filter((index) => active.has(index)));
}

export async function existingScheduleIndexes(
	context: { ownerId: string; workId: string | null },
	indexes: string[],
): Promise<Set<string>> {
	if (!context.workId || indexes.length === 0) return new Set();
	const rows = await prisma.constructionBaselineSchedule.findMany({
		where: {
			ownerId: context.ownerId,
			workId: context.workId,
			index: { in: indexes },
			plannedStart: { not: null },
			plannedEnd: { not: null },
		},
		select: { index: true },
	});
	return new Set(rows.map((row) => row.index));
}

export async function createWorkWithImport(
	ownerId: string,
	work: NormalizedWork,
	costCenterId: string,
	items: NormalizedBudgetItem[],
	options: {
		itens?: NormalizedBudgetItem[];
		baselineSchedules?: NormalizedBaselineSchedule[];
		scheduleRevisions?: NormalizedScheduleRevision[];
		measurements?: NormalizedMeasurement[];
		actualCosts?: NormalizedActualCost[];
		measurementsAsWorkMeasurements?: boolean;
		rowCount: number;
		reprocessOfId?: string | null;
		errorSummary?: Prisma.InputJsonValue | null;
		audit?: (tx: Prisma.TransactionClient, importId: string) => Promise<void>;
	},
) {
	return prisma.$transaction(async (tx) => {
		const costCenterDelegate = (
			tx as unknown as {
				costCenter?: {
					findUnique?: (
						args: unknown,
					) => Promise<{ workspaceId?: string | null } | null>;
				};
			}
		).costCenter;
		const center = costCenterDelegate?.findUnique
			? await costCenterDelegate.findUnique({
					where: { id: costCenterId },
					select: { workspaceId: true },
				})
			: null;
		const workspaceId =
			center?.workspaceId ?? (await getWorkspaceIdForUser(ownerId));
		const createdWork = await tx.constructionWork.create({
			data: {
				ownerId,
				workspaceId,
				costCenterId,
				code: work.code,
				name: work.name,
				clientName: work.clientName,
				plannedStart: work.plannedStart,
				plannedEnd: work.plannedEnd,
				baseDate: work.baseDate,
				areaM2: work.areaM2 ?? null,
				operationalStatus: work.operationalStatus ?? null,
				responsibleName: work.responsibleName ?? null,
			},
		});

		const imp = await tx.constructionImport.create({
			data: {
				ownerId,
				workspaceId,
				workId: createdWork.id,
				fileName: work.fileName,
				sheetName: work.sheetName,
				importedSections: work.importedSections,
				rowCount: options.rowCount,
				status: "IMPORTED",
				reprocessOfId: options.reprocessOfId ?? null,
				errorSummary: options.errorSummary ?? Prisma.JsonNull,
			},
		});

		const indexToId = await createBudgetItems(
			tx,
			ownerId,
			createdWork.id,
			imp.id,
			items,
			options.itens,
			new Map(),
			workspaceId,
		);
		await createUnifiedChildren(
			tx,
			ownerId,
			createdWork.id,
			imp.id,
			indexToId,
			options,
		);
		if (options.measurementsAsWorkMeasurements) {
			await createWorkMeasurementsFromImport(
				tx,
				ownerId,
				createdWork.id,
				options.measurements ?? [],
				indexToId,
			);
		}

		await tx.constructionWork.update({
			where: { id: createdWork.id },
			data: { activeImportId: imp.id },
		});

		await options.audit?.(tx, imp.id);

		return { workId: createdWork.id, importId: imp.id };
	});
}

export type ImportPersistClient = Prisma.TransactionClient | typeof prisma;

export async function replaceWorkWithImport(
	ownerId: string,
	workId: string,
	work: NormalizedWork,
	items: NormalizedBudgetItem[],
	options: {
		itens?: NormalizedBudgetItem[];
		baselineSchedules?: NormalizedBaselineSchedule[];
		scheduleRevisions?: NormalizedScheduleRevision[];
		measurements?: NormalizedMeasurement[];
		actualCosts?: NormalizedActualCost[];
		measurementsAsWorkMeasurements?: boolean;
		rowCount: number;
		reprocessOfId?: string | null;
		errorSummary?: Prisma.InputJsonValue | null;
		audit?: (tx: Prisma.TransactionClient, importId: string) => Promise<void>;
		db?: ImportPersistClient;
	},
): Promise<{ workId: string; importId: string }> {
	const db = options.db ?? prisma;
	const run = (tx: Prisma.TransactionClient) => {
		return replaceWorkWithImportInTx(tx, ownerId, workId, work, items, options);
	};
	return db === prisma
		? prisma.$transaction(run)
		: run(db as Prisma.TransactionClient);
}

async function replaceWorkWithImportInTx(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	work: NormalizedWork,
	items: NormalizedBudgetItem[],
	options: {
		itens?: NormalizedBudgetItem[];
		baselineSchedules?: NormalizedBaselineSchedule[];
		scheduleRevisions?: NormalizedScheduleRevision[];
		measurements?: NormalizedMeasurement[];
		actualCosts?: NormalizedActualCost[];
		measurementsAsWorkMeasurements?: boolean;
		rowCount: number;
		reprocessOfId?: string | null;
		errorSummary?: Prisma.InputJsonValue | null;
		audit?: (tx: Prisma.TransactionClient, importId: string) => Promise<void>;
	},
): Promise<{ workId: string; importId: string }> {
	const workData: Prisma.ConstructionWorkUpdateInput = {};
	if (work.code.trim()) workData.code = work.code;
	if (work.name.trim()) workData.name = work.name;
	if (work.clientName !== null) workData.clientName = work.clientName;
	if (work.plannedStart !== null) workData.plannedStart = work.plannedStart;
	if (work.plannedEnd !== null) workData.plannedEnd = work.plannedEnd;
	if (work.baseDate !== null) workData.baseDate = work.baseDate;
	if (work.areaM2 !== null) workData.areaM2 = work.areaM2;
	if (work.operationalStatus !== null)
		workData.operationalStatus = work.operationalStatus;
	if (work.responsibleName !== null)
		workData.responsibleName = work.responsibleName;

	const updatedWork = await tx.constructionWork.update({
		where: { id: workId, ownerId },
		data: workData,
	});

	const imp = await tx.constructionImport.create({
		data: {
			ownerId,
			workId: updatedWork.id,
			fileName: work.fileName,
			sheetName: work.sheetName,
			importedSections: work.importedSections,
			rowCount: options.rowCount,
			status: "IMPORTED",
			workspaceId: updatedWork.workspaceId,
			reprocessOfId: options.reprocessOfId ?? null,
			errorSummary: options.errorSummary ?? Prisma.JsonNull,
		},
	});

	const existingItems = await tx.constructionBudgetItem.findMany({
		where: { ownerId, workId: updatedWork.id },
		select: { id: true, index: true },
	});
	const existingIndexToId = new Map(
		existingItems.map((item) => [item.index, item.id]),
	);

	const indexToId = await createBudgetItems(
		tx,
		ownerId,
		updatedWork.id,
		imp.id,
		items,
		options.itens,
		existingIndexToId,
		updatedWork.workspaceId,
	);
	await createUnifiedChildren(
		tx,
		ownerId,
		updatedWork.id,
		imp.id,
		indexToId,
		options,
	);
	if (options.measurementsAsWorkMeasurements) {
		await createWorkMeasurementsFromImport(
			tx,
			ownerId,
			updatedWork.id,
			options.measurements ?? [],
			indexToId,
		);
	}

	const hasBudgetPayload = items.length > 0 || (options.itens?.length ?? 0) > 0;
	if (hasBudgetPayload) {
		await tx.constructionWork.update({
			where: { id: updatedWork.id, ownerId },
			data: { activeImportId: imp.id },
		});
	}

	await options.audit?.(tx, imp.id);

	return { workId: updatedWork.id, importId: imp.id };
}

export async function replaceBudgetWithImport(
	ownerId: string,
	workId: string,
	items: NormalizedBudgetItem[],
	options: { fileName: string; sheetName: string; rowCount: number },
): Promise<{ workId: string; importId: string }> {
	return prisma.$transaction(async (tx) => {
		const work = await tx.constructionWork.findUnique({
			where: { id: workId, ownerId },
			select: { id: true, workspaceId: true },
		});

		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const imp = await tx.constructionImport.create({
			data: {
				ownerId,
				workspaceId: work.workspaceId,
				workId,
				fileName: options.fileName,
				sheetName: options.sheetName,
				importedSections: ["Orcamento"],
				rowCount: options.rowCount,
				status: "IMPORTED",
			},
		});

		await createBudgetItems(
			tx,
			ownerId,
			workId,
			imp.id,
			items,
			[],
			new Map(),
			work.workspaceId,
		);

		await tx.constructionWork.update({
			where: { id: workId, ownerId },
			data: { activeImportId: imp.id },
		});

		return { workId, importId: imp.id };
	});
}
