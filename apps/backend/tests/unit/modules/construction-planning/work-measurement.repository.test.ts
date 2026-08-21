import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const workFindFirst = mock(async () => ({
	id: "work-1",
	code: "W-001",
	name: "Obra Teste",
}));

const measurementFindFirst = mock<() => Promise<Record<string, unknown>>>(
	async () => ({
		id: "measurement-1",
		workId: "work-1",
		number: 1,
		date: new Date("2026-07-01"),
		title: "Medicao 1",
		discountValue: null,
		retentionValue: null,
		createdBy: null,
		notes: null,
		createdAt: new Date("2026-07-01"),
		updatedAt: new Date("2026-07-01"),
		items: [
			{
				id: "wmi-1",
				measurementId: "measurement-1",
				budgetItemId: "leaf-1",
				measuredQuantity: 10,
				measuredValue: 500,
				measuredPercentage: 10,
				accumulatedQuantity: null,
				accumulatedValue: null,
				accumulatedPercentage: null,
				budgetItem: {
					id: "leaf-1",
					index: "1.1.1",
					parentId: "stage-1",
					sortOrder: 3,
					quantity: 100,
					totalCost: 5000,
					description: "Item medido",
				},
			},
		],
	}),
);

const budgetItemFindMany = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [
		{
			id: "root-1",
			index: "1",
			parentId: null,
			sortOrder: 1,
			quantity: 100,
			totalCost: 10000,
			description: "Etapa 1",
		},
		{
			id: "stage-1",
			index: "1.1",
			parentId: "root-1",
			sortOrder: 2,
			quantity: 100,
			totalCost: 7500,
			description: "Sub etapa 1",
		},
		{
			id: "leaf-1",
			identityId: "identity-1",
			index: "1.1.1",
			parentId: "stage-1",
			sortOrder: 3,
			quantity: 100,
			totalCost: 5000,
			description: "Item medido",
		},
		{
			id: "leaf-2",
			index: "1.1.2",
			parentId: "stage-1",
			sortOrder: 4,
			quantity: 50,
			totalCost: 2500,
			description: "Item nao medido",
		},
		{
			id: "other-root",
			index: "2",
			parentId: null,
			sortOrder: 5,
			quantity: 10,
			totalCost: 1000,
			description: "Etapa 2",
		},
	],
);

const budgetVersionFindFirst = mock(async () => ({ id: "version-1" }));
const budgetVersionItemFindMany = mock(async () => [
	{
		id: "version-item-1",
		index: "1.1.1",
		identityId: "identity-1",
		quantity: new Decimal(20),
		unitCost: new Decimal(100),
	},
]);
const budgetItemIdentityFindMany = mock(async () => [
	{ id: "identity-1", index: "1.1.1" },
]);

const measurementItemFindMany = mock<
	() => Promise<Array<Record<string, unknown>>>
>(async () => [
	{
		id: "wmi-1",
		budgetItemId: "leaf-1",
		measuredQuantity: 10,
		measuredValue: 500,
		measuredPercentage: 10,
		accumulatedQuantity: null,
		accumulatedValue: null,
		accumulatedPercentage: null,
		measurement: {
			id: "measurement-1",
			number: 1,
			date: new Date("2026-07-01"),
		},
	},
]);

const measurementFindMany = mock<() => Promise<Array<Record<string, unknown>>>>(
	async () => [
		{
			id: "wm-1",
			workId: "work-1",
			number: 1,
			date: new Date("2026-07-01"),
			title: "Medicao 1",
			discountValue: null,
			retentionValue: null,
			notes: null,
			createdBy: null,
			createdAt: new Date("2026-07-01"),
			updatedAt: new Date("2026-07-01"),
			items: [
				{
					id: "wmi-1",
					measurementId: "wm-1",
					budgetItemId: "leaf-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			],
		},
	],
);

const measurementCount = mock(async () => 1);

const contractMeasurementFindMany = mock(async () => []);
const contractFindMany = mock(async () => []);

const measurementCreate = mock(async () => ({
	id: "measurement-1",
	ownerId: "owner-1",
	workId: "work-1",
	number: 2,
	date: new Date("2026-07-01"),
	title: "Medicao 1",
	discountValue: null,
	retentionValue: null,
	balanceOverride: false,
	evidenceNote: null,
	createdBy: null,
	notes: null,
}));

const measurementUpdate = mock(async () => ({ id: "measurement-1" }));

const workMeasurementItemCreate = mock(async () => ({ id: "wmi-new" }));
const workMeasurementItemUpdate = mock(async () => ({ id: "wmi-1" }));
const workMeasurementItemDelete = mock(async () => ({ id: "wmi-2" }));
const workMeasurementItemCreateMany = mock(async () => ({ count: 1 }));
const workMeasurementItemDeleteMany = mock(async () => ({ count: 0 }));

const measurementTransaction = mock(
	async (fn: (tx: unknown) => Promise<unknown>) =>
		fn({
			constructionWork: { findFirst: workFindFirst },
			workMeasurement: {
				create: measurementCreate,
				update: measurementUpdate,
				findFirst: measurementFindFirst,
			},
			workMeasurementItem: {
				create: workMeasurementItemCreate,
				update: workMeasurementItemUpdate,
				delete: workMeasurementItemDelete,
				createMany: workMeasurementItemCreateMany,
				deleteMany: workMeasurementItemDeleteMany,
			},
			constructionBudgetItem: { findMany: budgetItemFindMany },
		}),
);

function makeStoredMeasurement(
	items: Array<Record<string, unknown>>,
): Record<string, unknown> {
	return {
		id: "measurement-1",
		ownerId: "owner-1",
		workId: "work-1",
		number: 1,
		date: new Date("2026-07-01"),
		title: "Medicao 1",
		discountValue: null,
		retentionValue: null,
		balanceOverride: false,
		evidenceNote: null,
		createdBy: null,
		notes: null,
		createdAt: new Date("2026-07-01"),
		updatedAt: new Date("2026-07-01"),
		items,
	};
}

beforeEach(() => {
	measurementCreate.mockClear();
	measurementUpdate.mockClear();
	workMeasurementItemCreate.mockClear();
	workMeasurementItemUpdate.mockClear();
	workMeasurementItemDelete.mockClear();
	workMeasurementItemCreateMany.mockClear();
	workMeasurementItemDeleteMany.mockClear();
});

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: measurementTransaction,
		constructionWork: { findFirst: workFindFirst },
		workMeasurement: {
			findFirst: measurementFindFirst,
			findMany: measurementFindMany,
			count: measurementCount,
			create: measurementCreate,
			update: measurementUpdate,
		},
		constructionBudgetItem: { findMany: budgetItemFindMany },
		budgetVersion: { findFirst: budgetVersionFindFirst },
		budgetItemIdentity: { findMany: budgetItemIdentityFindMany },
		budgetVersionItem: { findMany: budgetVersionItemFindMany },
		workMeasurementItem: {
			findMany: measurementItemFindMany,
			create: workMeasurementItemCreate,
			update: workMeasurementItemUpdate,
			delete: workMeasurementItemDelete,
			createMany: workMeasurementItemCreateMany,
			deleteMany: workMeasurementItemDeleteMany,
		},
		contractMeasurement: { findMany: contractMeasurementFindMany },
		contract: { findMany: contractFindMany },
	},
}));

function flattenTreeIds(nodes: Array<Record<string, unknown>>): string[] {
	const ids: string[] = [];
	for (const node of nodes) {
		ids.push(String(node.id));
		ids.push(
			...flattenTreeIds(
				(node.children as Array<Record<string, unknown>>) ?? [],
			),
		);
	}
	return ids;
}

function findNode(
	items: Array<Record<string, unknown>>,
	id: string,
): Record<string, unknown> | undefined {
	for (const node of items) {
		if (node.id === id) return node;
		const found = findNode(
			(node.children as Array<Record<string, unknown>>) ?? [],
			id,
		);
		if (found) return found;
	}
	return undefined;
}

describe("work measurement repository", () => {
	it("mantem header, rodape e resumo alinhados na precisao monetaria", async () => {
		measurementFindFirst.mockResolvedValueOnce({
			id: "measurement-1",
			workId: "work-1",
			number: 1,
			date: new Date("2026-07-01"),
			title: "Medicao 1",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date("2026-07-01"),
			updatedAt: new Date("2026-07-01"),
			items: [
				{
					id: "wmi-1",
					measurementId: "measurement-1",
					budgetItemId: "leaf-1",
					measuredQuantity: null,
					measuredValue: 0.105,
					measuredPercentage: null,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			],
		});
		measurementItemFindMany.mockResolvedValueOnce([
			{
				id: "wmi-1",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 0.105,
				measuredPercentage: null,
				accumulatedQuantity: null,
				accumulatedValue: null,
				accumulatedPercentage: null,
				measurement: {
					id: "measurement-1",
					number: 1,
					date: new Date("2026-07-01"),
				},
			},
		]);
		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-1",
		);

		expect(result?.measurement.currentMeasuredValue).toBe(0.11);
		expect(result?.measurement.totalMeasuredValue).toBe(0.11);
		expect(result?.totals.current.measuredValue).toBe(0.11);
		expect(result?.totals.accumulated.measuredValue).toBe(0.11);
		expect(result?.budgetSummary.totalMeasured).toBe(0.11);
	});

	it("resume o ultimo acumulado por item sem somar medicoes historicas", async () => {
		measurementFindMany.mockResolvedValueOnce([
			{
				id: "measurement-2",
				workId: "work-1",
				date: new Date("2026-08-01"),
				items: [
					{
						budgetItemId: "leaf-1",
						accumulatedValue: 300,
						measuredValue: 100,
					},
					{
						budgetItemId: "leaf-2",
						accumulatedValue: 50,
						measuredValue: 50,
					},
				],
			},
			{
				id: "measurement-1",
				workId: "work-1",
				date: new Date("2026-07-01"),
				items: [
					{
						budgetItemId: "leaf-1",
						accumulatedValue: 200,
						measuredValue: 200,
					},
				],
			},
		]);
		const { getWorkMeasurementSummary } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementSummary("owner-1", "work-1");

		expect(result.totalMeasured).toBe(350);
		expect(result.measurementCount).toBe(2);
	});

	it("detail retorna apenas itens da medicao e seus ancestrais (E15)", async () => {
		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-1",
		);

		const ids = flattenTreeIds(result?.items ?? []);
		expect(ids).toEqual(["root-1", "stage-1", "leaf-1"]);
		expect(ids).not.toContain("leaf-2");
		expect(ids).not.toContain("other-root");
	});

	it("detail aplica rollup de totais nos pais por valor monetario e percentual ponderado (E11)", async () => {
		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-1",
		);

		expect(result?.items).toHaveLength(1);
		const root = result?.items[0] as
			| {
					measuredCurrent: {
						quantity: number;
						value: number;
						percentage: number;
					};
					measuredAccumulated: {
						quantity: number;
						value: number;
						percentage: number;
					};
					balanceToMeasure: {
						quantity: number;
						value: number;
						percentage: number;
					};
			  }
			| undefined;
		expect(root?.measuredCurrent).toEqual({
			quantity: 0,
			value: 500,
			percentage: 5,
		});
		expect(root?.measuredAccumulated).toEqual({
			quantity: 0,
			value: 500,
			percentage: 5,
		});
		expect(root?.balanceToMeasure.value).toBe(9500);
		expect(root?.balanceToMeasure.quantity).toBe(0);
		expect(root?.balanceToMeasure.percentage).toBe(95);

		const stage = findNode(result?.items ?? [], "stage-1");
		expect(stage).toBeDefined();
		expect(stage?.measuredCurrent).toEqual({
			quantity: 0,
			value: 500,
			percentage: 500 / 75,
		});
		expect(stage?.measuredAccumulated).toEqual({
			quantity: 0,
			value: 500,
			percentage: 500 / 75,
		});
	});

	it("lista inclui items no DTO de cada medicao (E12)", async () => {
		const { listWorkMeasurements } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await listWorkMeasurements("owner-1", "work-1");

		expect(result.data).toHaveLength(1);
		expect(result.data[0].items).toHaveLength(1);
		expect(result.data[0].items[0]).toMatchObject({
			id: "wmi-1",
			measurementId: "wm-1",
			budgetItemId: "leaf-1",
			measuredQuantity: 10,
			measuredValue: 500,
			measuredPercentage: 10,
		});
		expect(result.data[0].totalMeasuredValue).toBe(500);
	});

	it("acumulado do item usa o ULTIMO acumulado ate a medicao atual, nao a soma (regressao #11)", async () => {
		measurementFindFirst.mockImplementation(async () => ({
			id: "measurement-2",
			workId: "work-1",
			number: 2,
			date: new Date("2026-08-01"),
			title: "Medicao 2",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date("2026-08-01"),
			updatedAt: new Date("2026-08-01"),
			items: [
				{
					id: "wmi-2",
					measurementId: "measurement-2",
					budgetItemId: "leaf-1",
					measuredQuantity: null,
					measuredValue: 10560,
					measuredPercentage: 6,
					accumulatedQuantity: null,
					accumulatedValue: 58080,
					accumulatedPercentage: 33,
					budgetItem: {
						id: "leaf-1",
						index: "1.1",
						parentId: "stage-1",
						sortOrder: 3,
						quantity: 100,
						totalCost: 176000,
						description: "Item 1.1",
					},
				},
			],
		}));
		budgetItemFindMany.mockImplementation(async () => [
			{
				id: "stage-1",
				index: "1",
				parentId: null,
				sortOrder: 1,
				quantity: 100,
				totalCost: 264000,
				description: "Etapa 1",
			},
			{
				id: "leaf-1",
				index: "1.1",
				parentId: "stage-1",
				sortOrder: 2,
				quantity: 100,
				totalCost: 176000,
				description: "Item 1.1",
			},
		]);
		measurementItemFindMany.mockImplementation(async () => [
			{
				id: "wmi-1",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 10560,
				measuredPercentage: 6,
				accumulatedQuantity: null,
				accumulatedValue: 47520,
				accumulatedPercentage: 27,
				measurement: {
					id: "measurement-1",
					number: 1,
					date: new Date("2026-07-01"),
				},
			},
			{
				id: "wmi-2",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 10560,
				measuredPercentage: 6,
				accumulatedQuantity: null,
				accumulatedValue: 58080,
				accumulatedPercentage: 33,
				measurement: {
					id: "measurement-2",
					number: 2,
					date: new Date("2026-08-01"),
				},
			},
			{
				id: "wmi-3",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 10560,
				measuredPercentage: 6,
				accumulatedQuantity: null,
				accumulatedValue: 88000,
				accumulatedPercentage: 50,
				measurement: {
					id: "measurement-3",
					number: 3,
					date: new Date("2026-09-01"),
				},
			},
		]);

		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);
		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-2",
		);

		expect(result?.measurement.totalMeasuredValue).toBe(10560);
		expect(result?.measurement.currentMeasuredValue).toBe(10560);
		expect(result?.measurement.accumulatedMeasuredValue).toBe(58080);

		const leaf = findNode(result?.items ?? [], "leaf-1");
		expect(leaf?.measuredCurrent).toEqual({
			quantity: 0,
			value: 10560,
			percentage: 6,
		});
		expect(leaf?.measuredAccumulated).toEqual({
			quantity: 0,
			value: 58080,
			percentage: 33,
		});
		expect(leaf?.balanceToMeasure).toEqual({
			quantity: 100,
			value: 117920,
			percentage: 67,
		});

		const stage = findNode(result?.items ?? [], "stage-1");
		expect(stage?.measuredCurrent).toEqual({
			quantity: 0,
			value: 10560,
			percentage: 4,
		});
		expect(stage?.measuredAccumulated).toEqual({
			quantity: 0,
			value: 58080,
			percentage: 22,
		});
		expect(
			(stage?.balanceToMeasure as { value: number } | undefined)?.value,
		).toBe(205920);

		expect(result?.totals.current.measuredValue).toBe(10560);
		expect(result?.totals.current.measuredPercentage).toBe(6);
		expect(result?.totals.accumulated.measuredValue).toBe(58080);
		expect(result?.totals.accumulated.measuredPercentage).toBeCloseTo(33);
		expect(result?.totals.balance.value).toBe(117920);
		expect(result?.totals.balance.percentage).toBeCloseTo(67);
		expect(result?.budgetSummary.totalMeasured).toBe(58080);
		expect(result?.budgetSummary.balanceToMeasure).toBe(117920);
	});

	it("quando accumulated e nulo, acumulado deriva da soma de measured* das medicoes elegiveis, sem futuro", async () => {
		measurementFindFirst.mockImplementation(async () => ({
			id: "measurement-2",
			workId: "work-1",
			number: 2,
			date: new Date("2026-08-01"),
			title: "Medicao 2",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date("2026-08-01"),
			updatedAt: new Date("2026-08-01"),
			items: [
				{
					id: "wmi-2",
					measurementId: "measurement-2",
					budgetItemId: "leaf-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
					budgetItem: {
						id: "leaf-1",
						index: "1.1",
						parentId: "stage-1",
						sortOrder: 2,
						quantity: 100,
						totalCost: 5000,
						description: "Item medido",
					},
				},
			],
		}));
		budgetItemFindMany.mockImplementation(async () => [
			{
				id: "stage-1",
				index: "1",
				parentId: null,
				sortOrder: 1,
				quantity: 100,
				totalCost: 7500,
				description: "Etapa 1",
			},
			{
				id: "leaf-1",
				index: "1.1",
				parentId: "stage-1",
				sortOrder: 2,
				quantity: 100,
				totalCost: 5000,
				description: "Item medido",
			},
		]);
		measurementItemFindMany.mockImplementation(async () => [
			{
				id: "wmi-1",
				budgetItemId: "leaf-1",
				measuredQuantity: 5,
				measuredValue: 250,
				measuredPercentage: 5,
				accumulatedQuantity: null,
				accumulatedValue: null,
				accumulatedPercentage: null,
				measurement: {
					id: "measurement-1",
					number: 1,
					date: new Date("2026-07-01"),
				},
			},
			{
				id: "wmi-2",
				budgetItemId: "leaf-1",
				measuredQuantity: 10,
				measuredValue: 500,
				measuredPercentage: 10,
				accumulatedQuantity: null,
				accumulatedValue: null,
				accumulatedPercentage: null,
				measurement: {
					id: "measurement-2",
					number: 2,
					date: new Date("2026-08-01"),
				},
			},
			{
				id: "wmi-3",
				budgetItemId: "leaf-1",
				measuredQuantity: 10,
				measuredValue: 500,
				measuredPercentage: 10,
				accumulatedQuantity: null,
				accumulatedValue: 70400,
				accumulatedPercentage: 40,
				measurement: {
					id: "measurement-3",
					number: 3,
					date: new Date("2026-09-01"),
				},
			},
		]);

		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);
		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-2",
		);

		const leaf = findNode(result?.items ?? [], "leaf-1");
		expect(leaf?.measuredAccumulated).toEqual({
			quantity: 15,
			value: 750,
			percentage: 15,
		});
		expect(result?.totals.accumulated.measuredValue).toBe(750);
		expect(result?.totals.accumulated.measuredPercentage).toBe(15);
	});

	it("empate de data usa number <= number da medicao atual", async () => {
		measurementFindFirst.mockImplementation(async () => ({
			id: "measurement-2",
			workId: "work-1",
			number: 2,
			date: new Date("2026-08-01"),
			title: "Medicao 2",
			discountValue: null,
			retentionValue: null,
			createdBy: null,
			notes: null,
			createdAt: new Date("2026-08-01"),
			updatedAt: new Date("2026-08-01"),
			items: [
				{
					id: "wmi-2",
					measurementId: "measurement-2",
					budgetItemId: "leaf-1",
					measuredQuantity: null,
					measuredValue: 100,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: 300,
					accumulatedPercentage: 30,
					budgetItem: {
						id: "leaf-1",
						index: "1.1",
						parentId: "stage-1",
						sortOrder: 2,
						quantity: 100,
						totalCost: 1000,
						description: "Item",
					},
				},
			],
		}));
		budgetItemFindMany.mockImplementation(async () => [
			{
				id: "stage-1",
				index: "1",
				parentId: null,
				sortOrder: 1,
				quantity: 100,
				totalCost: 1000,
				description: "Etapa 1",
			},
			{
				id: "leaf-1",
				index: "1.1",
				parentId: "stage-1",
				sortOrder: 2,
				quantity: 100,
				totalCost: 1000,
				description: "Item",
			},
		]);
		measurementItemFindMany.mockImplementation(async () => [
			{
				id: "wmi-3",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 100,
				measuredPercentage: 10,
				accumulatedQuantity: null,
				accumulatedValue: 500,
				accumulatedPercentage: 50,
				measurement: {
					id: "measurement-3",
					number: 3,
					date: new Date("2026-08-01"),
				},
			},
			{
				id: "wmi-1",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 100,
				measuredPercentage: 10,
				accumulatedQuantity: null,
				accumulatedValue: 200,
				accumulatedPercentage: 20,
				measurement: {
					id: "measurement-1",
					number: 1,
					date: new Date("2026-08-01"),
				},
			},
			{
				id: "wmi-2",
				budgetItemId: "leaf-1",
				measuredQuantity: null,
				measuredValue: 100,
				measuredPercentage: 10,
				accumulatedQuantity: null,
				accumulatedValue: 300,
				accumulatedPercentage: 30,
				measurement: {
					id: "measurement-2",
					number: 2,
					date: new Date("2026-08-01"),
				},
			},
		]);

		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);
		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-2",
		);

		const leaf = findNode(result?.items ?? [], "leaf-1");
		expect(leaf?.measuredAccumulated).toEqual({
			quantity: 0,
			value: 300,
			percentage: 30,
		});
		expect(result?.totals.accumulated.measuredValue).toBe(300);
		expect(result?.totals.accumulated.measuredPercentage).toBe(30);
	});

	it("getBudgetItemTotals retorna mapa budgetItemId -> totalCost apenas para itens validos da obra", async () => {
		budgetItemFindMany.mockImplementation(async () => [
			{ id: "leaf-1", totalCost: 5000 },
			{ id: "leaf-2", totalCost: 2500 },
		]);
		const { getBudgetItemTotals } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getBudgetItemTotals("owner-1", "work-1", [
			"leaf-1",
			"leaf-2",
			"fora-da-obra",
		]);

		expect(result).toEqual({ "leaf-1": 5000, "leaf-2": 2500 });
	});

	it("getBudgetItemConsumption usa o ULTIMO accumulatedValue como acumulado; sem accumulated usa soma de measuredValue", async () => {
		measurementItemFindMany.mockImplementation(async () => [
			{
				budgetItemId: "leaf-1",
				accumulatedValue: 3000,
				measuredValue: 500,
				measurement: { id: "m-1", number: 1, date: new Date("2026-07-01") },
			},
			{
				budgetItemId: "leaf-1",
				accumulatedValue: null,
				measuredValue: 400,
				measurement: { id: "m-2", number: 2, date: new Date("2026-08-01") },
			},
			{
				budgetItemId: "leaf-2",
				accumulatedValue: null,
				measuredValue: 250,
				measurement: { id: "m-1", number: 1, date: new Date("2026-07-01") },
			},
		]);
		const { getBudgetItemConsumption } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getBudgetItemConsumption("owner-1", "work-1", [
			"leaf-1",
			"leaf-2",
			"fora-da-obra",
		]);

		expect(result).toEqual({ "leaf-1": 900, "leaf-2": 250 });
	});

	it("getBudgetItemConsumption para cliente acumulado usa o ULTIMO accumulatedValue (running total), nao a soma", async () => {
		measurementItemFindMany.mockImplementation(async () => [
			{
				budgetItemId: "leaf-1",
				accumulatedValue: 300,
				measuredValue: 300,
				measurement: { id: "m-1", number: 1, date: new Date("2026-07-01") },
			},
			{
				budgetItemId: "leaf-1",
				accumulatedValue: 600,
				measuredValue: 300,
				measurement: { id: "m-2", number: 2, date: new Date("2026-08-01") },
			},
			{
				budgetItemId: "leaf-1",
				accumulatedValue: 900,
				measuredValue: 300,
				measurement: { id: "m-3", number: 3, date: new Date("2026-09-01") },
			},
		]);
		const { getBudgetItemConsumption } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getBudgetItemConsumption("owner-1", "work-1", [
			"leaf-1",
		]);

		expect(result).toEqual({ "leaf-1": 900 });
	});

	it("resolves the active version only inside the owner scope", async () => {
		const { getBudgetItemReferences } = await import(
			"../../../../src/modules/construction-planning/budget-control/budget-control.repository"
		);

		await getBudgetItemReferences("owner-1", "work-1", ["leaf-1"]);

		expect(budgetVersionFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: "owner-1", workId: "work-1", isActive: true },
			}),
		);
	});

	it("aceita o id do item da versao ativa como referencia operacional", async () => {
		budgetItemFindMany.mockImplementation(async () => [
			{ id: "leaf-1", index: "1.1.1", identityId: "legacy-identity" },
		]);
		const { getBudgetItemReferences } = await import(
			"../../../../src/modules/construction-planning/budget-control/budget-control.repository"
		);

		const result = await getBudgetItemReferences("owner-1", "work-1", [
			"version-item-1",
		]);

		expect(result.missing).toEqual([]);
		expect(result.found[0]).toMatchObject({
			budgetItemId: "version-item-1",
			operationalBudgetItemId: "leaf-1",
			versionItemId: "version-item-1",
			identityId: "identity-1",
			index: "1.1.1",
		});
	});

	it("returns the latest accumulated quantity and falls back to legacy measured quantities", async () => {
		measurementItemFindMany.mockImplementation(async () => [
			{
				budgetItemId: "leaf-1",
				measuredQuantity: new Decimal(4),
				accumulatedQuantity: new Decimal(9),
				measurement: {
					date: new Date("2026-08-01"),
					number: 2,
				},
			},
			{
				budgetItemId: "leaf-1",
				measuredQuantity: new Decimal(3),
				accumulatedQuantity: new Decimal(7),
				measurement: {
					date: new Date("2026-07-01"),
					number: 1,
				},
			},
			{
				budgetItemId: "leaf-2",
				measuredQuantity: new Decimal(2),
				accumulatedQuantity: null,
				measurement: {
					date: new Date("2026-07-01"),
					number: 1,
				},
			},
			{
				budgetItemId: "leaf-2",
				measuredQuantity: new Decimal(3),
				accumulatedQuantity: null,
				measurement: {
					date: new Date("2026-08-01"),
					number: 2,
				},
			},
		]);
		const { getLatestWorkMeasurementQuantities } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getLatestWorkMeasurementQuantities(
			"owner-1",
			"work-1",
			["leaf-1", "leaf-2"],
		);

		expect(result["leaf-1"]).toEqual(new Decimal(9));
		expect(result["leaf-2"]).toEqual(new Decimal(5));
	});

	it("createWorkMeasurement com tx reutiliza o cliente transacional sem aninhar transacao", async () => {
		measurementTransaction.mockClear();
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([]),
		);
		const { createWorkMeasurement } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await createWorkMeasurement(
			"owner-1",
			"work-1",
			{
				date: "2026-07-01",
				title: "Medicao 1",
				balanceOverride: false,
				items: [
					{
						budgetItemId: "leaf-1",
						measuredQuantity: 5,
						measuredValue: 500,
						measuredPercentage: 10,
						accumulatedQuantity: 5,
						accumulatedValue: 500,
						accumulatedPercentage: 10,
					},
				],
			},
			{
				workMeasurement: {
					create: measurementCreate,
					findFirst: measurementFindFirst,
				},
				workMeasurementItem: { createMany: workMeasurementItemCreateMany },
				constructionBudgetItem: { findMany: budgetItemFindMany },
			} as never,
		);

		expect(measurementTransaction).not.toHaveBeenCalled();
		expect(measurementCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({ title: "Medicao 1" }),
		});
		expect(result?.id).toBe("measurement-1");
	});

	it("createWorkMeasurement persiste balanceOverride e evidenceNote", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([]),
		);
		budgetItemFindMany.mockImplementation(async () => [
			{ id: "leaf-1", totalCost: 5000 },
		]);
		const { createWorkMeasurement } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await createWorkMeasurement("owner-1", "work-1", {
			date: "2026-07-01",
			title: "Medicao 1",
			balanceOverride: true,
			evidenceNote: "Aprovado por diretoria",
			items: [
				{
					budgetItemId: "leaf-1",
					measuredQuantity: 5,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: 60,
					accumulatedValue: 6000,
					accumulatedPercentage: 120,
				},
			],
		});

		expect(measurementCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				balanceOverride: true,
				evidenceNote: "Aprovado por diretoria",
			}),
		});
		expect(workMeasurementItemCreateMany).toHaveBeenCalled();
		expect(result?.id).toBe("measurement-1");
	});

	it("updateWorkMeasurement diff-based preserva ids de itens nao alterados (sem deleteMany+createMany)", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([
				{
					id: "wmi-1",
					measurementId: "measurement-1",
					budgetItemId: "leaf-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
				{
					id: "wmi-2",
					measurementId: "measurement-1",
					budgetItemId: "leaf-2",
					measuredQuantity: 5,
					measuredValue: 250,
					measuredPercentage: 5,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			]),
		);
		budgetItemFindMany.mockImplementation(async () => [
			{ id: "leaf-1" },
			{ id: "leaf-2" },
			{ id: "other-root" },
		]);
		const { updateWorkMeasurement } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await updateWorkMeasurement(
			"owner-1",
			"work-1",
			"measurement-1",
			{
				title: "Atualizada",
				balanceOverride: false,
				items: [
					{
						budgetItemId: "leaf-1",
						measuredQuantity: 6,
						measuredValue: 600,
						measuredPercentage: 12,
						accumulatedQuantity: 6,
						accumulatedValue: 600,
						accumulatedPercentage: 12,
					},
					{
						budgetItemId: "other-root",
						measuredQuantity: 1,
						measuredValue: 100,
						measuredPercentage: 10,
						accumulatedQuantity: 1,
						accumulatedValue: 100,
						accumulatedPercentage: 10,
					},
				],
			},
		);

		expect(result?.id).toBe("measurement-1");
		expect(workMeasurementItemUpdate).toHaveBeenCalledWith({
			where: { id: "wmi-1" },
			data: expect.objectContaining({
				budgetItemId: "leaf-1",
				measuredValue: 600,
			}),
		});
		expect(workMeasurementItemCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				measurementId: "measurement-1",
				budgetItemId: "other-root",
				measuredValue: 100,
			}),
		});
		expect(workMeasurementItemDelete).toHaveBeenCalledWith({
			where: { id: "wmi-2" },
		});
		expect(workMeasurementItemDeleteMany).not.toHaveBeenCalled();
		expect(workMeasurementItemCreateMany).not.toHaveBeenCalled();
	});

	it("updateWorkMeasurement revalida budgetItemId pertence a obra (422 INVALID_BUDGET_ITEM)", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([
				{
					id: "wmi-1",
					measurementId: "measurement-1",
					budgetItemId: "leaf-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			]),
		);
		budgetItemFindMany.mockImplementation(async () => []);
		const { updateWorkMeasurement } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const promise = updateWorkMeasurement(
			"owner-1",
			"work-1",
			"measurement-1",
			{
				balanceOverride: false,
				items: [
					{
						budgetItemId: "fora-da-obra",
						measuredQuantity: 1,
						measuredValue: 100,
						measuredPercentage: 10,
						accumulatedQuantity: 1,
						accumulatedValue: 100,
						accumulatedPercentage: 10,
					},
				],
			},
		);

		await expect(promise).rejects.toMatchObject({
			code: "INVALID_BUDGET_ITEM",
			status: 422,
		});
		expect(measurementUpdate).not.toHaveBeenCalled();
		expect(workMeasurementItemDeleteMany).not.toHaveBeenCalled();
		expect(workMeasurementItemCreateMany).not.toHaveBeenCalled();
	});

	it("updateWorkMeasurement sem items nao toca itens existentes", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([
				{
					id: "wmi-1",
					measurementId: "measurement-1",
					budgetItemId: "leaf-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			]),
		);
		const { updateWorkMeasurement } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await updateWorkMeasurement(
			"owner-1",
			"work-1",
			"measurement-1",
			{
				title: "Somente titulo",
				balanceOverride: false,
			},
		);

		expect(
			(result?.items as Array<Record<string, unknown>>)?.map((i) => i.id),
		).toEqual(["wmi-1"]);
		expect(workMeasurementItemUpdate).not.toHaveBeenCalled();
		expect(workMeasurementItemDelete).not.toHaveBeenCalled();
		expect(workMeasurementItemDeleteMany).not.toHaveBeenCalled();
		expect(workMeasurementItemCreateMany).not.toHaveBeenCalled();
	});
});

describe("getWorkMeasurementMapDetail escala", () => {
	it("retorna percentuais do mapa em pontos (0-100) nas folhas", async () => {
		budgetItemFindMany.mockImplementation(async () => [
			{
				id: "root-1",
				index: "1",
				parentId: null,
				sortOrder: 1,
				quantity: 100,
				totalCost: 10000,
				description: "Etapa 1",
			},
			{
				id: "stage-1",
				index: "1.1",
				parentId: "root-1",
				sortOrder: 2,
				quantity: 100,
				totalCost: 7500,
				description: "Sub etapa 1",
			},
			{
				id: "leaf-1",
				index: "1.1.1",
				parentId: "stage-1",
				sortOrder: 3,
				quantity: 100,
				totalCost: 5000,
				description: "Item medido",
			},
		]);
		measurementFindMany.mockImplementation(async () => [
			{
				id: "wm-1",
				workId: "work-1",
				number: 1,
				date: new Date("2026-07-01"),
				title: "Medicao 1",
				discountValue: null,
				retentionValue: null,
				notes: null,
				createdBy: null,
				createdAt: new Date("2026-07-01"),
				updatedAt: new Date("2026-07-01"),
				items: [
					{
						id: "wmi-1",
						measurementId: "wm-1",
						budgetItemId: "leaf-1",
						measuredQuantity: 10,
						measuredValue: 500,
						measuredPercentage: 10,
						accumulatedQuantity: null,
						accumulatedValue: null,
						accumulatedPercentage: null,
					},
				],
			},
		]);

		const { getWorkMeasurementMapDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementMapDetail("owner-1", "work-1");

		const leaf = findNode(
			result?.items as unknown as Array<Record<string, unknown>>,
			"leaf-1",
		);
		expect(leaf?.measuredCurrent).toMatchObject({
			value: 500,
			percentage: 10,
		});
		expect(leaf?.balanceToMeasure).toMatchObject({ percentage: 90 });

		const stage = findNode(
			result?.items as unknown as Array<Record<string, unknown>>,
			"stage-1",
		);
		expect(stage?.measuredCurrent).toMatchObject({
			percentage: (500 / 7500) * 100,
		});
	});
});

describe("work measurement repository creator names", () => {
	const userFindMany = mock(async () => [
		{ id: "user-1", name: "Fulano da Silva" },
	]);

	beforeEach(() => {
		userFindMany.mockClear();
	});

	mock.module("../../../../src/lib/prisma", () => ({
		prisma: {
			$transaction: measurementTransaction,
			constructionWork: { findFirst: workFindFirst },
			user: { findMany: userFindMany },
			workMeasurement: {
				findFirst: measurementFindFirst,
				findMany: measurementFindMany,
				count: measurementCount,
				create: measurementCreate,
				update: measurementUpdate,
			},
			constructionBudgetItem: { findMany: budgetItemFindMany },
			budgetVersion: { findFirst: budgetVersionFindFirst },
			budgetItemIdentity: { findMany: budgetItemIdentityFindMany },
			budgetVersionItem: { findMany: budgetVersionItemFindMany },
			workMeasurementItem: {
				findMany: measurementItemFindMany,
				create: workMeasurementItemCreate,
				update: workMeasurementItemUpdate,
				delete: workMeasurementItemDelete,
				createMany: workMeasurementItemCreateMany,
				deleteMany: workMeasurementItemDeleteMany,
			},
			contractMeasurement: { findMany: contractMeasurementFindMany },
			contract: { findMany: contractFindMany },
		},
	}));

	it("listWorkMeasurements expoe createdByName resolvido por lote", async () => {
		measurementFindMany.mockResolvedValueOnce([
			{
				id: "wm-1",
				workId: "work-1",
				number: 1,
				date: new Date("2026-07-01"),
				title: "Medicao 1",
				discountValue: null,
				retentionValue: null,
				notes: null,
				createdBy: "user-1",
				createdAt: new Date("2026-07-01"),
				updatedAt: new Date("2026-07-01"),
				items: [],
			},
			{
				id: "wm-2",
				workId: "work-1",
				number: 2,
				date: new Date("2026-07-02"),
				title: "Medicao 2",
				discountValue: null,
				retentionValue: null,
				notes: null,
				createdBy: null,
				createdAt: new Date("2026-07-02"),
				updatedAt: new Date("2026-07-02"),
				items: [],
			},
		]);
		const { listWorkMeasurements } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await listWorkMeasurements("owner-1", "work-1");

		expect(result.data[0]).toMatchObject({
			id: "wm-1",
			createdBy: "user-1",
			createdByName: "Fulano da Silva",
		});
		expect(result.data[1]).toMatchObject({
			id: "wm-2",
			createdBy: null,
			createdByName: null,
		});
		expect(userFindMany).toHaveBeenCalledWith({
			where: { id: { in: ["user-1"] } },
			select: { id: true, name: true },
		});
	});

	it("detail expoe createdByName sem expor resolucao para criador ausente", async () => {
		measurementFindFirst.mockResolvedValueOnce({
			id: "measurement-1",
			workId: "work-1",
			number: 1,
			date: new Date("2026-07-01"),
			title: "Medicao 1",
			discountValue: null,
			retentionValue: null,
			createdBy: "user-1",
			notes: null,
			createdAt: new Date("2026-07-01"),
			updatedAt: new Date("2026-07-01"),
			items: [
				{
					id: "wmi-1",
					measurementId: "measurement-1",
					budgetItemId: "leaf-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
					budgetItem: {
						id: "leaf-1",
						index: "1.1.1",
						parentId: "stage-1",
						sortOrder: 3,
						quantity: 100,
						totalCost: 5000,
						description: "Item medido",
					},
				},
			],
		});
		const { getWorkMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementDetail(
			"owner-1",
			"work-1",
			"measurement-1",
		);

		expect(result?.measurement.createdByName).toBe("Fulano da Silva");
	});
});

describe("work measurement map without contracts", () => {
	it("map nao consulta contratos nem expoe resumo de contratos", async () => {
		contractFindMany.mockClear();
		contractMeasurementFindMany.mockClear();
		const { getWorkMeasurementMapDetail } = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);

		const result = await getWorkMeasurementMapDetail("owner-1", "work-1");

		expect(result).not.toHaveProperty("contracts");
		expect(result).not.toHaveProperty("contractMeasurements");
		expect(contractFindMany).not.toHaveBeenCalled();
		expect(contractMeasurementFindMany).not.toHaveBeenCalled();
		expect(result).toHaveProperty("items");
		expect(result).toHaveProperty("workMeasurements");
	});
});
