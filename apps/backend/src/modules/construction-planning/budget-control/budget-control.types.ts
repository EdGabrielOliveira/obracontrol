import type { Decimal } from "@prisma/client/runtime/library";

export type BudgetAllocationInput = {
	budgetItemId: string;
	quantity?: number;
	value?: number;
	percentage?: number;
};

export type ApplyBudgetImpactAllocation = BudgetAllocationInput & {
	amount?: number;
};

export type BudgetItemReferenceRow = {
	budgetItemId: string;
	/** ID da linha operacional usada pelas tabelas legadas com FK para orçamento. */
	operationalBudgetItemId?: string | null;
	index: string;
	identityId: string;
	versionItemId: string;
	quantity: Decimal | null;
	unitCost: Decimal | null;
};

export type BudgetBalanceRow = {
	budgetItemId: string;
	identityId: string;
	versionItemId: string;
	commitmentNet: Decimal;
	independentConsumed: Decimal;
	contractConsumed: Decimal;
	pendingImpact: Decimal;
};

export type NormalizedAllocation = {
	budgetItemId: string;
	basis: "PERCENTAGE" | "VALUE";
	percentage: number;
	value: Decimal;
	quantity?: Decimal;
};

export type BudgetBalance = {
	budgetItemId: string;
	limit: number;
	approvedCommitted: number;
	approvedConsumed: number;
	pendingImpact: number;
	availableBalance: number;
	projectedBalance: number;
};

export type BudgetPreview = {
	items: BudgetBalance[];
	totalImpact: number;
	requiresApproval: boolean;
};

export type BalanceCalculationInput = {
	budgetItemId: string;
	limit: Decimal;
	approvedCommitted: Decimal;
	independentConsumed: Decimal;
	uncoveredContractConsumed: Decimal;
	pendingImpact: Decimal;
};

export type ImpactPlanningInput = BalanceCalculationInput & {
	impactType: BudgetImpactType;
	amount: Decimal;
};

export type BudgetImpactPlan = {
	budgetItemId: string;
	impactType: BudgetImpactType;
	status: "APPROVED" | "PENDING_APPROVAL";
	amount: Decimal;
	availableBalance: number;
	projectedBalance: number;
};

export type BudgetPreviewInput = {
	allocations: BudgetAllocationInput[];
	amount?: number;
};

export type BudgetApplyContext = {
	userId: string;
	reason?: string | null;
};

export type ApplyBudgetImpactInput = {
	workId: string;
	allocations: ApplyBudgetImpactAllocation[];
	amount?: number;
	allowPending?: boolean;
	impactType: "COMMITMENT" | "CONSUMPTION";
	sourceType: string;
	sourceId: string;
	componentId?: string;
	competence?: string;
	occurredAt?: Date;
};

export type BudgetImpactAllocationResult = {
	budgetItemId: string;
	impactId: string | null;
	impactType: BudgetImpactType;
	status: "APPROVED" | "PENDING_APPROVAL" | "REJECTED";
	amount: number;
	availableBalance: number;
	projectedBalance: number;
};

export type BudgetMutationResult = {
	status: "APPROVED" | "PENDING_APPROVAL";
	requiresApproval: boolean;
	availableBalance: number;
	projectedBalance: number;
	allocations: BudgetImpactAllocationResult[];
};

export type BudgetImpactType =
	| "COMMITMENT"
	| "CONSUMPTION"
	| "CONVERSION"
	| "REVERSAL";

export type BudgetImpactStatus =
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "REVERSED";

export type BudgetControlErrorCode =
	| "BUDGET_ITEM_REQUIRED"
	| "BUDGET_ITEM_NOT_FOUND"
	| "BUDGET_ITEM_WRONG_WORK"
	| "BUDGET_VERSION_NOT_AVAILABLE"
	| "BUDGET_QUANTITY_REQUIRED"
	| "BUDGET_QUANTITY_EXCEEDS_LIMIT"
	| "BUDGET_ALLOCATION_MISMATCH"
	| "BUDGET_BALANCE_EXCEEDED"
	| "BUDGET_OPERATION_PENDING_APPROVAL"
	| "BUDGET_VERSION_CHANGED"
	| "BUDGET_DUPLICATE_CONSUMPTION"
	| "BUDGET_MEASUREMENT_ALREADY_COVERED"
	| "BUDGET_LEGACY_RECONCILIATION_REQUIRED"
	| "BUDGET_CONCURRENT_UPDATE";
