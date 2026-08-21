import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export type LedgerEventKey = {
	eventType: string;
	sourceType: string;
	sourceId: string;
	componentId: string;
};

export type LedgerEventData = {
	ownerId: string;
	workId: string;
	budgetItemIdentityId: string;
	budgetVersionItemId: string;
	eventType: string;
	sourceType: string;
	sourceId: string;
	componentId: string;
	amount: Prisma.Decimal;
	competence: string;
	occurredAt: Date;
	approvalDecisionId: string | null;
	budgetImpactId: string | null;
};

export function findLedgerEventByKey(db: Db, key: LedgerEventKey) {
	return db.constructionLedgerEvent.findUnique({
		where: { eventType_sourceType_sourceId_componentId: key },
	});
}

export function createLedgerEvent(db: Db, data: LedgerEventData) {
	return db.constructionLedgerEvent.create({ data });
}

export function findBudgetItemIdentity(
	db: Db,
	ownerId: string,
	workId: string,
	identityId: string,
) {
	return db.budgetItemIdentity.findFirst({
		where: { id: identityId, ownerId, workId },
		select: { id: true },
	});
}

export function findBudgetVersionItem(
	db: Db,
	identityId: string,
	versionItemId: string,
) {
	return db.budgetVersionItem.findFirst({
		where: { id: versionItemId, identityId },
		select: { id: true },
	});
}

export function findApprovedDecision(db: Db, approvalDecisionId: string) {
	return db.approvalDecision.findFirst({
		where: { id: approvalDecisionId, decision: "APPROVE" },
		select: { id: true },
	});
}

export type LedgerSourceEvent = {
	eventType: string;
	componentId: string;
	amount: Prisma.Decimal;
	sourceId?: string;
	budgetItemIdentityId: string;
	budgetVersionItemId: string;
};

export function findLedgerEventsBySource(
	db: Db,
	source: { sourceType: string; sourceId: string },
): Promise<LedgerSourceEvent[]> {
	return db.constructionLedgerEvent.findMany({
		where: { sourceType: source.sourceType, sourceId: source.sourceId },
		select: {
			eventType: true,
			componentId: true,
			amount: true,
			sourceId: true,
			budgetItemIdentityId: true,
			budgetVersionItemId: true,
		},
		orderBy: { createdAt: "asc" },
	});
}

export async function countLedgerEventsBySource(
	db: Db,
	source: { sourceType: string; sourceId: string },
): Promise<number> {
	return db.constructionLedgerEvent.count({
		where: { sourceType: source.sourceType, sourceId: source.sourceId },
	});
}

export function findLedgerEventsBySourcePrefix(
	db: Db,
	source: { sourceType: string; sourceIdPrefix: string },
): Promise<LedgerSourceEvent[]> {
	return db.constructionLedgerEvent.findMany({
		where: {
			sourceType: source.sourceType,
			sourceId: { startsWith: source.sourceIdPrefix },
		},
		select: {
			eventType: true,
			componentId: true,
			amount: true,
			sourceId: true,
			budgetItemIdentityId: true,
			budgetVersionItemId: true,
		},
		orderBy: { createdAt: "asc" },
	});
}

export type LedgerSumRow = {
	eventType: string;
	componentId?: string | null;
	_sum: { amount: Prisma.Decimal | null } | null;
};

export async function sumLedgerEvents(
	where: Prisma.ConstructionLedgerEventWhereInput,
	by: ["eventType"] | ["eventType", "componentId"],
): Promise<LedgerSumRow[]> {
	const result = await prisma.constructionLedgerEvent.groupBy({
		by,
		where,
		_sum: { amount: true },
	});
	return result as LedgerSumRow[];
}
