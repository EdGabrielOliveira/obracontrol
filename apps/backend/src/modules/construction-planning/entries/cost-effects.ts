import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import { resolveResourceScope } from "../../../lib/resource-scope";
import type { normalizeCostAllocations } from "../budget-control/budget-control.calculator";
import {
	findActiveImpactsBySource,
	findActiveImpactsBySourcePrefix,
} from "../budget-control/budget-control.repository";
import type { BudgetControlService } from "../budget-control/budget-control.service";
import {
	buildGeneralCostEvents,
	competenceOf,
	GENERAL_COST_SOURCE_TYPE,
	resolveLedgerItemRef,
	reverseLedgerEvents,
} from "../ledger/ledger.integration";
import { findLedgerEventsBySource } from "../ledger/ledger.repository";
import { appendLedgerEvent } from "../ledger/ledger.service";

type CostBudgetControl = Pick<
	BudgetControlService,
	"apply" | "reverse" | "reject"
>;

type CostInput = {
	amount: number | Prisma.Decimal;
	costDate: Date | string | null;
};

type PersistedCost = {
	costDate: Date | null;
	amount: Prisma.Decimal;
	paymentStatus: string;
};

type NormalizedCostAllocation = ReturnType<
	typeof normalizeCostAllocations
>[number];

export async function applyGeneralCostImpact(
	budgetControl: CostBudgetControl,
	ownerId: string,
	workId: string,
	effectSourceId: string,
	input: CostInput,
	normalized: ReturnType<typeof normalizeCostAllocations>,
	tx: Prisma.TransactionClient,
) {
	const occurredAt = input.costDate ? new Date(input.costDate) : new Date();
	await budgetControl.apply(
		ownerId,
		workId,
		{
			workId,
			allocations: normalized.map((row) => ({
				budgetItemId: row.budgetItemId,
				amount: Number(row.value),
			})),
			impactType: "CONSUMPTION",
			sourceType: GENERAL_COST_SOURCE_TYPE,
			sourceId: effectSourceId,
			competence: competenceOf(occurredAt),
			occurredAt,
		},
		{ userId: ownerId },
		tx,
	);
}

export async function assertSourceDocumentUnique(
	ownerId: string,
	workId: string,
	sourceDocument: string,
	tx: Prisma.TransactionClient,
	excludeCostId?: string,
) {
	const [duplicateCost, duplicatePayment] = await Promise.all([
		tx.constructionActualCost.findFirst({
			where: {
				ownerId,
				workId,
				sourceDocument,
				...(excludeCostId ? { id: { not: excludeCostId } } : {}),
			},
			select: { id: true },
		}),
		tx.contractPayment.findFirst({
			where: {
				description: sourceDocument,
				contract: { ownerId, workId },
			},
			select: { id: true },
		}),
	]);
	if (duplicateCost || duplicatePayment) {
		throw new ConstructionError(
			"DUPLICATE_CONTRACT_ORIGIN",
			"Ja existe custo manual ou pagamento de contrato com este documento de origem",
			422,
		);
	}
}

export async function emitGeneralCostEvents(
	ownerId: string,
	workId: string,
	created: PersistedCost,
	tx: Prisma.TransactionClient,
	effectSourceId: string,
	allocations: NormalizedCostAllocation[] | undefined,
) {
	if (!allocations || allocations.length === 0) return;
	const occurredAt = created.costDate ?? new Date();
	let scope: Awaited<ReturnType<typeof resolveResourceScope>> | undefined;
	for (const allocation of allocations) {
		const ref = await resolveLedgerItemRef(
			ownerId,
			workId,
			allocation.budgetItemId,
			tx,
		);
		if (!ref) continue;
		scope ??= await resolveResourceScope(ownerId, { workId });
		const base = {
			scope,
			workId,
			budgetItemIdentityId: ref.identityId,
			budgetVersionItemId: ref.versionItemId,
			sourceType: GENERAL_COST_SOURCE_TYPE,
			sourceId: effectSourceId,
			competence: competenceOf(occurredAt),
			occurredAt,
			approvalDecisionId: null,
		};
		for (const event of buildGeneralCostEvents(
			base,
			new Decimal(allocation.value),
			created.paymentStatus === "PAID",
		)) {
			if (event.eventType === "INCURRED_CREATE") continue;
			await appendLedgerEvent(event, tx);
		}
	}
}

export async function revokeGeneralCostImpacts(
	budgetControl: CostBudgetControl,
	ownerId: string,
	workId: string,
	costId: string,
	tx: Prisma.TransactionClient,
) {
	const [currentImpacts, revisionImpacts] = await Promise.all([
		findActiveImpactsBySource(
			tx,
			ownerId,
			workId,
			GENERAL_COST_SOURCE_TYPE,
			costId,
		),
		findActiveImpactsBySourcePrefix(
			tx,
			ownerId,
			workId,
			GENERAL_COST_SOURCE_TYPE,
			`${costId}#`,
		),
	]);
	const impacts = [...currentImpacts, ...revisionImpacts].filter(
		(impact) => impact.impactType === "CONSUMPTION",
	);
	const effectSourceIds = new Set(impacts.map((impact) => impact.sourceId));
	for (const impact of impacts) {
		if (impact.status === "APPROVED") {
			await budgetControl.reverse(ownerId, impact.id, { userId: ownerId }, tx);
		} else {
			await budgetControl.reject(ownerId, impact.id, { userId: ownerId }, tx);
		}
	}

	if (effectSourceIds.size === 0) return;
	const scope = await resolveResourceScope(ownerId, { workId });
	for (const sourceId of effectSourceIds) {
		const events = await findLedgerEventsBySource(tx, {
			sourceType: GENERAL_COST_SOURCE_TYPE,
			sourceId,
		});
		for (const reversal of reverseLedgerEvents(
			events.filter(
				(event) =>
					event.eventType === "DUE_CREATE" ||
					event.eventType === "PAYMENT_CREATE",
			),
		)) {
			await appendLedgerEvent(
				{
					scope,
					workId,
					budgetItemIdentityId: reversal.budgetItemIdentityId,
					budgetVersionItemId: reversal.budgetVersionItemId,
					eventType: reversal.eventType as never,
					sourceType: GENERAL_COST_SOURCE_TYPE,
					sourceId: reversal.sourceId ?? sourceId,
					componentId: reversal.componentId,
					amount: reversal.amount,
					competence: competenceOf(new Date()),
					occurredAt: new Date(),
					approvalDecisionId: null,
				},
				tx,
			);
		}
	}
}
