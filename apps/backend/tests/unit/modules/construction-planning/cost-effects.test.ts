import { afterEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const resolveLedgerItemRef = mock(
	async (_ownerId: string, _workId: string, budgetItemId: string) => ({
		identityId: `identity-${budgetItemId}`,
		versionItemId: `version-${budgetItemId}`,
		operationalBudgetItemId: budgetItemId,
	}),
);
const buildGeneralCostEvents = mock(
	(
		base: Record<string, unknown>,
		amount: { toString(): string },
		paidInCash: boolean,
	) => [
		{ ...base, eventType: "INCURRED_CREATE", amount },
		{ ...base, eventType: "DUE_CREATE", amount },
		...(paidInCash ? [{ ...base, eventType: "PAYMENT_CREATE", amount }] : []),
	],
);
const appendLedgerEvent = mock(async (..._args: unknown[]) => undefined);

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mock(async () => ({
		actorId: "owner-1",
		resourceType: "WORK",
		resourceOwnerId: "owner-1",
		workspaceId: "workspace-1",
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		role: "ADMIN",
		canRead: true,
		canWrite: true,
		canApprove: true,
		canAdmin: true,
	})),
}));

mock.module(
	"../../../../src/modules/construction-planning/ledger/ledger.integration",
	() => ({
		buildGeneralCostEvents,
		competenceOf: mock(() => "2026-01"),
		GENERAL_COST_SOURCE_TYPE: "GENERAL_COST",
		resolveLedgerItemRef,
		reverseLedgerEvents: mock(() => []),
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/ledger/ledger.service",
	() => ({ appendLedgerEvent }),
);

afterEach(() => {
	mock.restore();
});

describe("cost effects", () => {
	it("emits due and payment events for every cost allocation", async () => {
		const { emitGeneralCostEvents } = await import(
			"../../../../src/modules/construction-planning/entries/cost-effects"
		);

		await emitGeneralCostEvents(
			"owner-1",
			"work-1",
			{
				costDate: new Date("2026-01-20"),
				amount: new Decimal(100),
				paymentStatus: "PAID",
			},
			{} as never,
			"cost-1",
			[
				{
					budgetItemId: "item-1",
					basis: "PERCENTAGE",
					percentage: 25,
					value: new Decimal(25),
				},
				{
					budgetItemId: "item-2",
					basis: "PERCENTAGE",
					percentage: 75,
					value: new Decimal(75),
				},
			],
		);

		expect(appendLedgerEvent).toHaveBeenCalledTimes(4);
		expect(
			appendLedgerEvent.mock.calls.map(([event]) => {
				const emitted = event as {
					eventType: string;
					budgetItemIdentityId: string;
					amount: Decimal;
				};
				return {
					eventType: emitted.eventType,
					budgetItemIdentityId: emitted.budgetItemIdentityId,
					amount: emitted.amount.toString(),
				};
			}),
		).toEqual([
			{
				eventType: "DUE_CREATE",
				budgetItemIdentityId: "identity-item-1",
				amount: "25",
			},
			{
				eventType: "PAYMENT_CREATE",
				budgetItemIdentityId: "identity-item-1",
				amount: "25",
			},
			{
				eventType: "DUE_CREATE",
				budgetItemIdentityId: "identity-item-2",
				amount: "75",
			},
			{
				eventType: "PAYMENT_CREATE",
				budgetItemIdentityId: "identity-item-2",
				amount: "75",
			},
		]);
	});
});
