import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const budgetVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({ id: "version-1" }),
);
const budgetVersionItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [
		{ id: "vitem-1.1", identityId: "identity-1.1", index: "1.1" },
		{ id: "vitem-1.2", identityId: "identity-1.2", index: "1.2" },
	],
);
const impactFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const resolveResourceScopeMock = mock(
	async (): Promise<Record<string, unknown>> => ({ canRead: true }),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		budgetVersion: { findFirst: budgetVersionFindFirst },
		budgetVersionItem: { findMany: budgetVersionItemFindMany },
		constructionBudgetImpact: { findMany: impactFindMany },
	},
}));

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: resolveResourceScopeMock,
}));

describe("budget version exposure", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		budgetVersionFindFirst.mockResolvedValue({ id: "version-1" });
		budgetVersionItemFindMany.mockResolvedValue([
			{ id: "vitem-1.1", identityId: "identity-1.1", index: "1.1" },
			{ id: "vitem-1.2", identityId: "identity-1.2", index: "1.2" },
		]);
		impactFindMany.mockResolvedValue([]);
		resolveResourceScopeMock.mockResolvedValue({ canRead: true });
	});

	it("aggregates contracted and measured quantities per item index", async () => {
		impactFindMany.mockResolvedValue([
			{
				budgetItemIdentityId: "identity-1.1",
				sourceType: "CONTRACT_SERVICE",
				impactType: "COMMITMENT",
				quantity: new Decimal(8),
			},
			{
				budgetItemIdentityId: "identity-1.1",
				sourceType: "WORK_MEASUREMENT",
				impactType: "CONSUMPTION",
				quantity: new Decimal(5),
			},
			{
				budgetItemIdentityId: "identity-1.2",
				sourceType: "CONTRACT_SERVICE",
				impactType: "COMMITMENT",
				quantity: new Decimal(3),
			},
		]);

		const { loadBudgetExposure } = await import(
			"../../../../src/modules/construction-planning/budget-version-exposure.service"
		);
		const exposure = await loadBudgetExposure("user-1", "work-1");

		expect(exposure.get("1.1")?.contractedQuantity.toNumber()).toBe(8);
		expect(exposure.get("1.1")?.measuredQuantity.toNumber()).toBe(5);
		expect(exposure.get("1.1")?.executedQuantity.toNumber()).toBe(5);
		expect(exposure.get("1.1")?.paidQuantity.toNumber()).toBe(0);
		expect(exposure.get("1.2")?.contractedQuantity.toNumber()).toBe(3);
	});

	it("returns an empty map when the work has no active version", async () => {
		budgetVersionFindFirst.mockResolvedValue(null);

		const { loadBudgetExposure } = await import(
			"../../../../src/modules/construction-planning/budget-version-exposure.service"
		);
		const exposure = await loadBudgetExposure("user-1", "work-1");

		expect(exposure.size).toBe(0);
	});

	it("denies exposure when the actor cannot read the work", async () => {
		resolveResourceScopeMock.mockResolvedValue({ canRead: false });

		const { loadBudgetExposure } = await import(
			"../../../../src/modules/construction-planning/budget-version-exposure.service"
		);
		await expect(loadBudgetExposure("user-1", "work-1")).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});
});
