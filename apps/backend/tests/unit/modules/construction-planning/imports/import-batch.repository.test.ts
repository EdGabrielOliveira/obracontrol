import { beforeEach, describe, expect, it, mock } from "bun:test";

const importBatchFindFirst = mock(async () => ({
	rows: [{ id: "row-1" }, { id: "row-2" }],
}));

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: { importBatch: { findFirst: importBatchFindFirst } },
}));

describe("import batch repository", () => {
	beforeEach(() => {
		importBatchFindFirst.mockClear();
	});

	it("lists valid and warning row ids with owner and work scope in one query", async () => {
		const { listSelectableImportRowIds } = await import(
			"../../../../../src/modules/construction-planning/imports/import-batch.repository"
		);

		await expect(
			listSelectableImportRowIds("owner-1", "work-1", "batch-1"),
		).resolves.toEqual(["row-1", "row-2"]);
		expect(importBatchFindFirst).toHaveBeenCalledTimes(1);
		expect(importBatchFindFirst).toHaveBeenCalledWith({
			where: {
				id: "batch-1",
				ownerId: "owner-1",
				workId: "work-1",
				status: "READY",
				expiresAt: { gt: expect.any(Date) },
			},
			select: {
				rows: {
					where: { status: { in: ["VALID", "WARNING"] } },
					orderBy: { seq: "asc" },
					select: { id: true },
				},
			},
		});
	});

	it("finds a preview batch with both owner and work scope", async () => {
		const { findImportBatch } = await import(
			"../../../../../src/modules/construction-planning/imports/import-batch.repository"
		);

		await findImportBatch("owner-1", "work-1", "batch-1");

		expect(importBatchFindFirst).toHaveBeenCalledWith({
			where: { id: "batch-1", ownerId: "owner-1", workId: "work-1" },
		});
	});
});
