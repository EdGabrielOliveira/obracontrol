import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import { toFiniteNumber } from "../../../lib/number-utils";
import { getBudgetItemReferences } from "../budget-control/budget-control.repository";
import type { LedgerEventInput } from "./ledger.types";

export const MEASUREMENT_SOURCE_TYPE = "CONTRACT_MEASUREMENT";
export const SERVICE_SOURCE_TYPE = "CONTRACT_SERVICE";
export const AMENDMENT_SOURCE_TYPE = "CONTRACT_AMENDMENT";
export const PAYMENT_SOURCE_TYPE = "CONTRACT_PAYMENT";
export const GENERAL_COST_SOURCE_TYPE = "GENERAL_COST";

export const COMPONENT_SUPPLIER = "fornecedor";
export const COMPONENT_RETENTION = "retencao";
export const COMPONENT_TAX = "tributo";
export const COMPONENT_BASE = "BASE";
export const COMPONENT_AMENDMENT = "AMENDMENT";

export type MeasurementEventSource = {
	serviceId: string;
	measuredValue?: number | null;
	accumulatedValue?: number | null;
};

export type MeasurementLedgerParts = {
	grossValue: number;
	commercialDiscount: number;
	retention: number;
	tax: number;
	incurredNet: number;
	dueSupplier: number;
};

export function competenceOf(date: Date): string {
	return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(
		date.getUTCMonth() + 1,
	).padStart(2, "0")}`;
}

export function roundCurrency(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function splitMeasurementValue(
	items: MeasurementEventSource[],
	input: {
		discountValue?: number | null;
		retentionValue?: number | null;
		taxValue?: number | null;
	},
): MeasurementLedgerParts {
	const grossValue = roundCurrency(
		items.reduce(
			(sum, item) =>
				sum + toFiniteNumber(item.accumulatedValue ?? item.measuredValue),
			0,
		),
	);
	const commercialDiscount = roundCurrency(input.discountValue ?? 0);
	const retention = roundCurrency(input.retentionValue ?? 0);
	const tax = roundCurrency(input.taxValue ?? 0);
	const incurredNet = roundCurrency(grossValue - commercialDiscount);
	const dueSupplier = roundCurrency(incurredNet - retention - tax);
	return {
		grossValue,
		commercialDiscount,
		retention,
		tax,
		incurredNet,
		dueSupplier,
	};
}

export function assertDuePartsDoNotExceedIncurred(
	parts: MeasurementLedgerParts,
) {
	if (parts.dueSupplier < 0) {
		throw new ConstructionError(
			"MEASUREMENT_DUE_PARTS_EXCEED_INCURRED",
			"Retencao, tributo e desconto excedem o valor bruto medido",
			422,
		);
	}
}

export async function resolveLedgerItemRef(
	actorId: string,
	workId: string,
	budgetItemId: string,
): Promise<{
	identityId: string;
	versionItemId: string;
	operationalBudgetItemId: string | null;
} | null> {
	const { found } = await getBudgetItemReferences(actorId, workId, [
		budgetItemId,
	]);
	const reference = found[0];
	if (!reference) return null;
	return {
		identityId: reference.identityId,
		versionItemId: reference.versionItemId,
		operationalBudgetItemId: reference.operationalBudgetItemId ?? null,
	};
}

export type PendingLedgerEvent = {
	scope: LedgerEventInput["scope"];
	workId: string;
	budgetItemIdentityId: string;
	budgetVersionItemId: string;
	sourceType: string;
	sourceId: string;
	competence: string;
	occurredAt: Date;
	approvalDecisionId?: string | null;
	budgetImpactId?: string | null;
};

export function buildMeasurementEvents(
	base: PendingLedgerEvent,
	parts: Pick<
		MeasurementLedgerParts,
		"incurredNet" | "dueSupplier" | "retention" | "tax"
	>,
): LedgerEventInput[] {
	const events: LedgerEventInput[] = [];
	if (parts.incurredNet > 0) {
		events.push({
			...base,
			eventType: "INCURRED_CREATE",
			componentId: COMPONENT_SUPPLIER,
			amount: new Decimal(parts.incurredNet),
		});
	}
	if (parts.dueSupplier > 0) {
		events.push({
			...base,
			eventType: "DUE_CREATE",
			componentId: COMPONENT_SUPPLIER,
			amount: new Decimal(parts.dueSupplier),
		});
	}
	if (parts.retention > 0) {
		events.push({
			...base,
			eventType: "DUE_CREATE",
			componentId: COMPONENT_RETENTION,
			amount: new Decimal(parts.retention),
		});
	}
	if (parts.tax > 0) {
		events.push({
			...base,
			eventType: "DUE_CREATE",
			componentId: COMPONENT_TAX,
			amount: new Decimal(parts.tax),
		});
	}
	return events;
}

export type ReversibleLedgerEvent = {
	eventType: string;
	componentId: string;
	amount: Decimal;
	budgetItemIdentityId?: string;
	budgetVersionItemId?: string;
};

const REVERSE_MAP: Record<string, string> = {
	COMMITMENT_INCREASE: "COMMITMENT_REDUCTION",
	COMMITMENT_REDUCTION: "COMMITMENT_INCREASE",
	INCURRED_CREATE: "INCURRED_REVERSAL",
	INCURRED_REVERSAL: "INCURRED_CREATE",
	DUE_CREATE: "DUE_CANCEL",
	DUE_CANCEL: "DUE_CREATE",
	PAYMENT_CREATE: "PAYMENT_REVERSAL",
	PAYMENT_REVERSAL: "PAYMENT_CREATE",
};

export function reverseLedgerEvents<T extends ReversibleLedgerEvent>(
	events: T[],
): T[] {
	return events.map((event) => ({
		...event,
		eventType: REVERSE_MAP[event.eventType] ?? event.eventType,
	}));
}

// Cada versao de um compromisso vinculado a uma entidade mutavel (servico)
// recebe um sourceId versionado (#1, #2, ...) para manter a chave
// idempotente unica: criacoes subsequentes nao colidem com as anteriores e
// reversoes usam o sourceId da versao original (eventType oposto, sem
// colisao).
export function nextVersionedSourceId(
	entityId: string,
	committedEventCount: number,
): string {
	return `${entityId}#${committedEventCount + 1}`;
}

export function commitmentSourceOf(sourceId: string): string {
	return sourceId.split("#")[0];
}

export type CommitmentEventType =
	| "COMMITMENT_INCREASE"
	| "COMMITMENT_REDUCTION";

export function buildCommitmentEvent(
	base: PendingLedgerEvent,
	eventType: CommitmentEventType,
	componentId: string,
	amount: Decimal,
): LedgerEventInput {
	return { ...base, eventType, componentId, amount };
}

// Pagamento reduz atomicamente o devido aberto do componente do fornecedor:
// `PAYMENT_CREATE` com a mesma chave idempotente do componente liquidado.
export function buildPaymentCreateEvent(
	base: PendingLedgerEvent,
	amount: Decimal,
): LedgerEventInput {
	return {
		...base,
		eventType: "PAYMENT_CREATE",
		componentId: COMPONENT_SUPPLIER,
		amount,
	};
}

// Gasto geral vira incorrido + devido do fornecedor; quando quitado a vista
// (paymentStatus PAID), o pagamento e criado na mesma transacao.
export function buildGeneralCostEvents(
	base: PendingLedgerEvent,
	amount: Decimal,
	paidInCash: boolean,
): LedgerEventInput[] {
	const events: LedgerEventInput[] = [
		{
			...base,
			eventType: "INCURRED_CREATE",
			componentId: COMPONENT_SUPPLIER,
			amount,
		},
		{
			...base,
			eventType: "DUE_CREATE",
			componentId: COMPONENT_SUPPLIER,
			amount,
		},
	];
	if (paidInCash) {
		events.push(buildPaymentCreateEvent(base, amount));
	}
	return events;
}
