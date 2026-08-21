import { describe, expect, it, mock } from "bun:test";

const upsert = mock(async (args: unknown) => args);
const updateMany = mock(async (args: unknown) => args);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: { budgetProjectionOutbox: { upsert, updateMany } },
}));

describe("budget projection outbox", () => {
	it("uses a deterministic idempotency key and enqueues pending work", async () => {
		const { enqueueBudgetProjection, projectionOutboxKey } = await import(
			"../../../../src/modules/construction-planning/budget-projection-outbox.service"
		);
		await enqueueBudgetProjection({
			ownerId: "owner-1",
			workId: "work-1",
			sourceVersionId: "version-1",
		});
		expect(projectionOutboxKey("work-1", "version-1")).toBe(
			"budget-projection:work-1:version-1",
		);
		expect(upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { idempotencyKey: "budget-projection:work-1:version-1" },
				create: expect.objectContaining({ status: "PENDING" }),
			}),
		);
	});

	it("marks only pending/processing entries as done", async () => {
		const { markBudgetProjectionDone } = await import(
			"../../../../src/modules/construction-planning/budget-projection-outbox.service"
		);
		await markBudgetProjectionDone("work-1", "version-1");
		expect(updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					status: { in: ["PENDING", "PROCESSING"] },
				}),
				data: expect.objectContaining({ status: "DONE" }),
			}),
		);
	});
});
