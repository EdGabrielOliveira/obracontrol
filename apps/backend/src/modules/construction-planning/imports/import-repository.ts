import { Prisma } from "../../../../generated/prisma/client";
import { ConstructionError } from "../../../lib/errors";
import { buildPaginatedResponse } from "../../../lib/pagination";
import { prisma } from "../../../lib/prisma";
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
			create: { ownerId, workId, index: item.index },
			update: {},
			select: { id: true },
		});

		const unitCostTotal = item.unitCostTotal ?? item.unitCost ?? null;
		const totalBudget = item.totalBudget ?? item.totalCost ?? 0;

		const created = await tx.constructionBudgetItem.create({
			data: {
				ownerId,
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

	if (data.measurements?.length) {
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

export async function findWorkByOwnerAndCode(ownerId: string, code: string) {
	return prisma.constructionWork.findUnique({
		where: { ownerId_code: { ownerId, code } },
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
		rowCount: number;
		reprocessOfId?: string | null;
		errorSummary?: Prisma.InputJsonValue | null;
		audit?: (tx: Prisma.TransactionClient, importId: string) => Promise<void>;
	},
) {
	return prisma.$transaction(async (tx) => {
		const createdWork = await tx.constructionWork.create({
			data: {
				ownerId,
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
		);
		await createUnifiedChildren(
			tx,
			ownerId,
			createdWork.id,
			imp.id,
			indexToId,
			options,
		);

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
		rowCount: number;
		reprocessOfId?: string | null;
		errorSummary?: Prisma.InputJsonValue | null;
		audit?: (tx: Prisma.TransactionClient, importId: string) => Promise<void>;
	},
): Promise<{ workId: string; importId: string }> {
	const updatedWork = await tx.constructionWork.update({
		where: { id: workId, ownerId },
		data: {
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
			workId: updatedWork.id,
			fileName: work.fileName,
			sheetName: work.sheetName,
			importedSections: work.importedSections,
			rowCount: options.rowCount,
			status: "IMPORTED",
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
	);
	await createUnifiedChildren(
		tx,
		ownerId,
		updatedWork.id,
		imp.id,
		indexToId,
		options,
	);

	await tx.constructionWork.update({
		where: { id: updatedWork.id, ownerId },
		data: { activeImportId: imp.id },
	});

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
			select: { id: true },
		});

		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const imp = await tx.constructionImport.create({
			data: {
				ownerId,
				workId,
				fileName: options.fileName,
				sheetName: options.sheetName,
				importedSections: ["Orcamento"],
				rowCount: options.rowCount,
				status: "IMPORTED",
			},
		});

		await createBudgetItems(tx, ownerId, workId, imp.id, items);

		await tx.constructionWork.update({
			where: { id: workId, ownerId },
			data: { activeImportId: imp.id },
		});

		return { workId, importId: imp.id };
	});
}
