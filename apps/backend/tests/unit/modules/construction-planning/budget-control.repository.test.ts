import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import {
	getBalanceRows,
	getBudgetItemReferences,
} from "../../../../src/modules/construction-planning/budget-control/budget-control.repository";

type FakeQueryArgs = {
	where: {
		OR?: Array<{
			id?: { in?: string[] };
			identityId?: { in?: string[] };
		}>;
		id?: { in?: string[] };
		index?: { in?: string[] };
		budgetItemIdentityId?: { in?: string[] };
	};
};

function makeDatabase(itemCount: number) {
	const items = Array.from({ length: itemCount }, (_, index) => ({
		id: `operational-${index}`,
		index: `1.${index}`,
		identityId: `identity-${index}`,
	}));
	const identities = items.map(({ index, identityId }) => ({
		id: identityId,
		index,
	}));
	const versionItems = items.map((item) => ({
		id: `version-${item.id}`,
		index: item.index,
		identityId: item.identityId,
		quantity: new Decimal(1),
		unitCost: new Decimal(10),
	}));
	const calls = {
		itemIds: [] as number[],
		identityIds: [] as number[],
		ledgerIds: [] as number[],
		impactIds: [] as number[],
	};
	const database = {
		budgetVersion: { findFirst: async () => ({ id: "version-1" }) },
		constructionWork: { findFirst: async () => ({ activeImportId: null }) },
		constructionBudgetItem: {
			findMany: async (args: unknown) => {
				const query = args as FakeQueryArgs;
				const ids = query.where.OR?.[0]?.id?.in ?? query.where.id?.in ?? [];
				calls.itemIds.push(ids.length);
				return items.filter((item) => ids.includes(item.id));
			},
		},
		budgetItemIdentity: {
			findMany: async (args: unknown) => {
				const query = args as FakeQueryArgs;
				const indexes = query.where.index?.in ?? [];
				calls.identityIds.push(indexes.length);
				return identities.filter((identity) =>
					indexes.includes(identity.index),
				);
			},
		},
		budgetVersionItem: {
			findMany: async (args: unknown) => {
				const query = args as FakeQueryArgs;
				const ids = query.where.OR?.[0]?.id?.in ?? [];
				const identityIds = query.where.OR?.[1]?.identityId?.in ?? [];
				return versionItems.filter(
					(item) =>
						ids.includes(item.id) || identityIds.includes(item.identityId),
				);
			},
		},
		constructionLedgerEvent: {
			groupBy: async (args: unknown) => {
				const query = args as FakeQueryArgs;
				const ids = query.where.budgetItemIdentityId?.in ?? [];
				calls.ledgerIds.push(ids.length);
				return ids.map((budgetItemIdentityId) => ({
					budgetItemIdentityId,
					eventType: "COMMITMENT_INCREASE",
					sourceType: "WORK",
					_sum: { amount: new Decimal(1) },
				}));
			},
		},
		constructionBudgetImpact: {
			findMany: async (args: unknown) => {
				const query = args as FakeQueryArgs;
				const ids = query.where.budgetItemIdentityId?.in ?? [];
				calls.impactIds.push(ids.length);
				return ids.map((budgetItemIdentityId) => ({
					budgetItemIdentityId,
					amount: new Decimal(1),
				}));
			},
		},
	};
	return { database, items, calls };
}

describe("budget control SQLite batching", () => {
	it("resolves more than 1,000 references in sequential batches", async () => {
		const { database, items, calls } = makeDatabase(1_001);
		const result = await getBudgetItemReferences(
			"owner-1",
			"work-1",
			items.map((item) => item.id),
			database as never,
		);

		expect(result.found).toHaveLength(1_001);
		expect(result.found.map((item) => item.budgetItemId)).toEqual(
			items.map((item) => item.id),
		);
		expect(result.missing).toEqual([]);
		expect(calls.itemIds.every((size) => size <= 200)).toBe(true);
	});

	it("calculates balances in batches and keeps duplicate reference order", async () => {
		const { database, calls } = makeDatabase(1_001);
		const references = Array.from({ length: 1_001 }, (_, index) => ({
			budgetItemId: `item-${index}`,
			identityId: `identity-${index}`,
			versionItemId: `version-${index}`,
			index: `1.${index}`,
			quantity: new Decimal(1),
			unitCost: new Decimal(10),
		}));
		const result = await getBalanceRows(
			"owner-1",
			"work-1",
			references,
			database as never,
		);

		expect(result).toHaveLength(1_001);
		expect(result[0]?.budgetItemId).toBe("item-0");
		expect(result[1_000]?.budgetItemId).toBe("item-1000");
		expect(calls.ledgerIds.every((size) => size <= 200)).toBe(true);
		expect(calls.impactIds.every((size) => size <= 200)).toBe(true);
	});
});
