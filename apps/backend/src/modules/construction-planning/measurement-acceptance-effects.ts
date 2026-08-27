import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../lib/errors";
import type { ScopeContext } from "../../lib/resource-scope";
import { findActiveImpactsBySource } from "./budget-control/budget-control.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import {
	assertDuePartsDoNotExceedIncurred,
	buildMeasurementEvents,
	COMPONENT_SUPPLIER,
	competenceOf,
	MEASUREMENT_SOURCE_TYPE,
	resolveLedgerItemRef,
	reverseLedgerEvents,
	splitMeasurementValue,
} from "./ledger/ledger.integration";
import { findLedgerEventsBySource } from "./ledger/ledger.repository";
import { appendLedgerEvent, appendLedgerEvents } from "./ledger/ledger.service";

type WorkMeasurementForAcceptance = {
	date: Date;
	items: Array<{ budgetItemId: string; measuredQuantity: unknown }>;
};

export async function applyWorkMeasurementAcceptance(input: {
	tx: Prisma.TransactionClient;
	ownerId: string;
	workId: string;
	measurementId: string;
	actorId: string;
	measurement: WorkMeasurementForAcceptance;
}) {
	const activeImpacts = await findActiveImpactsBySource(
		input.tx,
		input.ownerId,
		input.workId,
		"WORK_MEASUREMENT",
		input.measurementId,
	);
	if (activeImpacts.length > 0) return;

	await budgetControlService.apply(
		input.ownerId,
		input.workId,
		{
			workId: input.workId,
			allocations: input.measurement.items.map((item) => ({
				budgetItemId: item.budgetItemId,
				quantity: Number(item.measuredQuantity ?? 0),
			})),
			impactType: "CONSUMPTION",
			sourceType: "WORK_MEASUREMENT",
			sourceId: input.measurementId,
			allowPending: false,
			occurredAt: input.measurement.date,
		},
		{ userId: input.actorId },
		input.tx,
	);
}

export async function reverseWorkMeasurementAcceptance(input: {
	tx: Prisma.TransactionClient;
	ownerId: string;
	workId: string;
	measurementId: string;
	actorId: string;
}) {
	const activeImpacts = await findActiveImpactsBySource(
		input.tx,
		input.ownerId,
		input.workId,
		"WORK_MEASUREMENT",
		input.measurementId,
	);
	for (const impact of activeImpacts.filter(
		(candidate) => candidate.impactType === "CONSUMPTION",
	)) {
		if (impact.status === "APPROVED") {
			await budgetControlService.reverse(
				input.ownerId,
				impact.id,
				{ userId: input.actorId },
				input.tx,
			);
		} else if (impact.status === "PENDING") {
			await budgetControlService.reject(
				input.ownerId,
				impact.id,
				{ userId: input.actorId },
				input.tx,
			);
		}
	}
}

type ContractMeasurementForAcceptance = {
	date: Date;
	discountValue: unknown;
	retentionValue: unknown;
	taxValue: unknown;
	items: Array<{
		serviceId: string;
		measuredValue: unknown;
		accumulatedValue: unknown;
	}>;
};

export async function applyContractMeasurementAcceptance(input: {
	tx: Prisma.TransactionClient;
	ownerId: string;
	workId: string;
	contractId: string;
	measurementId: string;
	actorId: string;
	measurement: ContractMeasurementForAcceptance;
	scope: ScopeContext;
	approvalDecisionId?: string | null;
}) {
	const activeImpacts = await findActiveImpactsBySource(
		input.tx,
		input.ownerId,
		input.workId,
		MEASUREMENT_SOURCE_TYPE,
		input.measurementId,
	);
	if (activeImpacts.length > 0) return;

	const services = await input.tx.contractService.findMany({
		where: {
			contractId: input.contractId,
			contract: { ownerId: input.ownerId },
		},
		select: { id: true, budgetItemId: true },
	});
	const budgetItemByService = new Map(
		services.map((service) => [service.id, service.budgetItemId]),
	);
	const primaryBudgetItemId = budgetItemByService.get(
		input.measurement.items[0]?.serviceId ?? "",
	);
	if (!primaryBudgetItemId) {
		throw new ConstructionError(
			"CONTRACT_BUDGET_COVERAGE_MISSING",
			"Sem cobertura orcamentaria vigente para a medicao do contrato",
			422,
		);
	}
	const primary = await resolveLedgerItemRef(
		input.ownerId,
		input.workId,
		primaryBudgetItemId,
		input.tx,
	);
	if (!primary) {
		throw new ConstructionError(
			"CONTRACT_BUDGET_COVERAGE_MISSING",
			"Sem cobertura orcamentaria vigente para a medicao do contrato",
			422,
		);
	}

	const parts = splitMeasurementValue(
		input.measurement.items.map((item) => ({
			serviceId: item.serviceId,
			measuredValue: Number(item.measuredValue ?? 0),
			accumulatedValue:
				item.accumulatedValue == null ? null : Number(item.accumulatedValue),
		})),
		{
			discountValue:
				input.measurement.discountValue == null
					? null
					: Number(input.measurement.discountValue),
			retentionValue:
				input.measurement.retentionValue == null
					? null
					: Number(input.measurement.retentionValue),
			taxValue:
				input.measurement.taxValue == null
					? null
					: Number(input.measurement.taxValue),
		},
	);
	assertDuePartsDoNotExceedIncurred(parts);

	const events = buildMeasurementEvents(
		{
			scope: input.scope,
			workId: input.workId,
			budgetItemIdentityId: primary.identityId,
			budgetVersionItemId: primary.versionItemId,
			sourceType: MEASUREMENT_SOURCE_TYPE,
			sourceId: input.measurementId,
			competence: competenceOf(input.measurement.date),
			occurredAt: input.measurement.date,
			approvalDecisionId: input.approvalDecisionId ?? null,
		},
		parts,
	);
	const incurredEvent = events.find(
		(event) => event.eventType === "INCURRED_CREATE",
	);
	if (incurredEvent) {
		await budgetControlService.apply(
			input.ownerId,
			input.workId,
			{
				workId: input.workId,
				allocations: [
					{
						budgetItemId: primaryBudgetItemId,
						value: Number(incurredEvent.amount),
					},
				],
				amount: Number(incurredEvent.amount),
				componentId: COMPONENT_SUPPLIER,
				impactType: "CONSUMPTION",
				sourceType: MEASUREMENT_SOURCE_TYPE,
				sourceId: input.measurementId,
				occurredAt: input.measurement.date,
			},
			{ userId: input.actorId },
			input.tx,
		);
	}
	const nonIncurredEvents = events.filter(
		(event) => event.eventType !== "INCURRED_CREATE",
	);
	if (nonIncurredEvents.length > 0) {
		await appendLedgerEvents(nonIncurredEvents, input.tx);
	}
}

export async function reverseContractMeasurementAcceptance(input: {
	tx: Prisma.TransactionClient;
	ownerId: string;
	workId: string;
	measurementId: string;
	actorId: string;
	scope: ScopeContext;
}) {
	const activeImpacts = await findActiveImpactsBySource(
		input.tx,
		input.ownerId,
		input.workId,
		MEASUREMENT_SOURCE_TYPE,
		input.measurementId,
	);
	for (const impact of activeImpacts.filter(
		(candidate) => candidate.impactType === "CONSUMPTION",
	)) {
		if (impact.status === "APPROVED") {
			await budgetControlService.reverse(
				input.ownerId,
				impact.id,
				{ userId: input.actorId },
				input.tx,
			);
		} else if (impact.status === "PENDING") {
			await budgetControlService.reject(
				input.ownerId,
				impact.id,
				{ userId: input.actorId },
				input.tx,
			);
		}
	}

	const events = await findLedgerEventsBySource(input.tx, {
		sourceType: MEASUREMENT_SOURCE_TYPE,
		sourceId: input.measurementId,
	});
	for (const reversal of reverseLedgerEvents(events)) {
		// INCURRED_CREATE is reversed by budgetControlService.reverse above.
		if (reversal.eventType !== "DUE_CANCEL") continue;
		await appendLedgerEvent(
			{
				scope: input.scope,
				workId: input.workId,
				budgetItemIdentityId: reversal.budgetItemIdentityId,
				budgetVersionItemId: reversal.budgetVersionItemId,
				eventType: reversal.eventType as never,
				sourceType: MEASUREMENT_SOURCE_TYPE,
				sourceId: input.measurementId,
				componentId: reversal.componentId,
				amount: reversal.amount,
				competence: competenceOf(new Date()),
				occurredAt: new Date(),
				approvalDecisionId: null,
			},
			input.tx,
		);
	}
}
