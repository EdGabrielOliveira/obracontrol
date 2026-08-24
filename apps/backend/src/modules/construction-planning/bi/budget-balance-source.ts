import { ConstructionError } from "../../../lib/errors";
import { budgetControlService } from "../budget-control/budget-control.service";
import type { BudgetBalance } from "../budget-control/budget-control.types";
import { summarizeLedger } from "../ledger/ledger.service";
import { getWorkWithItems } from "../works/works.repository";

export type BalanceCoverage = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

export type WorkBalanceDto = {
	limit: number;
	approvedCommitted: number;
	approvedConsumed: number;
	dueOpen: number;
	paid: number;
	pendingImpact: number;
	availableBalance: number;
	projectedBalance: number;
	sourceMode: "LIVE";
	coverage: BalanceCoverage;
	items: BudgetBalance[];
};

export type OfficialWorkBalanceContext = {
	work?: { items?: Array<{ id: string }> } | null;
	summary?: Awaited<ReturnType<typeof summarizeLedger>> | null;
};

export async function getOfficialWorkBalance(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
	context: OfficialWorkBalanceContext = {},
): Promise<WorkBalanceDto> {
	const work =
		context.work !== undefined
			? context.work
			: await getWorkWithItems(ownerId, workId);
	const summary =
		context.summary !== undefined
			? context.summary
			: await summarizeLedger(ownerId, workId, asOfDate ?? new Date());

	if (!work) {
		return {
			limit: 0,
			approvedCommitted: 0,
			approvedConsumed: 0,
			dueOpen: 0,
			paid: 0,
			pendingImpact: 0,
			availableBalance: 0,
			projectedBalance: 0,
			sourceMode: "LIVE",
			coverage: "UNAVAILABLE",
			items: [],
		};
	}

	const budgetItemIds = (work.items ?? []).map(
		(item: { id: string }) => item.id,
	);
	let items: BudgetBalance[] = [];
	if (budgetItemIds.length > 0) {
		try {
			items = await budgetControlService.getAvailability(
				ownerId,
				workId,
				budgetItemIds,
			);
		} catch (error) {
			if (
				error instanceof ConstructionError &&
				error.code === "BUDGET_VERSION_NOT_AVAILABLE"
			) {
				items = [];
			} else {
				throw error;
			}
		}
	}

	const totals = items.reduce(
		(acc, item) => ({
			limit: acc.limit + item.limit,
			approvedCommitted: acc.approvedCommitted + item.approvedCommitted,
			approvedConsumed: acc.approvedConsumed + item.approvedConsumed,
			pendingImpact: acc.pendingImpact + item.pendingImpact,
			availableBalance: acc.availableBalance + item.availableBalance,
			projectedBalance: acc.projectedBalance + item.projectedBalance,
		}),
		{
			limit: 0,
			approvedCommitted: 0,
			approvedConsumed: 0,
			pendingImpact: 0,
			availableBalance: 0,
			projectedBalance: 0,
		},
	);

	return {
		...totals,
		dueOpen: Number(summary?.dueOpen ?? 0),
		paid: Number(summary?.paid ?? 0),
		sourceMode: "LIVE",
		coverage: items.length === 0 ? "PARTIAL" : "AVAILABLE",
		items,
	};
}
