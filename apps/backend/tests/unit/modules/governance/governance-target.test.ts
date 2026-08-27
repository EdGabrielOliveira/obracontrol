import { beforeEach, describe, expect, it, mock } from "bun:test";

const workFindUnique = mock(
	async (): Promise<{ id: string } | null> => ({ id: "work-1" }),
);
const contractFindUnique = mock(async () => ({
	work: { id: "work-1", ownerId: "owner-1", workspaceId: "ws-1" },
}));
const costFindUnique = mock(async () => ({
	work: { id: "work-1", ownerId: "owner-1", workspaceId: "ws-1" },
}));
type MeasurementTarget = {
	work: { id: string; ownerId: string; workspaceId: string };
};
const measurementFindUnique = mock(
	async (): Promise<MeasurementTarget | null> => ({
		work: { id: "work-1", ownerId: "owner-1", workspaceId: "ws-1" },
	}),
);
const workMeasurementFindUnique = mock(
	async (): Promise<MeasurementTarget | null> => ({
		work: { id: "work-1", ownerId: "owner-1", workspaceId: "ws-1" },
	}),
);
const contractMeasurementFindUnique = mock(async () => ({
	contract: { work: { id: "work-1", ownerId: "owner-1", workspaceId: "ws-1" } },
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findUnique: workFindUnique },
		contract: { findUnique: contractFindUnique },
		constructionActualCost: { findUnique: costFindUnique },
		constructionMeasurement: { findUnique: measurementFindUnique },
		workMeasurement: { findUnique: workMeasurementFindUnique },
		contractMeasurement: { findUnique: contractMeasurementFindUnique },
	},
}));

const { resolveGovernanceTarget } = await import(
	"../../../../src/modules/governance/governance-target"
);

describe("resolveGovernanceTarget", () => {
	beforeEach(() => {
		workFindUnique.mockClear();
		contractFindUnique.mockClear();
		costFindUnique.mockClear();
		measurementFindUnique.mockClear();
		workMeasurementFindUnique.mockClear();
		contractMeasurementFindUnique.mockClear();
		workFindUnique.mockResolvedValue({ id: "work-1" });
		workMeasurementFindUnique.mockResolvedValue({
			work: { id: "work-1", ownerId: "owner-1", workspaceId: "ws-1" },
		});
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

	it("resolves resource status entities through their owning work", async () => {
		for (const [entityType, delegate] of [
			["CONTRACT_STATUS", contractFindUnique],
			["COST_STATUS", costFindUnique],
			["WORK_MEASUREMENT_STATUS", workMeasurementFindUnique],
			["CONTRACT_MEASUREMENT_STATUS", contractMeasurementFindUnique],
		] as const) {
			expect(await resolveGovernanceTarget(entityType, "resource-1")).toEqual({
				workId: "work-1",
				resourceOwnerId: "owner-1",
				workspaceId: "ws-1",
			});
			expect(delegate).toHaveBeenCalled();
		}
	});

	it("falls back to the legacy construction measurement model", async () => {
		workMeasurementFindUnique.mockResolvedValue(null);

		expect(
			await resolveGovernanceTarget("WORK_MEASUREMENT_STATUS", "legacy-1"),
		).toEqual({
			workId: "work-1",
			resourceOwnerId: "owner-1",
			workspaceId: "ws-1",
		});
		expect(measurementFindUnique).toHaveBeenCalled();
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
