import { describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const versionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const importCreate = mock(async () => ({ id: "import-1" }));
const budgetItemCreate = mock(
	async (args: {
		data: Record<string, unknown>;
	}): Promise<Record<string, unknown>> =>
		({
			id: `item-${String(args.data.index)}`,
			index: args.data.index,
		}) as Record<string, unknown>,
);
const baselineScheduleCreate = mock(async () => ({}));
const workUpdate = mock(async () => ({}));
const workFindUnique = mock(
	async (): Promise<{ activeImportId: string | null }> => ({
		activeImportId: null,
	}),
);
const budgetItemFindMany = mock(
	async (): Promise<Array<{ id: string; index: string }>> => [],
);
const relationUpdateMany = mock(async () => ({ count: 0 }));
const projectionStateUpsert = mock(async () => ({}));
const projectionOutboxUpdateMany = mock(async () => ({ count: 0 }));

function makeTx() {
	return {
		budgetVersion: { findFirst: versionFindFirst },
		constructionImport: { create: importCreate },
		constructionBudgetItem: {
			create: budgetItemCreate,
			findMany: budgetItemFindMany,
		},
		constructionActualCost: { updateMany: relationUpdateMany },
		actualCostAllocation: { updateMany: relationUpdateMany },
		constructionMeasurement: { updateMany: relationUpdateMany },
		constructionScheduleRevision: { updateMany: relationUpdateMany },
		scheduleVersionItem: { updateMany: relationUpdateMany },
		workMeasurementItem: { updateMany: relationUpdateMany },
		contractService: { updateMany: relationUpdateMany },
		quotationBudgetItem: { updateMany: relationUpdateMany },
		contractRequestBudgetItem: { updateMany: relationUpdateMany },
		constructionBaselineSchedule: { create: baselineScheduleCreate },
		constructionWork: { findUnique: workFindUnique, update: workUpdate },
		budgetProjectionState: { upsert: projectionStateUpsert },
		budgetProjectionOutbox: { updateMany: projectionOutboxUpdateMany },
	};
}

function versionWithItems() {
	return {
		id: "version-2",
		ownerId: "owner-1",
		workId: "work-1",
		label: "Aditivo 1",
		status: "RASCUNHO",
		items: [
			{
				id: "vitem-1",
				parentVersionId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa 1",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: new Decimal(0),
				plannedStart: null,
				plannedEnd: null,
				sortOrder: 0,
			},
			{
				id: "vitem-1.1",
				parentVersionId: "vitem-1",
				index: "1.1",
				type: "ITEM",
				description: "Servico",
				unit: "m2",
				quantity: new Decimal(10),
				unitCost: new Decimal(70),
				totalCost: new Decimal(700),
				plannedStart: new Date("2026-08-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-08-12T00:00:00.000Z"),
				sortOrder: 1,
			},
			{
				id: "vitem-1.1.1",
				parentVersionId: "vitem-1.1",
				index: "1.1.1",
				type: "ITEM",
				description: "Servico filho",
				unit: "un",
				quantity: new Decimal(5),
				unitCost: new Decimal(20),
				totalCost: new Decimal(100),
				plannedStart: null,
				plannedEnd: null,
				sortOrder: 2,
			},
		],
	};
}

describe("budget version projection", () => {
	it("projects the item hierarchy preserving parent indexes", async () => {
		versionFindFirst.mockResolvedValue(versionWithItems());

		const { projectApprovedBudgetVersion } = await import(
			"../../../../src/modules/construction-planning/budget-version-projection.service"
		);
		await projectApprovedBudgetVersion(makeTx() as never, {
			ownerId: "owner-1",
			workId: "work-1",
			budgetVersionId: "version-2",
		});

		const created = (
			budgetItemCreate as ReturnType<typeof mock>
		).mock.calls.map(([call]) => ({
			index: (call as { data: { index: string } }).data.index,
			parentId: (call as { data: { parentId: string | null } }).data.parentId,
		}));
		expect(created).toEqual([
			{ index: "1", parentId: null },
			{ index: "1.1", parentId: "item-1" },
			{ index: "1.1.1", parentId: "item-1.1" },
		]);
	});

	it("projects the schedule snapshot of each item", async () => {
		versionFindFirst.mockResolvedValue(versionWithItems());

		const { projectApprovedBudgetVersion } = await import(
			"../../../../src/modules/construction-planning/budget-version-projection.service"
		);
		await projectApprovedBudgetVersion(makeTx() as never, {
			ownerId: "owner-1",
			workId: "work-1",
			budgetVersionId: "version-2",
		});

		expect(baselineScheduleCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					index: "1.1",
					budgetItemId: "item-1.1",
					plannedEnd: new Date("2026-08-12T00:00:00.000Z"),
				}),
			}),
		);
	});

	it("moves operational links to the projected item IDs", async () => {
		versionFindFirst.mockResolvedValue(versionWithItems());
		workFindUnique.mockResolvedValue({ activeImportId: "old-import" });
		budgetItemFindMany.mockResolvedValue([
			{ id: "old-item-1.1", index: "1.1" },
		]);

		const { projectApprovedBudgetVersion } = await import(
			"../../../../src/modules/construction-planning/budget-version-projection.service"
		);
		await projectApprovedBudgetVersion(makeTx() as never, {
			ownerId: "owner-1",
			workId: "work-1",
			budgetVersionId: "version-2",
		});

		expect(relationUpdateMany).toHaveBeenCalledWith({
			where: { budgetItemId: "old-item-1.1" },
			data: { budgetItemId: "item-1.1" },
		});
	});
});
