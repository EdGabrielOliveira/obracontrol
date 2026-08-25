import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { withSerializableRetry } from "../../../lib/transaction-retry";
import { OPERATIONAL_CONTRACT_STATUSES } from "../contract-status";
import {
	AMENDMENT_SOURCE_TYPE,
	MEASUREMENT_SOURCE_TYPE,
	PAYMENT_SOURCE_TYPE,
	SERVICE_SOURCE_TYPE,
} from "./ledger.integration";
import {
	createLedgerEvent,
	findApprovedDecision,
	findBudgetItemIdentity,
	findBudgetVersionItem,
	findLedgerEventByKey,
	type LedgerSumRow,
	sumLedgerEvents,
} from "./ledger.repository";
import type { LedgerEventInput, LedgerSummary } from "./ledger.types";

function toNumber(row: LedgerSumRow): number {
	return Number(row._sum?.amount ?? 0);
}

function sumByType(rows: LedgerSumRow[]): Record<string, number> {
	const sums: Record<string, number> = {};
	for (const row of rows) {
		sums[row.eventType] = (sums[row.eventType] ?? 0) + toNumber(row);
	}
	return sums;
}

function formatAmount(value: number): string {
	return new Decimal(value).toFixed(2);
}

export async function appendLedgerEvent(
	input: LedgerEventInput,
	tx?: Prisma.TransactionClient,
) {
	if (!input.amount.isPositive()) {
		throw new ConstructionError(
			"LEDGER_AMOUNT_NOT_POSITIVE",
			"Valor do evento de ledger deve ser positivo",
			422,
		);
	}

	const run = async (activeTx: Prisma.TransactionClient) => {
		const identity = await findBudgetItemIdentity(
			activeTx,
			input.scope.resourceOwnerId,
			input.workId,
			input.budgetItemIdentityId,
		);
		if (!identity) {
			throw new ConstructionError(
				"LEDGER_BUDGET_ITEM_OTHER_WORK",
				"Item orcamentario nao pertence a obra informada",
				422,
			);
		}

		const versionItem = await findBudgetVersionItem(
			activeTx,
			input.budgetItemIdentityId,
			input.budgetVersionItemId,
		);
		if (!versionItem) {
			throw new ConstructionError(
				"LEDGER_BUDGET_ITEM_OTHER_WORK",
				"Item de versao nao pertence ao item orcamentario informado",
				422,
			);
		}

		if (input.approvalDecisionId) {
			const decision = await findApprovedDecision(
				activeTx,
				input.approvalDecisionId,
			);
			if (!decision) {
				throw new ConstructionError(
					"LEDGER_APPROVAL_NOT_APPROVED",
					"Decisao de aprovacao inexistente ou nao aprovada",
					422,
				);
			}
		}

		const existing = await findLedgerEventByKey(activeTx, {
			eventType: input.eventType,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			componentId: input.componentId,
		});
		if (existing) {
			throw new ConstructionError(
				"LEDGER_EVENT_DUPLICATE",
				"Evento de ledger ja registrado para a mesma chave idempotente",
				409,
			);
		}

		return createLedgerEvent(activeTx, {
			ownerId: input.scope.resourceOwnerId,
			workId: input.workId,
			budgetItemIdentityId: input.budgetItemIdentityId,
			budgetVersionItemId: input.budgetVersionItemId,
			eventType: input.eventType,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			componentId: input.componentId,
			amount: input.amount,
			competence: input.competence,
			occurredAt: input.occurredAt,
			approvalDecisionId: input.approvalDecisionId ?? null,
			budgetImpactId: input.budgetImpactId ?? null,
		});
	};

	if (tx) return run(tx);
	return withSerializableRetry(run);
}

export async function appendLedgerEvents(
	inputs: LedgerEventInput[],
	tx: Prisma.TransactionClient,
) {
	if (inputs.length === 0) return [];

	for (const input of inputs) {
		if (!input.amount.isPositive()) {
			throw new ConstructionError(
				"LEDGER_AMOUNT_NOT_POSITIVE",
				"Valor do evento de ledger deve ser positivo",
				422,
			);
		}
	}

	const identityIds = [...new Set(inputs.map((i) => i.budgetItemIdentityId))];
	const versionItemIds = [...new Set(inputs.map((i) => i.budgetVersionItemId))];
	const approvalDecisionIds = [
		...new Set(
			inputs
				.map((i) => i.approvalDecisionId)
				.filter((id): id is string => Boolean(id)),
		),
	];
	const eventKeys = inputs.map((i) => ({
		eventType: i.eventType,
		sourceType: i.sourceType,
		sourceId: i.sourceId,
		componentId: i.componentId,
	}));

	const [identities, versionItems, approvedDecisions, existingEvents] =
		await Promise.all([
			tx.budgetItemIdentity.findMany({
				where: { id: { in: identityIds } },
				select: { id: true, ownerId: true, workId: true },
			}),
			tx.budgetVersionItem.findMany({
				where: { id: { in: versionItemIds } },
				select: { id: true, identityId: true },
			}),
			approvalDecisionIds.length > 0
				? tx.approvalDecision.findMany({
						where: {
							id: { in: approvalDecisionIds },
							decision: "APPROVE",
						},
						select: { id: true },
					})
				: Promise.resolve([]),
			tx.constructionLedgerEvent.findMany({
				where: {
					OR: eventKeys,
				},
				select: {
					eventType: true,
					sourceType: true,
					sourceId: true,
					componentId: true,
				},
			}),
		]);

	const identityMap = new Map(identities.map((i) => [i.id, i]));
	const versionItemMap = new Map(versionItems.map((v) => [v.id, v]));
	const approvedDecisionSet = new Set(approvedDecisions.map((d) => d.id));
	const existingKeySet = new Set(
		existingEvents.map(
			(e) => `${e.eventType}|${e.sourceType}|${e.sourceId}|${e.componentId}`,
		),
	);

	const data = inputs.map((input) => {
		const identity = identityMap.get(input.budgetItemIdentityId);
		if (
			!identity ||
			identity.ownerId !== input.scope.resourceOwnerId ||
			identity.workId !== input.workId
		) {
			throw new ConstructionError(
				"LEDGER_BUDGET_ITEM_OTHER_WORK",
				"Item orcamentario nao pertence a obra informada",
				422,
			);
		}

		const versionItem = versionItemMap.get(input.budgetVersionItemId);
		if (!versionItem || versionItem.identityId !== input.budgetItemIdentityId) {
			throw new ConstructionError(
				"LEDGER_BUDGET_ITEM_OTHER_WORK",
				"Item de versao nao pertence ao item orcamentario informado",
				422,
			);
		}

		if (input.approvalDecisionId) {
			if (!approvedDecisionSet.has(input.approvalDecisionId)) {
				throw new ConstructionError(
					"LEDGER_APPROVAL_NOT_APPROVED",
					"Decisao de aprovacao inexistente ou nao aprovada",
					422,
				);
			}
		}

		const key = `${input.eventType}|${input.sourceType}|${input.sourceId}|${input.componentId}`;
		if (existingKeySet.has(key)) {
			throw new ConstructionError(
				"LEDGER_EVENT_DUPLICATE",
				"Evento de ledger ja registrado para a mesma chave idempotente",
				409,
			);
		}
		existingKeySet.add(key);

		return {
			ownerId: input.scope.resourceOwnerId,
			workId: input.workId,
			budgetItemIdentityId: input.budgetItemIdentityId,
			budgetVersionItemId: input.budgetVersionItemId,
			eventType: input.eventType,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			componentId: input.componentId,
			amount: input.amount,
			competence: input.competence,
			occurredAt: input.occurredAt,
			approvalDecisionId: input.approvalDecisionId ?? null,
			budgetImpactId: input.budgetImpactId ?? null,
		};
	});

	return tx.constructionLedgerEvent.createManyAndReturn({ data });
}

const AMENDMENT_COMPONENT = "AMENDMENT";
const CONTRACT_SOURCE_TYPES = [
	SERVICE_SOURCE_TYPE,
	MEASUREMENT_SOURCE_TYPE,
	PAYMENT_SOURCE_TYPE,
	AMENDMENT_SOURCE_TYPE,
];

async function operationalContractEventFilters(
	ownerId: string,
	workId: string,
) {
	const contracts = await prisma.contract.findMany({
		where: {
			ownerId,
			workId,
			status: { in: [...OPERATIONAL_CONTRACT_STATUSES] },
		},
		select: {
			services: { select: { id: true } },
			measurements: { select: { id: true } },
			payments: { select: { id: true } },
			amendments: { select: { id: true } },
		},
	});
	const serviceIds = contracts.flatMap((contract) =>
		contract.services.map((service) => service.id),
	);
	const measurementIds = contracts.flatMap((contract) =>
		contract.measurements.map((measurement) => measurement.id),
	);
	const paymentIds = contracts.flatMap((contract) =>
		contract.payments.map((payment) => payment.id),
	);
	const amendmentIds = contracts.flatMap((contract) =>
		contract.amendments.map((amendment) => amendment.id),
	);

	const contractFilters: Prisma.ConstructionLedgerEventWhereInput[] = [
		...serviceIds.map((id) => ({
			sourceType: SERVICE_SOURCE_TYPE,
			sourceId: { startsWith: `${id}#` },
		})),
		...(measurementIds.length
			? [
					{
						sourceType: MEASUREMENT_SOURCE_TYPE,
						sourceId: { in: measurementIds },
					},
				]
			: []),
		...(paymentIds.length
			? [{ sourceType: PAYMENT_SOURCE_TYPE, sourceId: { in: paymentIds } }]
			: []),
		...amendmentIds.map((id) => ({
			sourceType: AMENDMENT_SOURCE_TYPE,
			sourceId: { startsWith: `${id}#` },
		})),
	];

	return {
		contract: contractFilters.length
			? { OR: contractFilters }
			: { id: { in: [] } },
		global: {
			OR: [
				{ sourceType: { notIn: CONTRACT_SOURCE_TYPES } },
				...contractFilters,
			],
		},
	};
}

export async function summarizeLedger(
	ownerId: string,
	workId: string,
	asOf: Date,
): Promise<LedgerSummary> {
	const cut: Record<string, unknown> = {
		ownerId,
		workId,
		occurredAt: { lte: asOf },
	};
	const visibility = await operationalContractEventFilters(ownerId, workId);
	const contractCut: Prisma.ConstructionLedgerEventWhereInput = {
		AND: [cut, visibility.contract],
	};
	const globalCut: Prisma.ConstructionLedgerEventWhereInput = {
		AND: [cut, visibility.global],
	};

	const [globalRows, contractRows] = await Promise.all([
		sumLedgerEvents(globalCut, ["eventType"]),
		sumLedgerEvents(contractCut, ["eventType", "componentId"]),
	]);

	const global = sumByType(globalRows);
	const contract = sumByType(contractRows);

	const amendmentRows = contractRows.filter(
		(row) => row.componentId === AMENDMENT_COMPONENT,
	);
	const amendment = sumByType(amendmentRows);

	const contractIncurred =
		(contract.INCURRED_CREATE ?? 0) - (contract.INCURRED_REVERSAL ?? 0);

	return {
		committed: formatAmount(
			(global.COMMITMENT_INCREASE ?? 0) - (global.COMMITMENT_REDUCTION ?? 0),
		),
		incurred: formatAmount(
			(global.INCURRED_CREATE ?? 0) - (global.INCURRED_REVERSAL ?? 0),
		),
		dueOpen: formatAmount(
			(global.DUE_CREATE ?? 0) -
				(global.DUE_CANCEL ?? 0) -
				(global.PAYMENT_CREATE ?? 0) +
				(global.PAYMENT_REVERSAL ?? 0),
		),
		paid: formatAmount(
			(global.PAYMENT_CREATE ?? 0) - (global.PAYMENT_REVERSAL ?? 0),
		),
		generalIncurredUncommitted: formatAmount(
			(global.INCURRED_CREATE ?? 0) -
				(global.INCURRED_REVERSAL ?? 0) -
				contractIncurred,
		),
		contracts: {
			contractedValue: formatAmount(
				(contract.COMMITMENT_INCREASE ?? 0) -
					(contract.COMMITMENT_REDUCTION ?? 0),
			),
			amendmentNet: formatAmount(
				(amendment.COMMITMENT_INCREASE ?? 0) -
					(amendment.COMMITMENT_REDUCTION ?? 0),
			),
			measuredGross: formatAmount(contractIncurred),
			dueOpen: formatAmount(
				(contract.DUE_CREATE ?? 0) -
					(contract.DUE_CANCEL ?? 0) -
					(contract.PAYMENT_CREATE ?? 0) +
					(contract.PAYMENT_REVERSAL ?? 0),
			),
			paid: formatAmount(
				(contract.PAYMENT_CREATE ?? 0) - (contract.PAYMENT_REVERSAL ?? 0),
			),
		},
	};
}
