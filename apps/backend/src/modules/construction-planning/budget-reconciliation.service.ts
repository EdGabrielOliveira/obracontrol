import { ConstructionError } from "../../lib/errors";
import { getBudgetView } from "./budget.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import type { BudgetMutationResult } from "./budget-control/budget-control.types";
import {
	findLedgerEventsWithoutImpact,
	findReconciliationBySource,
	listReconciliations,
	type UnboundLedgerRow,
	upsertReconciliation,
} from "./budget-reconciliation.repository";

export type PendingReconciliationRow = {
	sourceType: string;
	sourceId: string;
	componentId: string;
	eventType: string;
	amount: number;
	competence: string;
	occurredAt: Date;
	status: "PENDING" | "CONFIRMED" | "REJECTED";
	budgetItemId: string | null;
	reason: string | null;
};

export type ReconciliationSuggestion = {
	budgetItemId: string;
	index: string;
	description: string;
	confidence: number;
	reasons: string[];
};

export type ConfirmReconciliationInput = {
	workId: string;
	sourceType: string;
	sourceId: string;
	budgetItemId: string;
	reason: string;
	createdBy: string;
};

export type RejectReconciliationInput = {
	workId: string;
	sourceType: string;
	sourceId: string;
	reason: string;
	createdBy: string;
};

const EVENT_TO_IMPACT: Record<
	string,
	{ impactType: "COMMITMENT" | "CONSUMPTION"; signed: 1 | -1 }
> = {
	COMMITMENT_INCREASE: { impactType: "COMMITMENT", signed: 1 },
	COMMITMENT_REDUCTION: { impactType: "COMMITMENT", signed: -1 },
	INCURRED_CREATE: { impactType: "CONSUMPTION", signed: 1 },
};

function normalizeToken(value: string): string[] {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.trim()
		.split(/\s+/)
		.filter((token) => token.length > 1);
}

export async function buildSuggestions(
	ownerId: string,
	workId: string,
	row: UnboundLedgerRow,
): Promise<ReconciliationSuggestion[]> {
	const view = await getBudgetView(ownerId, workId);
	if (!view) return [];
	const searchTokens = new Set(normalizeToken(row.sourceId));
	const suggestions: ReconciliationSuggestion[] = [];

	for (const item of view.items) {
		const itemTokens = normalizeToken([item.index, item.description].join(" "));
		const shared = [...searchTokens].filter((token) =>
			itemTokens.includes(token),
		).length;
		if (shared === 0) continue;
		const confidence = Math.min(0.95, 0.3 + shared * 0.15);
		const reasons = [
			`coincidencia de "${[...searchTokens].slice(0, 3).join(" ")}" com o item ${item.index}`,
		];
		suggestions.push({
			budgetItemId: item.id,
			index: item.index,
			description: item.description,
			confidence,
			reasons,
		});
	}

	return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

export const budgetReconciliationService = {
	async listPending(
		ownerId: string,
		workId: string,
	): Promise<PendingReconciliationRow[]> {
		const [events, existing] = await Promise.all([
			findLedgerEventsWithoutImpact(ownerId, workId),
			listReconciliations(ownerId, workId),
		]);
		const bySource = new Map(
			existing.map((row) => [`${row.sourceType}::${row.sourceId}`, row]),
		);
		return events.map((event) => {
			const record = bySource.get(`${event.sourceType}::${event.sourceId}`);
			return {
				sourceType: event.sourceType,
				sourceId: event.sourceId,
				componentId: event.componentId,
				eventType: event.eventType,
				amount: Number(event.amount),
				competence: event.competence,
				occurredAt: event.occurredAt,
				status:
					(record?.status as PendingReconciliationRow["status"] | undefined) ??
					"PENDING",
				budgetItemId: record?.budgetItemId ?? null,
				reason: record?.reason ?? null,
			};
		});
	},

	async suggestMatches(
		ownerId: string,
		workId: string,
		sourceType: string,
		sourceId: string,
	): Promise<ReconciliationSuggestion[]> {
		const events = await findLedgerEventsWithoutImpact(ownerId, workId);
		const row = events.find(
			(event) => event.sourceType === sourceType && event.sourceId === sourceId,
		);
		if (!row) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Registro sem vinculo orcamentario nao encontrado",
				404,
			);
		}
		return buildSuggestions(ownerId, workId, row);
	},

	async confirm(
		ownerId: string,
		input: ConfirmReconciliationInput,
	): Promise<{ status: string; result: BudgetMutationResult }> {
		if (!input.reason.trim()) {
			throw new ConstructionError(
				"RECONCILIATION_REASON_REQUIRED",
				"Informe o motivo da confirmacao",
				422,
			);
		}
		const existing = await findReconciliationBySource(
			input.sourceType,
			input.sourceId,
		);
		if (existing?.status === "CONFIRMED") {
			return {
				status: "CONFIRMED",
				result: {
					status: "APPROVED",
					requiresApproval: false,
					availableBalance: 0,
					projectedBalance: 0,
					allocations: [],
				},
			};
		}

		const events = await findLedgerEventsWithoutImpact(ownerId, input.workId);
		const row = events.find(
			(event) =>
				event.sourceType === input.sourceType &&
				event.sourceId === input.sourceId,
		);
		if (!row) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Registro sem vinculo orcamentario nao encontrado",
				404,
			);
		}
		const mapping = EVENT_TO_IMPACT[row.eventType];
		if (!mapping) {
			throw new ConstructionError(
				"RECONCILIATION_UNSUPPORTED_EVENT",
				"Evento nao suportado para reconciliacao orcamentaria",
				422,
			);
		}

		const signedAmount = Number(row.amount) * mapping.signed;
		const result = await budgetControlService.apply(
			ownerId,
			input.workId,
			{
				workId: input.workId,
				allocations: [
					{
						budgetItemId: input.budgetItemId,
						value: signedAmount,
					},
				],
				amount: signedAmount,
				impactType: mapping.impactType,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				componentId: row.componentId,
				competence: row.competence,
				occurredAt: row.occurredAt,
			},
			{ userId: input.createdBy },
		);

		await upsertReconciliation({
			ownerId,
			workId: input.workId,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			status: "CONFIRMED",
			budgetItemId: input.budgetItemId,
			reason: input.reason,
			createdBy: input.createdBy,
		});

		return { status: "CONFIRMED", result };
	},

	async reject(ownerId: string, input: RejectReconciliationInput) {
		if (!input.reason.trim()) {
			throw new ConstructionError(
				"RECONCILIATION_REASON_REQUIRED",
				"Informe o motivo da rejeicao",
				422,
			);
		}
		return upsertReconciliation({
			ownerId,
			workId: input.workId,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			status: "REJECTED",
			reason: input.reason,
			createdBy: input.createdBy,
		});
	},
};
