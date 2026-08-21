import type { Prisma } from "@prisma/client";
import { withSerializableRetry } from "../../../lib/transaction-retry";
import { submitApproval } from "../../governance/approval.service";
import type { BudgetMutationResult } from "./budget-control.types";

export async function submitOverflowApproval(input: {
	actorId: string;
	workId: string;
	result: BudgetMutationResult;
	sourceType: string;
	sourceId: string;
}) {
	const impactIds = input.result.allocations
		.filter(
			(allocation) =>
				allocation.status === "PENDING_APPROVAL" && allocation.impactId,
		)
		.map((allocation) => allocation.impactId as string);
	if (impactIds.length === 0) return null;
	return submitApproval({
		actorId: input.actorId,
		resourceType: "WORK",
		resourceId: input.workId,
		effectAction: "BUDGET_IMPACT_APPROVE",
		payload: { workId: input.workId, impactIds },
		expectedVersion: 1,
		idempotencyKey: `budget-impact:${input.sourceType}:${input.sourceId}`,
	});
}

export async function withOverflowApproval<T>(input: {
	ownerId: string;
	workId: string;
	sourceType: string;
	commit: (tx: Prisma.TransactionClient) => Promise<{
		value: T;
		sourceId: string;
		overflow?: BudgetMutationResult | null;
	}>;
}): Promise<T> {
	const { value, sourceId, overflow } = await withSerializableRetry((tx) =>
		input.commit(tx),
	);
	if (overflow?.requiresApproval) {
		await submitOverflowApproval({
			actorId: input.ownerId,
			workId: input.workId,
			result: overflow,
			sourceType: input.sourceType,
			sourceId,
		});
	}
	return value;
}
