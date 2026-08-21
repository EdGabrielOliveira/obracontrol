import Decimal from "decimal.js";

export const QUOTATION_SEMAPHORE_YELLOW_LIMIT_PERCENT = 5;

export type QuotationSemaphoreStatus =
	| "GREEN"
	| "YELLOW"
	| "RED"
	| "UNAVAILABLE";

export type QuotationSemaphoreResult = {
	status: QuotationSemaphoreStatus;
	budgetTotal: number | null;
	varianceAmount: number | null;
	variancePercent: number | null;
	limitPercent: number;
};

export function calculateQuotationSemaphore(
	budgetTotal: Decimal.Value,
	proposalValue: Decimal.Value,
	limitPercent: Decimal.Value = QUOTATION_SEMAPHORE_YELLOW_LIMIT_PERCENT,
): QuotationSemaphoreResult {
	const budget = new Decimal(budgetTotal);
	const proposal = new Decimal(proposalValue);
	const limit = new Decimal(limitPercent);
	if (!budget.isFinite() || budget.lte(0) || !proposal.isFinite()) {
		return {
			status: "UNAVAILABLE",
			budgetTotal: null,
			varianceAmount: null,
			variancePercent: null,
			limitPercent: limit.toNumber(),
		};
	}
	const variance = proposal.minus(budget);
	const variancePercent = variance.div(budget).mul(100);
	return {
		status: variancePercent.lte(0)
			? "GREEN"
			: variancePercent.lte(limit)
				? "YELLOW"
				: "RED",
		budgetTotal: budget.toNumber(),
		varianceAmount: variance.toNumber(),
		variancePercent: variancePercent.toNumber(),
		limitPercent: limit.toNumber(),
	};
}
