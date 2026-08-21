import { metrics } from "../../lib/metrics";
import { prisma } from "../../lib/prisma";

export const projectionOutboxKey = (workId: string, sourceVersionId: string) =>
	`budget-projection:${workId}:${sourceVersionId}`;

export async function enqueueBudgetProjection(input: {
	ownerId: string;
	workId: string;
	sourceVersionId: string;
}) {
	return prisma.budgetProjectionOutbox.upsert({
		where: {
			idempotencyKey: projectionOutboxKey(input.workId, input.sourceVersionId),
		},
		create: {
			...input,
			idempotencyKey: projectionOutboxKey(input.workId, input.sourceVersionId),
			status: "PENDING",
		},
		update: {
			ownerId: input.ownerId,
			status: "PENDING",
			availableAt: new Date(),
			lastError: null,
		},
	});
}

export async function markBudgetProjectionDone(
	workId: string,
	sourceVersionId: string,
) {
	return prisma.budgetProjectionOutbox.updateMany({
		where: {
			workId,
			sourceVersionId,
			status: { in: ["PENDING", "PROCESSING"] },
		},
		data: { status: "DONE", processedAt: new Date(), lockedAt: null },
	});
}

export async function markBudgetProjectionFailed(
	workId: string,
	sourceVersionId: string,
	error: string,
) {
	return prisma.budgetProjectionOutbox.updateMany({
		where: { workId, sourceVersionId },
		data: {
			status: "FAILED",
			lastError: error.slice(0, 2000),
			lockedAt: null,
		},
	});
}

/** Claims ready entries atomically enough for a single worker process. */
export async function claimPendingBudgetProjections(limit = 10) {
	const now = new Date();
	const rows = await prisma.budgetProjectionOutbox.findMany({
		where: {
			status: "PENDING",
			availableAt: { lte: now },
		},
		orderBy: { createdAt: "asc" },
		take: Math.min(100, Math.max(1, limit)),
	});
	const claimed: unknown[] = [];
	for (const row of rows) {
		const result = await prisma.budgetProjectionOutbox.update({
			where: { id: row.id },
			data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
		});
		claimed.push(result);
	}
	metrics.increment("budget_projection_outbox.claimed", claimed.length);
	return claimed;
}

export async function retryFailedBudgetProjections(
	maxAttempts = 5,
	backoffMs = 30_000,
) {
	const result = await prisma.budgetProjectionOutbox.updateMany({
		where: { status: "FAILED", attempts: { lt: maxAttempts } },
		data: {
			status: "PENDING",
			availableAt: new Date(Date.now() + backoffMs),
			lockedAt: null,
		},
	});
	const count = (result as { count?: number }).count ?? 0;
	metrics.increment("budget_projection_outbox.retried", count);
	return result;
}

export async function processBudgetProjectionOutbox(
	project: (entry: {
		ownerId: string;
		workId: string;
		sourceVersionId: string;
	}) => Promise<void>,
	limit = 10,
) {
	const entries = (await claimPendingBudgetProjections(limit)) as Array<{
		ownerId: string;
		workId: string;
		sourceVersionId: string;
	}>;
	let succeeded = 0;
	for (const entry of entries) {
		try {
			await project(entry);
			await markBudgetProjectionDone(entry.workId, entry.sourceVersionId);
			succeeded += 1;
		} catch (error) {
			await markBudgetProjectionFailed(
				entry.workId,
				entry.sourceVersionId,
				error instanceof Error ? error.message : String(error),
			);
			metrics.increment("budget_projection_outbox.failed");
		}
	}
	metrics.increment("budget_projection_outbox.processed", succeeded);
	return {
		claimed: entries.length,
		succeeded,
		failed: entries.length - succeeded,
	};
}
