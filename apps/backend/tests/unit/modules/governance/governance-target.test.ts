import { beforeEach, describe, expect, it, mock } from "bun:test";

const workFindUnique = mock(
	async (): Promise<{ id: string } | null> => ({ id: "work-1" }),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findUnique: workFindUnique },
	},
}));

const { resolveGovernanceTarget } = await import(
	"../../../../src/modules/governance/governance-target"
);

describe("resolveGovernanceTarget", () => {
	beforeEach(() => {
		workFindUnique.mockClear();
		workFindUnique.mockResolvedValue({ id: "work-1" });
	});

	it("resolves work-scoped entity types to the existing work", async () => {
		const result = await resolveGovernanceTarget("BUDGET", "work-1");

		expect(result).toEqual({ workId: "work-1" });
		expect(workFindUnique).toHaveBeenCalledWith({
			where: { id: "work-1" },
			select: { id: true },
		});
	});

	it("covers every work-scoped entity type used by the guards", async () => {
		for (const entityType of [
			"WORK",
			"BUDGET",
			"CONTRACT",
			"SCHEDULE",
			"WORK_MEASUREMENTS",
			"WORK_COSTS",
			"WORK_IMPORTS",
		]) {
			const result = await resolveGovernanceTarget(entityType, "work-1");
			expect(result).toEqual({ workId: "work-1" });
		}
	});

	it("returns null for unknown entity types without querying", async () => {
		const result = await resolveGovernanceTarget("ORGANIZATION", "work-1");

		expect(result).toBeNull();
		expect(workFindUnique).not.toHaveBeenCalled();
	});

	it("returns null when the work does not exist", async () => {
		workFindUnique.mockResolvedValue(null);

		const result = await resolveGovernanceTarget("BUDGET", "work-missing");

		expect(result).toBeNull();
	});

	it("returns null for empty entity ids", async () => {
		expect(await resolveGovernanceTarget("BUDGET", "  ")).toBeNull();
		expect(workFindUnique).not.toHaveBeenCalled();
	});
});
