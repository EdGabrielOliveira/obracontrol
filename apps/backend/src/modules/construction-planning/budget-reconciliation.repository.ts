import type { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma";

export type UnboundLedgerRow = {
	sourceType: string;
	sourceId: string;
	componentId: string;
	eventType: string;
	amount: Decimal;
	competence: string;
	occurredAt: Date;
	budgetItemIdentityId: string | null;
	budgetVersionItemId: string | null;
};

export async function findLedgerEventsWithoutImpact(
	ownerId: string,
	workId: string,
): Promise<UnboundLedgerRow[]> {
	return prisma.constructionLedgerEvent.findMany({
		where: { ownerId, workId, budgetImpactId: null },
		select: {
			sourceType: true,
			sourceId: true,
			componentId: true,
			eventType: true,
			amount: true,
			competence: true,
			occurredAt: true,
			budgetItemIdentityId: true,
			budgetVersionItemId: true,
		},
		orderBy: { occurredAt: "asc" },
	});
}

export type ReconciliationRow = {
	id: string;
	sourceType: string;
	sourceId: string;
	status: string;
	budgetItemId: string | null;
	reason: string | null;
};

export async function listReconciliations(
	ownerId: string,
	workId: string,
	status?: string,
): Promise<ReconciliationRow[]> {
	return prisma.constructionBudgetReconciliation.findMany({
		where: { ownerId, workId, ...(status ? { status } : {}) },
		orderBy: { createdAt: "desc" },
	});
}

export async function findReconciliationBySource(
	sourceType: string,
	sourceId: string,
): Promise<ReconciliationRow | null> {
	return prisma.constructionBudgetReconciliation.findUnique({
		where: { sourceType_sourceId: { sourceType, sourceId } },
	});
}

export async function upsertReconciliation(input: {
	ownerId: string;
	workId: string;
	sourceType: string;
	sourceId: string;
	status: string;
	budgetItemId?: string | null;
	reason?: string | null;
	createdBy: string;
}): Promise<ReconciliationRow> {
	return prisma.constructionBudgetReconciliation.upsert({
		where: {
			sourceType_sourceId: {
				sourceType: input.sourceType,
				sourceId: input.sourceId,
			},
		},
		create: {
			ownerId: input.ownerId,
			workId: input.workId,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			status: input.status,
			budgetItemId: input.budgetItemId ?? null,
			reason: input.reason ?? null,
			createdBy: input.createdBy,
		},
		update: {
			status: input.status,
			budgetItemId: input.budgetItemId ?? null,
			reason: input.reason ?? null,
		},
	});
}
