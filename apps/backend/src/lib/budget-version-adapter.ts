import Decimal from "decimal.js";
import { enqueueBudgetProjection } from "../modules/construction-planning/budget-projection-outbox.service";
import {
	type BudgetSnapshotItem,
	sumLeafBudgetSnapshotCosts,
} from "../modules/construction-planning/budget-version-comparison";
import { resolveActiveImportId } from "../modules/construction-planning/calculators/active-scope";
import { ConstructionError } from "./errors";
import { toFiniteNumber, toNullableNumber } from "./number-utils";
import { prisma } from "./prisma";
import { resolveResourceScope } from "./resource-scope";

const toFinite = (value: unknown): Decimal =>
	new Decimal(toFiniteNumber(value));

export type BudgetAnalysisVersion = {
	budgetVersionId: string;
	scheduleVersionId: string | null;
	mode: "EFFECTIVE" | "SELECTED_VERSION";
};

export type BudgetItemReference = {
	identityId: string;
	versionItemId: string;
	versionId: string;
};

export type BudgetVersionStatus =
	| "DRAFT"
	| "PENDING_APPROVAL"
	| "ACTIVE"
	| "REJECTED"
	| "SUPERSEDED"
	| "ARCHIVED";

export type BudgetVersionSummary = {
	id: string;
	index: string;
	version: number;
	label: string;
	status: BudgetVersionStatus;
	isActive: boolean;
	sourceVersionId: string | null;
	approvalRequestId: string | null;
	submittedAt: string | null;
	reason: string | null;
	kind: string | null;
	acrescimoBruto: number | null;
	supressao: number | null;
	impactoLiquido: number | null;
	percentualImpacto: number | null;
};

export type BudgetVersionDraft = {
	id: string;
	index: string;
	label: string;
	version: number;
	status: "DRAFT";
	sourceVersionId: string | null;
	kind: string | null;
	acrescimoBruto: number | null;
	supressao: number | null;
	impactoLiquido: number | null;
	percentualImpacto: number | null;
};

export type BudgetVersionSnapshotInput = {
	label: string;
	sourceVersionId: string | null;
	budgetImportId?: string | null;
	items: BudgetSnapshotItem[];
	impact: {
		grossIncrease: Decimal;
		suppression: Decimal;
		netImpact: Decimal;
		impactPercent: Decimal;
	};
};

export type BudgetVersionItemDTO = {
	id: string;
	index: string;
	type: string;
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number;
	plannedStart: string | null;
	plannedEnd: string | null;
	parentIndex: string | null;
	sortOrder: number;
};

export type BudgetVersionDetail = BudgetVersionSummary & {
	totals: { totalCost: number };
	items: BudgetVersionItemDTO[];
};

export type BudgetVersionSubmitResult = {
	budgetVersionId: string;
	status: "APPROVED" | "PENDING";
	approvalRequestId: string | null;
};

// Baseline: primeira versao criada para a obra, imutavel.
export const BASELINE_VERSION_LABEL = "Baseline";

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "P2002"
	);
}

function resolveNewItemTotal(item: BudgetVersionNewItemInput): Decimal {
	if (item.totalCost != null) return toFinite(item.totalCost);
	if (item.quantity == null || item.unitCost == null) return new Decimal(0);
	return new Decimal(item.quantity).times(item.unitCost);
}

function assertWorkScope(actorId: string, workId: string) {
	return resolveResourceScope(actorId, { workId });
}

export async function getOrCreateBaselineVersion(
	actorId: string,
	workId: string,
): Promise<string> {
	await assertWorkScope(actorId, workId);

	const existing = await prisma.budgetVersion.findFirst({
		// A baseline criada por seeds/imports antigos pode ter outro label
		// (ex.: "Baseline 2026"), mas a versão 1 continua sendo a baseline
		// estrutural da obra. O número é a chave canônica para tornar o GET
		// idempotente e evitar P2002 em (workId, versionNumber).
		where: {
			workId,
			OR: [{ versionNumber: 1 }, { label: BASELINE_VERSION_LABEL }],
		},
		select: { id: true },
	});
	if (existing) return existing.id;

	return prisma.$transaction(async (tx) => {
		const again = await tx.budgetVersion.findFirst({
			where: {
				workId,
				OR: [{ versionNumber: 1 }, { label: BASELINE_VERSION_LABEL }],
			},
			select: { id: true },
		});
		if (again) return again.id;

		const work = await tx.constructionWork.findFirst({
			where: { id: workId },
			select: { ownerId: true, activeImportId: true },
		});
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		let versionId: string;
		try {
			const version = await tx.budgetVersion.create({
				data: {
					ownerId: work.ownerId,
					workId,
					versionNumber: 1,
					label: BASELINE_VERSION_LABEL,
					status: "VIGENTE",
					isActive: true,
				},
			});
			versionId = version.id;
		} catch (error) {
			// Corrida entre conexoes: outra transacao criou a baseline primeiro.
			// A transacao corrente foi abortada pelo P2002, entao a consulta de
			// retorno usa o cliente global (a baseline da outra conexao ja
			// commitou antes de liberar o lock de unique).
			if (!isUniqueViolation(error)) throw error;
			const concurrent = await prisma.budgetVersion.findFirst({
				where: {
					workId,
					OR: [{ versionNumber: 1 }, { label: BASELINE_VERSION_LABEL }],
				},
				select: { id: true },
			});
			if (concurrent) return concurrent.id;
			throw error;
		}
		// Somente os itens do import ativo compoem a baseline: itens orfaos de
		// imports anteriores possuem os mesmos indices e violariam a unicidade
		// de budgetItemIdentity(workId, index) — a mesma regra de "orcamento
		// vigente" usada na arvore da obra (works.repository).
		const activeImportId = await resolveActiveImportId(
			work.ownerId,
			workId,
			work.activeImportId,
		);
		const items = await tx.constructionBudgetItem.findMany({
			where: {
				workId,
				importId: activeImportId ?? "__NO_ACTIVE_IMPORT__",
			},
			orderBy: [{ sortOrder: "asc" }, { index: "asc" }],
			select: {
				id: true,
				parentId: true,
				index: true,
				type: true,
				description: true,
				unit: true,
				quantity: true,
				unitCost: true,
				totalCost: true,
				sortOrder: true,
			},
		});

		const identityByIndex = new Map<string, string>();
		for (const item of items) {
			const identity = await tx.budgetItemIdentity.upsert({
				where: { workId_index: { workId, index: item.index } },
				create: { ownerId: work.ownerId, workId, index: item.index },
				update: {},
				select: { id: true },
			});
			identityByIndex.set(item.index, identity.id);
		}

		const versionItemByItemId = new Map<string, string>();
		for (const item of items) {
			const identityId = identityByIndex.get(item.index);
			if (!identityId) continue;
			const versionItem = await tx.budgetVersionItem.create({
				data: {
					versionId,
					identityId,
					parentVersionId: null,
					index: item.index,
					type: item.type,
					description: item.description,
					unit: item.unit,
					quantity: item.quantity,
					unitCost: item.unitCost,
					totalCost: item.totalCost,
					sortOrder: item.sortOrder,
				},
				select: { id: true },
			});
			versionItemByItemId.set(item.id, versionItem.id);
		}

		// Vincula parentVersionId pela relacao pai/filho dos itens originais.
		for (const item of items) {
			if (!item.parentId) continue;
			const parentVersionItemId = versionItemByItemId.get(item.parentId);
			const currentId = versionItemByItemId.get(item.id);
			if (!parentVersionItemId || !currentId) continue;
			await tx.budgetVersionItem.update({
				where: { id: currentId },
				data: { parentVersionId: parentVersionItemId },
			});
		}

		return versionId;
	});
}

export async function resolveBudgetAnalysisVersion(
	actorId: string,
	workId: string,
	request: {
		mode?: "EFFECTIVE" | "SELECTED_VERSION";
		budgetVersionId?: string;
		scheduleVersionId?: string;
	},
): Promise<BudgetAnalysisVersion> {
	await assertWorkScope(actorId, workId);

	const mode = request.mode ?? "EFFECTIVE";

	if (mode === "SELECTED_VERSION") {
		if (!request.budgetVersionId) {
			throw new ConstructionError(
				"SELECTED_VERSION_REQUIRES_BUDGET_VERSION",
				"Selecione a versao de orcamento para analise",
				422,
			);
		}
		const budgetVersion = await prisma.budgetVersion.findFirst({
			where: { id: request.budgetVersionId, workId },
			select: { id: true, isActive: true },
		});
		if (!budgetVersion) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Versao de orcamento nao encontrada",
				404,
			);
		}
		return {
			budgetVersionId: budgetVersion.id,
			scheduleVersionId: request.scheduleVersionId ?? null,
			mode: "SELECTED_VERSION",
		};
	}

	const activeVersion = await prisma.budgetVersion.findFirst({
		where: { workId, isActive: true },
		select: { id: true },
	});
	if (!activeVersion) {
		const baselineId = await getOrCreateBaselineVersion(actorId, workId);
		return {
			budgetVersionId: baselineId,
			scheduleVersionId: null,
			mode: "EFFECTIVE",
		};
	}

	return {
		budgetVersionId: activeVersion.id,
		scheduleVersionId: null,
		mode: "EFFECTIVE",
	};
}

export async function resolveBudgetItemReference(
	actorId: string,
	workId: string,
	index: string,
): Promise<BudgetItemReference | null> {
	const resolved = await resolveBudgetAnalysisVersion(actorId, workId, {});

	const versionItem = await prisma.budgetVersionItem.findFirst({
		where: { versionId: resolved.budgetVersionId, index },
		select: { id: true, identityId: true },
	});
	if (!versionItem) return null;

	return {
		identityId: versionItem.identityId,
		versionItemId: versionItem.id,
		versionId: resolved.budgetVersionId,
	};
}

export type BudgetVersionNewItemInput = {
	index: string;
	parentIndex?: string | null;
	type: string;
	description: string;
	unit?: string | null;
	quantity?: number | null;
	unitCost?: number | null;
	totalCost?: number | null;
	plannedStart?: string | null;
	plannedEnd?: string | null;
	sortOrder?: number;
};

// Aditivo: cria uma nova versao em RASCUNHO (nao ativa) a partir da versao
// vigente. A ativacao apos aprovacao ocorre via BUDGET_VERSION_ACTIVATE.
export async function createDraftBudgetVersion(
	actorId: string,
	workId: string,
	input: {
		label: string;
		itemOverrides?: Array<{ index: string; totalCost: number }>;
		newItems?: BudgetVersionNewItemInput[];
	},
): Promise<BudgetVersionDraft> {
	await assertWorkScope(actorId, workId);

	const current = await resolveBudgetAnalysisVersion(actorId, workId, {});
	const sourceItems = await prisma.budgetVersionItem.findMany({
		where: { versionId: current.budgetVersionId },
		orderBy: [{ sortOrder: "asc" }, { index: "asc" }],
		select: {
			id: true,
			identityId: true,
			parentVersionId: true,
			index: true,
			type: true,
			description: true,
			unit: true,
			quantity: true,
			unitCost: true,
			totalCost: true,
			plannedStart: true,
			plannedEnd: true,
			sortOrder: true,
		},
	});
	if (sourceItems.length === 0) {
		throw new ConstructionError(
			"EMPTY_BUDGET_VERSION",
			"Versao de orcamento sem itens",
			422,
		);
	}

	// ORC-005 (DEC-008): aditivo global (sem distribuicao por item) e
	// proibido por padrao — excecao exigiria justificativa formal e
	// aprovacao especial (nao implementada).
	if (
		(input.itemOverrides?.length ?? 0) === 0 &&
		(input.newItems?.length ?? 0) === 0
	) {
		throw new ConstructionError(
			"GLOBAL_AMENDMENT_FORBIDDEN",
			"Aditivo deve alterar itens especificos do orcamento (aditivo global nao e permitido)",
			422,
		);
	}

	const overrides = new Map(
		(input.itemOverrides ?? []).map((override) => [
			override.index,
			override.totalCost,
		]),
	);
	const newItems = input.newItems ?? [];
	const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
	const sourceCostItems = sourceItems.map((item) => ({
		index: item.index,
		parentIndex: item.parentVersionId
			? (sourceById.get(item.parentVersionId)?.index ?? null)
			: null,
		totalCost: toFinite(item.totalCost),
	}));
	const candidateCostItems = [
		...sourceCostItems.map((item) => ({
			...item,
			totalCost: toFinite(overrides.get(item.index) ?? item.totalCost),
		})),
		...newItems.map((item) => ({
			index: item.index,
			parentIndex: item.parentIndex ?? null,
			totalCost: resolveNewItemTotal(item),
		})),
	];

	// ORC-004 (DEC-007): tipo e impacto do aditivo derivados da diferenca
	// entre o total da versao vigente e o total apos overrides/novos itens.
	const baseTotal = sumLeafBudgetSnapshotCosts(sourceCostItems);
	const newTotal = sumLeafBudgetSnapshotCosts(candidateCostItems);
	const impactoLiquido = newTotal.minus(baseTotal);
	const acrescimo = impactoLiquido.greaterThan(0)
		? impactoLiquido
		: new Decimal(0);
	const supressao = impactoLiquido.lessThan(0)
		? impactoLiquido.abs()
		: new Decimal(0);
	const hasAcrescimo = acrescimo.greaterThan(0);
	const hasSupressao = supressao.greaterThan(0);
	const kind =
		hasAcrescimo && hasSupressao
			? "MISTO"
			: hasAcrescimo
				? "ACRESCIMO"
				: hasSupressao
					? "SUPRESSAO"
					: null;
	const percentualImpacto = baseTotal.greaterThan(0)
		? impactoLiquido.dividedBy(baseTotal).mul(100)
		: new Decimal(0);

	const sourceIndexes = new Set(sourceItems.map((item) => item.index));
	const newIndexes = new Set(newItems.map((item) => item.index));
	if (newIndexes.size !== newItems.length) {
		throw new ConstructionError(
			"DUPLICATE_BUDGET_INDEX",
			"Indice duplicado entre os novos itens do aditivo",
			422,
		);
	}
	for (const item of newItems) {
		if (sourceIndexes.has(item.index)) {
			throw new ConstructionError(
				"DUPLICATE_BUDGET_INDEX",
				"Indice duplicado no orcamento",
				422,
			);
		}
		if (
			item.parentIndex &&
			!sourceIndexes.has(item.parentIndex) &&
			!newIndexes.has(item.parentIndex)
		) {
			throw new ConstructionError(
				"INVALID_PARENT_INDEX",
				"Etapa pai do novo item nao existe no aditivo",
				422,
			);
		}
	}

	const result = await prisma.$transaction(async (tx) => {
		const next = await tx.budgetVersion.count({
			where: { workId },
		});
		let version: { id: string; versionNumber: number };
		try {
			version = await tx.budgetVersion.create({
				data: {
					ownerId:
						(
							await tx.constructionWork.findFirst({
								where: { id: workId },
								select: { ownerId: true },
							})
						)?.ownerId ?? "",
					workId,
					versionNumber: next + 1,
					label: input.label,
					status: "RASCUNHO",
					isActive: false,
					sourceVersionId: current.budgetVersionId,
					kind,
					acrescimoBruto: acrescimo,
					supressao,
					impactoLiquido,
					percentualImpacto,
				},
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConstructionError(
					"DUPLICATE_BUDGET_VERSION",
					"Versao de orcamento duplicada para esta obra",
					409,
				);
			}
			throw error;
		}

		const newIdBySourceId = new Map<string, string>();
		for (const item of sourceItems) {
			const created = await tx.budgetVersionItem.create({
				data: {
					versionId: version.id,
					identityId: item.identityId,
					sourceVersionItemId: item.id,
					parentVersionId: null,
					index: item.index,
					type: item.type,
					description: item.description,
					unit: item.unit,
					quantity: item.quantity,
					unitCost: item.unitCost,
					totalCost: overrides.get(item.index) ?? item.totalCost,
					plannedStart: item.plannedStart,
					plannedEnd: item.plannedEnd,
					sortOrder: item.sortOrder,
				},
				select: { id: true },
			});
			newIdBySourceId.set(item.id, created.id);
		}

		const newIdByIndex = new Map<string, string>();
		for (const item of newItems) {
			const identity = await tx.budgetItemIdentity.create({
				data: {
					ownerId:
						(
							await tx.constructionWork.findFirst({
								where: { id: workId },
								select: { ownerId: true },
							})
						)?.ownerId ?? "",
					workId,
					index: item.index,
				},
				select: { id: true },
			});
			const quantity = item.quantity ?? null;
			const unitCost = item.unitCost ?? null;
			const totalCost = resolveNewItemTotal(item).toNumber();
			const created = await tx.budgetVersionItem.create({
				data: {
					versionId: version.id,
					identityId: identity.id,
					sourceVersionItemId: null,
					parentVersionId: null,
					index: item.index,
					type: item.type,
					description: item.description,
					unit: item.unit ?? null,
					quantity,
					unitCost,
					totalCost,
					plannedStart: item.plannedStart ? new Date(item.plannedStart) : null,
					plannedEnd: item.plannedEnd ? new Date(item.plannedEnd) : null,
					sortOrder: item.sortOrder ?? 0,
				},
				select: { id: true },
			});
			newIdByIndex.set(item.index, created.id);
		}

		for (const item of sourceItems) {
			if (!item.parentVersionId) continue;
			const parentId = newIdBySourceId.get(item.parentVersionId);
			const currentId = newIdBySourceId.get(item.id);
			if (!parentId || !currentId) continue;
			await tx.budgetVersionItem.update({
				where: { id: currentId },
				data: { parentVersionId: parentId },
			});
		}

		for (const item of newItems) {
			if (!item.parentIndex) continue;
			const parentId =
				newIdByIndex.get(item.parentIndex) ??
				newIdBySourceId.get(
					sourceItems.find((source) => source.index === item.parentIndex)?.id ??
						"",
				);
			const currentId = newIdByIndex.get(item.index);
			if (!parentId || !currentId) continue;
			await tx.budgetVersionItem.update({
				where: { id: currentId },
				data: { parentVersionId: parentId },
			});
		}

		return version;
	});

	return {
		id: result.id,
		index: String(result.versionNumber),
		label: input.label,
		version: result.versionNumber,
		status: "DRAFT",
		sourceVersionId: current.budgetVersionId,
		kind,
		acrescimoBruto: toFiniteNumber(acrescimo),
		supressao: toFiniteNumber(supressao),
		impactoLiquido: toFiniteNumber(impactoLiquido),
		percentualImpacto: toFiniteNumber(percentualImpacto),
	};
}

export async function createDraftBudgetVersionFromSnapshot(
	actorId: string,
	workId: string,
	input: BudgetVersionSnapshotInput,
): Promise<BudgetVersionDraft> {
	await assertWorkScope(actorId, workId);

	const source = input.sourceVersionId
		? await prisma.budgetVersion.findFirst({
				where: {
					id: input.sourceVersionId,
					workId,
					isActive: true,
				},
				include: {
					items: {
						orderBy: [{ sortOrder: "asc" }, { index: "asc" }],
					},
				},
			})
		: null;
	if (input.sourceVersionId && !source) {
		throw new ConstructionError(
			"BUDGET_VERSION_SOURCE_CHANGED",
			"A versao de origem nao esta mais vigente",
			409,
		);
	}

	const sourceByIndex = new Map(
		(source?.items ?? []).map((item) => [item.index, item]),
	);
	const snapshotOwnerId =
		source?.ownerId ??
		(
			await prisma.constructionWork.findFirst({
				where: { id: workId },
				select: { ownerId: true },
			})
		)?.ownerId ??
		"";
	const candidateIndexes = new Set<string>();
	for (const item of input.items) {
		if (candidateIndexes.has(item.index)) {
			throw new ConstructionError(
				"DUPLICATE_BUDGET_INDEX",
				"Indice duplicado no snapshot do orcamento",
				422,
			);
		}
		candidateIndexes.add(item.index);
		if (item.parentIndex && !candidateIndexes.has(item.parentIndex)) {
			const parentExists = input.items.some(
				(candidate) => candidate.index === item.parentIndex,
			);
			if (!parentExists) {
				throw new ConstructionError(
					"INVALID_PARENT_INDEX",
					"Etapa pai do novo item nao existe no snapshot",
					422,
				);
			}
		}
	}

	const kind =
		input.impact.grossIncrease.greaterThan(0) &&
		input.impact.suppression.greaterThan(0)
			? "MISTO"
			: input.impact.grossIncrease.greaterThan(0)
				? "ACRESCIMO"
				: input.impact.suppression.greaterThan(0)
					? "SUPRESSAO"
					: null;

	const result = await prisma.$transaction(async (tx) => {
		const current = input.sourceVersionId
			? await tx.budgetVersion.findFirst({
					where: { id: input.sourceVersionId, workId, isActive: true },
					select: { id: true },
				})
			: { id: null };
		if (input.sourceVersionId && !current) {
			throw new ConstructionError(
				"BUDGET_VERSION_SOURCE_CHANGED",
				"A versao de origem nao esta mais vigente",
				409,
			);
		}

		const next = await tx.budgetVersion.count({ where: { workId } });
		let version: { id: string; versionNumber: number };
		try {
			version = await tx.budgetVersion.create({
				data: {
					ownerId: snapshotOwnerId,
					workId,
					versionNumber: next + 1,
					label: input.label,
					status: "RASCUNHO",
					isActive: false,
					sourceVersionId: input.sourceVersionId,
					budgetImportId: input.budgetImportId ?? null,
					kind,
					acrescimoBruto: input.impact.grossIncrease,
					supressao: input.impact.suppression,
					impactoLiquido: input.impact.netImpact,
					percentualImpacto: input.impact.impactPercent,
				},
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConstructionError(
					"DUPLICATE_BUDGET_VERSION",
					"Versao de orcamento duplicada para esta obra",
					409,
				);
			}
			throw error;
		}

		const idByIndex = new Map<string, string>();
		for (const [sortOrder, item] of input.items.entries()) {
			const sourceItem = sourceByIndex.get(item.index);
			const identityId =
				sourceItem?.identityId ??
				(
					await tx.budgetItemIdentity.create({
						data: {
							ownerId: snapshotOwnerId,
							workId,
							index: item.index,
						},
						select: { id: true },
					})
				).id;
			const created = await tx.budgetVersionItem.create({
				data: {
					versionId: version.id,
					identityId,
					sourceVersionItemId: sourceItem?.id ?? null,
					parentVersionId: null,
					index: item.index,
					type: item.type,
					description: item.description,
					unit: item.unit,
					quantity: item.quantity,
					unitCost: item.unitCost,
					totalCost: item.totalCost,
					plannedStart: item.plannedStart ?? sourceItem?.plannedStart ?? null,
					plannedEnd: item.plannedEnd ?? sourceItem?.plannedEnd ?? null,
					sortOrder,
				},
				select: { id: true },
			});
			idByIndex.set(item.index, created.id);
		}

		for (const item of input.items) {
			if (!item.parentIndex) continue;
			const currentId = idByIndex.get(item.index);
			const parentId = idByIndex.get(item.parentIndex);
			if (!currentId || !parentId) continue;
			await tx.budgetVersionItem.update({
				where: { id: currentId },
				data: { parentVersionId: parentId },
			});
		}

		return version;
	});

	return {
		id: result.id,
		index: String(result.versionNumber),
		label: input.label,
		version: result.versionNumber,
		status: "DRAFT",
		sourceVersionId: input.sourceVersionId,
		kind,
		acrescimoBruto: input.impact.grossIncrease.toNumber(),
		supressao: input.impact.suppression.toNumber(),
		impactoLiquido: input.impact.netImpact.toNumber(),
		percentualImpacto: input.impact.impactPercent.toNumber(),
	};
}

function mapVersionStatus(
	status: string | null | undefined,
	approvalRequestId: string | null | undefined,
	isActive: boolean,
): BudgetVersionStatus {
	if (status === "VIGENTE" && isActive) return "ACTIVE";
	if (status === "SUBSTITUIDO" || (status === "VIGENTE" && !isActive)) {
		return "SUPERSEDED";
	}
	if (status === "ARQUIVADO") return "ARCHIVED";
	if (status === "RECUSADO") return "REJECTED";
	if (approvalRequestId) return "PENDING_APPROVAL";
	return "DRAFT";
}

function serializeVersion(version: {
	id: string;
	versionNumber: number;
	label: string;
	status: string;
	isActive: boolean;
	sourceVersionId: string | null;
	approvalRequestId: string | null;
	submittedAt: Date | null;
	reason: string | null;
	kind: string | null;
	acrescimoBruto: unknown;
	supressao: unknown;
	impactoLiquido: unknown;
	percentualImpacto: unknown;
}): BudgetVersionSummary {
	return {
		id: version.id,
		index: String(version.versionNumber),
		version: version.versionNumber,
		label: version.label,
		status: mapVersionStatus(
			version.status,
			version.approvalRequestId,
			version.isActive,
		),
		isActive: version.isActive,
		sourceVersionId: version.sourceVersionId,
		approvalRequestId: version.approvalRequestId,
		submittedAt: version.submittedAt?.toISOString() ?? null,
		reason: version.reason,
		kind: version.kind,
		acrescimoBruto: toNullableNumber(version.acrescimoBruto),
		supressao: toNullableNumber(version.supressao),
		impactoLiquido: toNullableNumber(version.impactoLiquido),
		percentualImpacto: toNullableNumber(version.percentualImpacto),
	};
}

export async function listBudgetVersions(
	actorId: string,
	workId: string,
): Promise<BudgetVersionSummary[]> {
	await assertWorkScope(actorId, workId);

	const versions = await prisma.budgetVersion.findMany({
		where: { workId },
		orderBy: { versionNumber: "asc" },
	});
	return versions.map(serializeVersion);
}

export async function getBudgetVersion(
	actorId: string,
	workId: string,
	versionId: string,
): Promise<BudgetVersionDetail> {
	await assertWorkScope(actorId, workId);

	const version = await prisma.budgetVersion.findUnique({
		where: { id: versionId },
	});
	if (!version || version.workId !== workId) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Versao de orcamento nao encontrada",
			404,
		);
	}

	const items = await prisma.budgetVersionItem.findMany({
		where: { versionId },
		orderBy: [{ sortOrder: "asc" }, { index: "asc" }],
		select: {
			id: true,
			identityId: true,
			parentVersionId: true,
			index: true,
			type: true,
			description: true,
			unit: true,
			quantity: true,
			unitCost: true,
			totalCost: true,
			plannedStart: true,
			plannedEnd: true,
			sortOrder: true,
		},
	});

	const parentIndexById = new Map<string, string>();
	for (const item of items) {
		if (item.parentVersionId) {
			const parent = items.find(
				(candidate) => candidate.id === item.parentVersionId,
			);
			if (parent) parentIndexById.set(item.id, parent.index);
		}
	}

	const parentIds = new Set(
		items
			.map((item) => item.parentVersionId)
			.filter((id): id is string => id !== null),
	);
	const totalCost = items.reduce(
		(sum, item) => sum + (parentIds.has(item.id) ? 0 : Number(item.totalCost)),
		0,
	);

	return {
		...serializeVersion(version),
		totals: { totalCost },
		items: items.map((item) => ({
			id: item.id,
			index: item.index,
			type: item.type,
			description: item.description,
			unit: item.unit,
			quantity: item.quantity === null ? null : Number(item.quantity),
			unitCost: item.unitCost === null ? null : Number(item.unitCost),
			totalCost: Number(item.totalCost),
			plannedStart: item.plannedStart?.toISOString() ?? null,
			plannedEnd: item.plannedEnd?.toISOString() ?? null,
			parentIndex: parentIndexById.get(item.id) ?? null,
			sortOrder: item.sortOrder,
		})),
	};
}

export async function submitBudgetVersion(
	actorId: string,
	workId: string,
	versionId: string,
	input: { reason?: string },
): Promise<BudgetVersionSubmitResult> {
	await assertWorkScope(actorId, workId);

	const version = await prisma.budgetVersion.findUnique({
		where: { id: versionId },
	});
	if (!version || version.workId !== workId) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Versao de orcamento nao encontrada",
			404,
		);
	}
	if (version.status === "VIGENTE") {
		throw new ConstructionError(
			"BUDGET_VERSION_ACTIVE",
			"Versao de orcamento ja esta ativa",
			422,
		);
	}
	if (version.status === "RECUSADO") {
		throw new ConstructionError(
			"BUDGET_VERSION_REJECTED",
			"Versao de orcamento recusada nao pode ser submetida",
			422,
		);
	}
	if (version.status === "ARQUIVADO") {
		throw new ConstructionError(
			"BUDGET_VERSION_ARCHIVED",
			"Versao de orcamento arquivada nao pode ser submetida",
			422,
		);
	}
	if (version.approvalRequestId) {
		throw new ConstructionError(
			"BUDGET_VERSION_ALREADY_SUBMITTED",
			"Versao de orcamento ja submetida para aprovacao",
			409,
		);
	}

	const { submitApproval } = await import(
		"../modules/governance/approval.service"
	);
	const submitted = await submitApproval({
		actorId,
		resourceType: "BUDGET_VERSION",
		resourceId: workId,
		effectAction: "BUDGET_VERSION_ACTIVATE",
		payload: { workId, budgetVersionId: versionId },
		expectedVersion: version.versionNumber,
		idempotencyKey: `budget-version-submit:${versionId}`,
	});

	await prisma.budgetVersion.update({
		where: { id: versionId },
		data: {
			approvalRequestId: submitted.approvalRequestId,
			reason: input.reason ?? null,
			submittedAt: new Date(),
		},
	});
	// A nova versao invalida a projeção operacional até que a aprovação seja
	// executada com sucesso. O estado fica fora da transação de projeção para
	// que falhas de refresh não desapareçam junto com o rollback.
	await prisma.budgetProjectionState.upsert({
		where: { workId },
		create: {
			ownerId: version.ownerId,
			workId,
			status: "STALE",
			sourceVersionId: versionId,
		},
		update: {
			ownerId: version.ownerId,
			status: "STALE",
			sourceVersionId: versionId,
			lastError: null,
		},
	});
	await enqueueBudgetProjection({
		ownerId: version.ownerId,
		workId,
		sourceVersionId: versionId,
	});

	return {
		budgetVersionId: versionId,
		status: submitted.status,
		approvalRequestId: submitted.approvalRequestId,
	};
}

export async function archiveBudgetVersion(
	actorId: string,
	workId: string,
	versionId: string,
	reason?: string,
): Promise<BudgetVersionSummary> {
	const scope = await assertWorkScope(actorId, workId);
	const version = await prisma.budgetVersion.findFirst({
		where: { id: versionId, workId, ownerId: scope.resourceOwnerId },
	});
	if (!version) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Versao de orcamento nao encontrada",
			404,
		);
	}
	if (version.isActive || version.status === "VIGENTE") {
		throw new ConstructionError(
			"BUDGET_VERSION_ACTIVE",
			"A versao vigente nao pode ser arquivada",
			422,
		);
	}
	if (version.approvalRequestId) {
		throw new ConstructionError(
			"BUDGET_VERSION_PENDING_APPROVAL",
			"Cancele ou conclua a aprovacao antes de arquivar a versao",
			422,
		);
	}
	if (version.status === "ARQUIVADO") return serializeVersion(version);
	const archived = await prisma.budgetVersion.update({
		where: { id: version.id },
		data: {
			status: "ARQUIVADO",
			isActive: false,
			reason: reason?.trim() || version.reason || "Arquivado",
		},
	});
	return serializeVersion(archived);
}
