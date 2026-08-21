import { describe, expect, it, mock } from "bun:test";
import {
	type DependencyContext,
	type ExistingEntityLookup,
	resolveActualCostDependencies,
	resolveBaselineDependencies,
	resolveItensDependencies,
	resolveMeasurementDependencies,
	resolveReplanningDependencies,
} from "../../../../../src/modules/construction-planning/imports/dependency-resolver";
import {
	ancestorIndexesOf,
	closestAncestorIndex,
} from "../../../../../src/modules/construction-planning/imports/index-helpers";
import type {
	NormalizedActualCost,
	NormalizedBaselineSchedule,
	NormalizedBudgetItem,
	NormalizedMeasurement,
	NormalizedScheduleRevision,
} from "../../../../../src/modules/construction-planning/imports/normalized-types";
import type { ImportValidationError } from "../../../../../src/modules/construction-planning/types";

const CONTEXT: DependencyContext = { ownerId: "owner-1", workId: "work-1" };

function makeItem(rowNumber: number, index: string): NormalizedBudgetItem {
	return {
		rowNumber,
		index,
		parentIndex: null,
		type: "ITEM",
		description: `Item ${index}`,
		unit: "un",
		quantity: 1,
		laborUnitCost: 0,
		materialUnitCost: 0,
		equipmentUnitCost: 0,
		otherUnitCost: 0,
		unitCostTotal: 0,
		totalBudget: 0,
		unitCost: 0,
		totalCost: 0,
		plannedStart: null,
		plannedEnd: null,
		actualStart: null,
		actualEnd: null,
		completionPercentage: 0,
		providedStatus: null,
		computedStatus: "NOT_STARTED",
		sortOrder: 1,
	};
}

function makeBaseline(
	rowNumber: number,
	index: string,
): NormalizedBaselineSchedule {
	return {
		rowNumber,
		index,
		plannedStart: null,
		plannedEnd: null,
		plannedWeight: null,
	};
}

function makeRevision(
	rowNumber: number,
	index: string,
): NormalizedScheduleRevision {
	return {
		rowNumber,
		index,
		version: "R1",
		replannedStart: null,
		replannedEnd: null,
		revisionDate: null,
		reason: null,
	};
}

function makeMeasurement(
	rowNumber: number,
	index: string,
): NormalizedMeasurement {
	return {
		rowNumber,
		index,
		measurementDate: new Date("2026-01-15"),
		measuredPercentageAccumulated: 0.5,
		measuredQuantityAccumulated: 5,
		notes: null,
	};
}

function makeActualCost(
	rowNumber: number,
	budgetIndex: string | null,
): NormalizedActualCost {
	return {
		rowNumber,
		costDate: new Date("2026-01-20"),
		budgetIndex,
		category: "MATERIAL",
		description: "NF",
		amount: 100,
		costType: "CURRENT",
		sourceDocument: null,
		appropriationStatus: budgetIndex ? "APPROPRIATED" : "UNAPPROPRIATED",
		supplierName: null,
		costGroup: null,
		paymentStatus: "OPEN",
		competenceDate: null,
		dueDate: null,
		paymentDate: null,
		documentNumber: null,
	};
}

function makeLookup(
	existingBudgetIndexes: string[] = [],
	existingScheduleIndexes: string[] = [],
): {
	lookup: ExistingEntityLookup;
	budgetCalls: string[];
	scheduleCalls: string[];
} {
	const budgetCalls: string[] = [];
	const scheduleCalls: string[] = [];
	const lookup: ExistingEntityLookup = {
		hasBudgetIndexes: mock(
			async (_ctx: DependencyContext, indexes: string[]) => {
				budgetCalls.push(...indexes);
				return new Set(
					indexes.filter((index) => existingBudgetIndexes.includes(index)),
				);
			},
		),
		hasScheduleIndexes: mock(
			async (_ctx: DependencyContext, indexes: string[]) => {
				scheduleCalls.push(...indexes);
				return new Set(
					indexes.filter((index) => existingScheduleIndexes.includes(index)),
				);
			},
		),
	};
	return { lookup, budgetCalls, scheduleCalls };
}

async function resolveItensPerLine(
	items: NormalizedBudgetItem[],
	inFileIndexes: Set<string> | null,
	context: DependencyContext,
	existing: Set<string>,
	errors: ImportValidationError[],
): Promise<NormalizedBudgetItem[]> {
	const acceptedRowNumbers = new Set<number>();
	for (const row of items) {
		const index = row.index;
		if (!index) {
			acceptedRowNumbers.add(row.rowNumber);
			continue;
		}
		const boundInFile =
			inFileIndexes !== null &&
			closestAncestorIndex(index, inFileIndexes) !== null;
		if (boundInFile) {
			acceptedRowNumbers.add(row.rowNumber);
			continue;
		}
		let boundExisting = false;
		if (context.workId !== null) {
			for (const candidate of [index, ...ancestorIndexesOf(index)]) {
				if (existing.has(candidate)) {
					boundExisting = true;
					break;
				}
			}
		}
		if (boundExisting) {
			acceptedRowNumbers.add(row.rowNumber);
			continue;
		}
		errors.push({
			sheet: "Itens do Orcamento",
			row: row.rowNumber,
			field: "Indice",
			code: "MISSING_BUDGET_DEPENDENCY",
			message: `Indice ${index} nao possui orcamento pai disponivel`,
			dependency: index,
		});
	}
	return items.filter((row) => acceptedRowNumbers.has(row.rowNumber));
}

describe("resolveItensDependencies", () => {
	it("binds item rows to budget indexes present in the file via ancestor prefix", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup();
		const items = [
			makeItem(2, "1.1"),
			makeItem(3, "1.1.1"),
			makeItem(4, "2.1"),
		];

		const accepted = await resolveItensDependencies(
			items,
			new Set(["1", "2"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(3);
		expect(errors).toEqual([]);
		expect(budgetCalls).toEqual([]);
	});

	it("falls back to an existing work budget when the file has no Orcamento sheet", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup(["1.1"]);
		const items = [makeItem(2, "1.1"), makeItem(3, "2.1")];

		const accepted = await resolveItensDependencies(
			items,
			null,
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted.map((row) => row.rowNumber)).toEqual([2]);
		expect(errors).toEqual([
			{
				sheet: "Itens do Orcamento",
				row: 3,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				message: "Indice 2.1 nao possui orcamento pai disponivel",
				dependency: "2.1",
			},
		]);
	});

	it("rejects only the dependent rows when neither the file nor the work has a budget", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup([]);
		const items = [makeItem(2, "1.1"), makeItem(3, "2.1")];

		const accepted = await resolveItensDependencies(
			items,
			null,
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toEqual([]);
		expect(errors).toHaveLength(2);
		expect(errors[0]).toEqual({
			sheet: "Itens do Orcamento",
			row: 2,
			field: "Indice",
			code: "MISSING_BUDGET_DEPENDENCY",
			message: "Indice 1.1 nao possui orcamento pai disponivel",
			dependency: "1.1",
		});
		expect(errors[1].row).toBe(3);
	});

	it("rejects rows when there is no work context to look up existing entities", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup(["1.1"]);
		const items = [makeItem(2, "1.1")];

		const accepted = await resolveItensDependencies(
			items,
			null,
			{ ownerId: "owner-1", workId: null },
			lookup,
			errors,
		);

		expect(accepted).toEqual([]);
		expect(budgetCalls).toEqual([]);
		expect(errors).toHaveLength(1);
	});
});

describe("resolveBaselineDependencies", () => {
	it("keeps baseline rows whose index exists in the in-file budget", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup();
		const rows = [
			makeBaseline(2, "1.1"),
			makeBaseline(3, "1.1.1"),
			makeBaseline(4, "2"),
		];

		const accepted = await resolveBaselineDependencies(
			rows,
			new Set(["1", "1.1", "2"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(3);
		expect(errors).toEqual([]);
		expect(budgetCalls).toEqual([]);
	});

	it("falls back to existing budget items and rejects only rows without a parent", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup(["1.1"]);
		const rows = [makeBaseline(2, "1.1"), makeBaseline(3, "9.9")];

		const accepted = await resolveBaselineDependencies(
			rows,
			null,
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted.map((row) => row.rowNumber)).toEqual([2]);
		expect(errors).toEqual([
			{
				sheet: "Cronograma Original",
				row: 3,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				message: "Indice 9.9 nao possui orcamento pai disponivel",
				dependency: "9.9",
			},
		]);
	});
});

describe("resolveReplanningDependencies", () => {
	it("keeps revision rows whose index exists in the in-file Cronograma rows", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, scheduleCalls } = makeLookup();
		const rows = [makeRevision(2, "1.1")];

		const accepted = await resolveReplanningDependencies(
			rows,
			new Set(["1.1"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(1);
		expect(errors).toEqual([]);
		expect(scheduleCalls).toEqual([]);
	});

	it("keeps revision rows bound to an ancestor in the in-file Cronograma rows", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, scheduleCalls } = makeLookup();
		const rows = [makeRevision(2, "1.1.1")];

		const accepted = await resolveReplanningDependencies(
			rows,
			new Set(["1", "1.1"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(1);
		expect(errors).toEqual([]);
		expect(scheduleCalls).toEqual([]);
	});

	it("falls back to existing valid planning and rejects only dependent rows", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup([], ["1.1"]);
		const rows = [makeRevision(2, "1.1"), makeRevision(3, "9.9")];

		const accepted = await resolveReplanningDependencies(
			rows,
			null,
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted.map((row) => row.rowNumber)).toEqual([2]);
		expect(errors).toEqual([
			{
				sheet: "Replanejamento",
				row: 3,
				field: "Indice",
				code: "MISSING_SCHEDULE_DEPENDENCY",
				message: "Indice 9.9 nao possui cronograma pai disponivel",
				dependency: "9.9",
			},
		]);
	});
});

describe("resolveMeasurementDependencies", () => {
	it("keeps measurement rows whose index exists in the in-file budget", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup();
		const rows = [makeMeasurement(2, "1.1"), makeMeasurement(3, "1.1.1")];

		const accepted = await resolveMeasurementDependencies(
			rows,
			new Set(["1", "1.1"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(2);
		expect(errors).toEqual([]);
		expect(budgetCalls).toEqual([]);
	});

	it("falls back to existing work budget items and rejects only rows without a parent", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup(["1.1"]);
		const rows = [makeMeasurement(2, "1.1"), makeMeasurement(3, "9.9")];

		const accepted = await resolveMeasurementDependencies(
			rows,
			null,
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted.map((row) => row.rowNumber)).toEqual([2]);
		expect(errors).toEqual([
			{
				sheet: "Medicoes",
				row: 3,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				message: "Indice 9.9 nao possui orcamento pai disponivel",
				dependency: "9.9",
			},
		]);
	});

	it("rejects measurement rows when there is no work context to look up existing entities", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup(["1.1"]);
		const rows = [makeMeasurement(2, "1.1")];

		const accepted = await resolveMeasurementDependencies(
			rows,
			null,
			{ ownerId: "owner-1", workId: null },
			lookup,
			errors,
		);

		expect(accepted).toEqual([]);
		expect(budgetCalls).toEqual([]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toEqual(
			expect.objectContaining({
				sheet: "Medicoes",
				row: 2,
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "1.1",
			}),
		);
	});
});

describe("resolveActualCostDependencies", () => {
	it("keeps rows bound to an in-file budget index and unappropriated rows without an index", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup();
		const rows = [
			makeActualCost(2, "1.1"),
			makeActualCost(3, "1.1.1"),
			makeActualCost(4, null),
		];

		const accepted = await resolveActualCostDependencies(
			rows,
			new Set(["1", "1.1"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(3);
		expect(errors).toEqual([]);
		expect(budgetCalls).toEqual([]);
	});

	it("falls back to existing work budget items and rejects only rows without a parent", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup(["1.1"]);
		const rows = [
			makeActualCost(2, "1.1"),
			makeActualCost(3, "9.9"),
			makeActualCost(4, null),
		];

		const accepted = await resolveActualCostDependencies(
			rows,
			null,
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted.map((row) => row.rowNumber)).toEqual([2, 4]);
		expect(errors).toEqual([
			{
				sheet: "Custos Realizados",
				row: 3,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				message: "Indice 9.9 nao possui orcamento pai disponivel",
				dependency: "9.9",
			},
		]);
	});
});

describe("batched dependency lookups", () => {
	it("queries the work budget once per sheet with deduped candidate indexes", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup(["1.1"]);
		const items = [makeItem(2, "1.1"), makeItem(3, "9.9"), makeItem(4, "1.1")];

		await resolveItensDependencies(items, null, CONTEXT, lookup, errors);

		const hasBudgetIndexes = lookup.hasBudgetIndexes as ReturnType<typeof mock>;
		expect(hasBudgetIndexes).toHaveBeenCalledTimes(1);
		const requested = hasBudgetIndexes.mock.calls[0][1] as string[];
		expect(requested).toEqual(["1.1", "1", "9.9", "9"]);
	});

	it("queries the work schedule once per sheet with deduped candidate indexes", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup } = makeLookup([], ["1.1"]);
		const rows = [
			makeRevision(2, "1.1"),
			makeRevision(3, "1.2"),
			makeRevision(4, "1.1"),
		];

		await resolveReplanningDependencies(rows, null, CONTEXT, lookup, errors);

		const hasScheduleIndexes = lookup.hasScheduleIndexes as ReturnType<
			typeof mock
		>;
		expect(hasScheduleIndexes).toHaveBeenCalledTimes(1);
		const requested = hasScheduleIndexes.mock.calls[0][1] as string[];
		expect(requested).toEqual(["1.1", "1", "1.2"]);
	});

	it("preserves the per-line results: same accepted rows, same errors in order", async () => {
		const existing = new Set(["1.1", "5"]);
		const items = [
			makeItem(2, "1.1.1"),
			makeItem(3, "9.9"),
			makeItem(4, "2.1"),
			makeItem(5, "5.5"),
			makeItem(6, "1.1"),
		];

		const batchErrors: ImportValidationError[] = [];
		const { lookup } = makeLookup(["1.1", "5"]);
		const batchAccepted = await resolveItensDependencies(
			items,
			null,
			CONTEXT,
			lookup,
			batchErrors,
		);

		const lineErrors: ImportValidationError[] = [];
		const lineAccepted = await resolveItensPerLine(
			items,
			null,
			CONTEXT,
			existing,
			lineErrors,
		);

		expect(batchAccepted.map((row) => row.rowNumber)).toEqual(
			lineAccepted.map((row) => row.rowNumber),
		);
		expect(batchErrors).toEqual(lineErrors);
	});

	it("skips the work lookup entirely when every row binds in-file", async () => {
		const errors: ImportValidationError[] = [];
		const { lookup, budgetCalls } = makeLookup();
		const items = [makeItem(2, "1.1"), makeItem(3, "1.1.1")];

		const accepted = await resolveItensDependencies(
			items,
			new Set(["1", "1.1"]),
			CONTEXT,
			lookup,
			errors,
		);

		expect(accepted).toHaveLength(2);
		expect(errors).toEqual([]);
		expect(budgetCalls).toEqual([]);
	});
});
