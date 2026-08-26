import Decimal from "decimal.js";
import {
	type BudgetVersionDraft,
	createDraftBudgetVersionFromSnapshot,
} from "../../lib/budget-version-adapter";
import { ConstructionError } from "../../lib/errors";
import { toNullableNumber } from "../../lib/number-utils";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import type { BudgetVersionComparison } from "./budget-version-comparison";
import {
	type BudgetSnapshotItem,
	compareBudgetVersionSnapshots,
	hasBudgetVersionChanges,
} from "./budget-version-comparison";
import { loadBudgetExposure } from "./budget-version-exposure.service";
import { constructionImportBatchService } from "./imports/import-batch.service";
import type { ImportPreviewPage } from "./imports/import-batch.types";
import { normalizeHierarchyIndex } from "./imports/index-helpers";
import { normalizeBudgetType, normalizeDate } from "./imports/normalizers";

function asAsyncIterable(file: File): AsyncIterable<Uint8Array> {
	return {
		async *[Symbol.asyncIterator]() {
			const buffer = new Uint8Array(await file.arrayBuffer());
			yield buffer;
		},
	};
}

function number(value: unknown): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function candidateItems(
	workbook: Record<string, unknown>,
): BudgetSnapshotItem[] {
	const rows = Array.isArray(workbook.budgetRows) ? workbook.budgetRows : [];
	const schedules = new Map(
		(Array.isArray(workbook.baselineRows) ? workbook.baselineRows : []).map(
			(row) => {
				const value = row as Record<string, unknown>;
				const rawIndex = String(value.index ?? "");
				return [normalizeHierarchyIndex(rawIndex), value];
			},
		),
	);

	return rows.flatMap((row) => {
		const value = row as Record<string, unknown>;
		const index =
			typeof value.index === "string"
				? normalizeHierarchyIndex(value.index)
				: null;
		const description =
			typeof value.description === "string" ? value.description : null;
		if (!index || !description) return [];
		const quantity = new Decimal(number(value.quantity));
		const unitCost = new Decimal(
			value.unitCost != null
				? number(value.unitCost)
				: number(value.laborUnitCost) +
						number(value.materialUnitCost) +
						number(value.equipmentUnitCost) +
						number(value.otherUnitCost),
		);
		const schedule = schedules.get(index) as
			| Record<string, unknown>
			| undefined;
		const type =
			(typeof value.type === "string"
				? normalizeBudgetType(value.type)
				: null) ?? (index.includes(".") ? "ITEM" : "STAGE");
		return [
			{
				index,
				parentIndex: index.includes(".")
					? index.slice(0, index.lastIndexOf("."))
					: null,
				type,
				description,
				unit: typeof value.unit === "string" ? value.unit : null,
				quantity,
				unitCost,
				totalCost:
					value.totalCost != null
						? new Decimal(number(value.totalCost))
						: quantity.times(unitCost),
				plannedStart: normalizeDate(schedule?.plannedStart),
				plannedEnd: normalizeDate(schedule?.plannedEnd),
			},
		];
	});
}

function sourceSnapshotItems(
	items: Array<{
		id: string;
		parentVersionId: string | null;
		index: string;
		type: string;
		description: string;
		unit: string | null;
		quantity: Decimal | null;
		unitCost: Decimal | null;
		totalCost: Decimal;
		plannedStart: Date | null;
		plannedEnd: Date | null;
	}>,
): BudgetSnapshotItem[] {
	const indexById = new Map(items.map((item) => [item.id, item.index]));
	return items.map((item) => ({
		index: item.index,
		parentIndex: item.parentVersionId
			? (indexById.get(item.parentVersionId) ?? null)
			: null,
		type: item.type === "STAGE" ? "STAGE" : "ITEM",
		description: item.description,
		unit: item.unit,
		quantity: item.quantity,
		unitCost: item.unitCost,
		totalCost: item.totalCost,
		plannedStart: item.plannedStart,
		plannedEnd: item.plannedEnd,
	}));
}

export function assertBudgetVersionChanges(
	comparison: BudgetVersionComparison,
) {
	if (hasBudgetVersionChanges(comparison)) return;
	throw new ConstructionError(
		"BUDGET_VERSION_NO_CHANGES",
		"Nao e possivel criar aditivo: o orcamento importado nao possui alteracoes.",
		422,
	);
}

function serializeDraftVersion(version: {
	id: string;
	versionNumber: number;
	label: string;
	status: string;
	isActive: boolean;
	sourceVersionId: string | null;
	kind: string | null;
	acrescimoBruto: unknown;
	supressao: unknown;
	impactoLiquido: unknown;
	percentualImpacto: unknown;
}): BudgetVersionDraft {
	return {
		id: version.id,
		index: String(version.versionNumber),
		label: version.label,
		version: version.versionNumber,
		status: "DRAFT",
		sourceVersionId: version.sourceVersionId,
		kind: version.kind,
		acrescimoBruto: toNullableNumber(version.acrescimoBruto),
		supressao: toNullableNumber(version.supressao),
		impactoLiquido: toNullableNumber(version.impactoLiquido),
		percentualImpacto: toNullableNumber(version.percentualImpacto),
	};
}

function markBatchFailed(importId: string, error: ConstructionError) {
	return prisma.importBatch.update({
		where: { id: importId },
		data: {
			status: "FAILED",
			errorSummary: { code: error.code, message: error.message },
		},
	});
}

export async function createBudgetVersionImport(
	actorId: string,
	workId: string,
	input: { title: string; file: File; idempotencyKey?: string },
): Promise<
	ImportPreviewPage & {
		role: "ORIGINAL" | "ADITIVO";
		sourceVersionId: string | null;
		comparison: BudgetImportComparisonSnapshot;
	}
> {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite)
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	if (!input.title.trim() || input.title.trim().length > 120) {
		throw new ConstructionError(
			"INVALID_TITLE",
			"Título do orçamento inválido",
			422,
		);
	}

	const resourceOwnerId = scope.resourceOwnerId;
	const page = await constructionImportBatchService.createBatch(
		resourceOwnerId,
		workId,
		{
			fileName: input.file.name,
			model: "orcamento-aditivo",
			title: input.title.trim(),
			file: asAsyncIterable(input.file),
			reason: input.idempotencyKey
				? `idempotency:${input.idempotencyKey}`
				: null,
		},
	);
	const batch = await prisma.importBatch.findFirst({
		where: { id: page.batchId, ownerId: resourceOwnerId, workId },
		select: { parsedWorkbook: true },
	});
	if (!batch?.parsedWorkbook || typeof batch.parsedWorkbook !== "object") {
		throw new ConstructionError(
			"IMPORT_PREVIEW_UNAVAILABLE",
			"Preview da importação indisponível",
			422,
		);
	}

	const active = await prisma.budgetVersion.findFirst({
		where: { ownerId: resourceOwnerId, workId, isActive: true },
		include: { items: true },
	});
	const sourceItems = active ? sourceSnapshotItems(active.items) : [];
	const exposure = await loadBudgetExposure(actorId, workId);
	const comparison = compareBudgetVersionSnapshots(
		sourceItems,
		candidateItems(batch.parsedWorkbook as Record<string, unknown>),
		exposure,
	);
	try {
		assertBudgetVersionChanges(comparison);
	} catch (error) {
		if (error instanceof ConstructionError)
			await markBatchFailed(page.batchId, error);
		throw error;
	}

	const role = active ? "ADITIVO" : "ORIGINAL";
	const sourceVersionId = active?.id ?? null;
	const serializedComparison = comparisonToJSON(comparison);
	await prisma.importBatch.update({
		where: { id: page.batchId },
		data: {
			preview: { role, sourceVersionId, comparison: serializedComparison },
		},
	});

	return {
		...page,
		role,
		sourceVersionId,
		comparison: serializedComparison,
	};
}

export type BudgetImportComparisonSnapshot = {
	sourceTotal: number;
	candidateTotal: number;
	grossIncrease: number;
	suppression: number;
	netImpact: number;
	impactPercent: number;
	countsByClassification: Record<string, number>;
	blockingIssues: BudgetVersionComparison["blockingIssues"];
	rows: Array<
		Omit<BudgetVersionComparison["rows"][number], "previous" | "candidate"> & {
			previous: BudgetSnapshotItemJSON | null;
			candidate: BudgetSnapshotItemJSON | null;
		}
	>;
};

export type BudgetSnapshotItemJSON = {
	index: string;
	parentIndex: string | null;
	type: "STAGE" | "ITEM";
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number;
	plannedStart: string | null;
	plannedEnd: string | null;
};

function snapshotItemToJSON(item: BudgetSnapshotItem): BudgetSnapshotItemJSON {
	return {
		index: item.index,
		parentIndex: item.parentIndex,
		type: item.type,
		description: item.description,
		unit: item.unit,
		quantity: item.quantity?.toNumber() ?? null,
		unitCost: item.unitCost?.toNumber() ?? null,
		totalCost: item.totalCost.toNumber(),
		plannedStart: item.plannedStart?.toISOString() ?? null,
		plannedEnd: item.plannedEnd?.toISOString() ?? null,
	};
}

function comparisonToJSON(
	comparison: BudgetVersionComparison,
): BudgetImportComparisonSnapshot {
	return {
		...comparison,
		rows: comparison.rows.map((row) => ({
			...row,
			previous: row.previous ? snapshotItemToJSON(row.previous) : null,
			candidate: row.candidate ? snapshotItemToJSON(row.candidate) : null,
		})),
	};
}

export async function getBudgetVersionImportPreview(
	actorId: string,
	workId: string,
	importId: string,
	query: { page?: number; limit?: number; classification?: string },
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const resourceOwnerId = scope.resourceOwnerId;

	const batch = await prisma.importBatch.findFirst({
		where: {
			id: importId,
			ownerId: resourceOwnerId,
			workId,
			model: "orcamento-aditivo",
		},
		select: {
			id: true,
			title: true,
			status: true,
			preview: true,
			parsedWorkbook: true,
		},
	});
	if (!batch) {
		throw new ConstructionError(
			"IMPORT_NOT_FOUND",
			"Importação de orçamento não encontrada",
			404,
		);
	}

	const persisted = batch.preview as {
		role: "ORIGINAL" | "ADITIVO";
		sourceVersionId: string | null;
		comparison: BudgetImportComparisonSnapshot;
	} | null;
	let role: "ORIGINAL" | "ADITIVO";
	let sourceVersionId: string | null;
	let comparison: BudgetImportComparisonSnapshot;
	if (persisted?.comparison) {
		role = persisted.role;
		sourceVersionId = persisted.sourceVersionId;
		comparison = persisted.comparison;
	} else {
		const active = await prisma.budgetVersion.findFirst({
			where: { ownerId: resourceOwnerId, workId, isActive: true },
			include: { items: true },
		});
		const sourceItems = active ? sourceSnapshotItems(active.items) : [];
		const exposure = await loadBudgetExposure(actorId, workId);
		role = active ? "ADITIVO" : "ORIGINAL";
		sourceVersionId = active?.id ?? null;
		comparison = comparisonToJSON(
			compareBudgetVersionSnapshots(
				sourceItems,
				candidateItems(batch.parsedWorkbook as Record<string, unknown>),
				exposure,
			),
		);
	}

	const filtered =
		query.classification &&
		comparison.rows.some((row) =>
			row.classification.includes(
				query.classification as BudgetVersionComparison["rows"][number]["classification"][number],
			),
		)
			? comparison.rows.filter((row) =>
					row.classification.includes(
						query.classification as BudgetVersionComparison["rows"][number]["classification"][number],
					),
				)
			: comparison.rows;

	const page = Math.max(query.page ?? 1, 1);
	const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
	const start = (page - 1) * limit;

	return {
		importId: batch.id,
		title: batch.title,
		status: batch.status,
		role,
		sourceVersionId,
		summary: {
			sourceTotal: comparison.sourceTotal,
			candidateTotal: comparison.candidateTotal,
			grossIncrease: comparison.grossIncrease,
			suppression: comparison.suppression,
			netImpact: comparison.netImpact,
			impactPercent: comparison.impactPercent,
			countsByClassification: comparison.countsByClassification,
		},
		conflicts: comparison.blockingIssues,
		changes: {
			data: filtered.slice(start, start + limit),
			page,
			limit,
			total: filtered.length,
		},
	};
}

export async function confirmBudgetVersionImport(
	actorId: string,
	workId: string,
	importId: string,
	input: { expectedSourceVersionId?: string | null; idempotencyKey?: string },
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite)
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	const resourceOwnerId = scope.resourceOwnerId;
	const batch = await prisma.importBatch.findFirst({
		where: {
			id: importId,
			ownerId: resourceOwnerId,
			workId,
			model: "orcamento-aditivo",
		},
		select: {
			id: true,
			title: true,
			status: true,
			confirmedImportId: true,
			invalidCount: true,
			parsedWorkbook: true,
		},
	});
	if (!batch) {
		throw new ConstructionError(
			"IMPORT_NOT_FOUND",
			"Importação de orçamento não encontrada",
			404,
		);
	}
	if (batch.status === "CONFIRMED" && batch.confirmedImportId) {
		const confirmed = await prisma.budgetVersion.findFirst({
			where: {
				id: batch.confirmedImportId,
				ownerId: resourceOwnerId,
				workId,
			},
		});
		if (!confirmed) {
			throw new ConstructionError(
				"IMPORT_NOT_READY",
				"A importação não está pronta para confirmação",
				422,
			);
		}
		return serializeDraftVersion(confirmed);
	}
	if (
		batch.status !== "READY" ||
		!batch.parsedWorkbook ||
		typeof batch.parsedWorkbook !== "object"
	) {
		throw new ConstructionError(
			"IMPORT_NOT_READY",
			"A importação não está pronta para confirmação",
			422,
		);
	}
	if (batch.invalidCount > 0) {
		throw new ConstructionError(
			"BUDGET_IMPORT_INVALID_ROWS",
			"A importação possui linhas inválidas e não pode ser confirmada.",
			422,
		);
	}

	const active = await prisma.budgetVersion.findFirst({
		where: { ownerId: resourceOwnerId, workId, isActive: true },
		include: { items: true },
	});
	if ((input.expectedSourceVersionId ?? null) !== (active?.id ?? null)) {
		throw new ConstructionError(
			"BUDGET_VERSION_SOURCE_CHANGED",
			"A versão de origem não está mais vigente",
			409,
		);
	}

	const candidate = candidateItems(
		batch.parsedWorkbook as Record<string, unknown>,
	);
	const source = active ? sourceSnapshotItems(active.items) : [];
	const exposure = await loadBudgetExposure(actorId, workId);
	const comparison = compareBudgetVersionSnapshots(source, candidate, exposure);
	assertBudgetVersionChanges(comparison);
	if (comparison.blockingIssues.length > 0) {
		throw new ConstructionError(
			"BUDGET_IMPORT_BLOCKED",
			"O orçamento importado possui conflitos bloqueantes",
			422,
		);
	}
	const draft = await createDraftBudgetVersionFromSnapshot(
		resourceOwnerId,
		workId,
		{
			label: batch.title ?? "Aditivo importado",
			sourceVersionId: active?.id ?? null,
			budgetImportId: importId,
			items: candidate,
			impact: {
				grossIncrease: new Decimal(comparison.grossIncrease),
				suppression: new Decimal(comparison.suppression),
				netImpact: new Decimal(comparison.netImpact),
				impactPercent: new Decimal(comparison.impactPercent),
			},
		},
	);
	await prisma.importBatch.update({
		where: { id: importId },
		data: {
			status: "CONFIRMED",
			confirmedAt: new Date(),
			confirmedImportId: draft.id,
		},
	});
	return draft;
}
