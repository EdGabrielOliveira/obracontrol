import type { Decimal } from "@prisma/client/runtime/library";
import type { ScopeContext } from "../../../lib/resource-scope";

export type LedgerEventType =
	| "COMMITMENT_INCREASE"
	| "COMMITMENT_REDUCTION"
	| "INCURRED_CREATE"
	| "INCURRED_REVERSAL"
	| "DUE_CREATE"
	| "DUE_CANCEL"
	| "PAYMENT_CREATE"
	| "PAYMENT_REVERSAL";

export type LedgerEventInput = {
	scope: ScopeContext;
	workId: string;
	budgetItemIdentityId: string;
	budgetVersionItemId: string;
	eventType: LedgerEventType;
	sourceType: string;
	sourceId: string;
	componentId: string;
	amount: Decimal;
	competence: string;
	occurredAt: Date;
	approvalDecisionId?: string | null;
	budgetImpactId?: string | null;
};

export type LedgerEvent = {
	id: string;
	ownerId: string;
	workId: string;
	budgetItemIdentityId: string;
	budgetVersionItemId: string;
	eventType: LedgerEventType;
	sourceType: string;
	sourceId: string;
	componentId: string;
	amount: string;
	competence: string;
	occurredAt: string;
	approvalDecisionId: string | null;
	budgetImpactId: string | null;
};

export type LedgerSummary = {
	committed: string;
	incurred: string;
	dueOpen: string;
	paid: string;
	generalIncurredUncommitted: string;
	contracts: {
		contractedValue: string;
		amendmentNet: string;
		measuredGross: string;
		dueOpen: string;
		paid: string;
	};
};

export type LedgerGroupKey = {
	eventType: LedgerEventType;
	sourceType: string;
	sourceId: string;
	componentId: string;
};

export type LedgerBalanceRow = {
	eventType: string;
	amount: string;
};
