import type { ImportValidationError } from "../types";
import * as importRepository from "./import-repository";
import { ancestorIndexesOf, closestAncestorIndex } from "./index-helpers";
import type {
	NormalizedActualCost,
	NormalizedBaselineSchedule,
	NormalizedBudgetItem,
	NormalizedMeasurement,
	NormalizedScheduleRevision,
} from "./normalized-types";

export type DependencyContext = {
	ownerId: string;
	workId: string | null;
};

export interface ExistingEntityLookup {
	hasBudgetIndexes(
		context: DependencyContext,
		indexes: string[],
	): Promise<Set<string>>;
	hasScheduleIndexes(
		context: DependencyContext,
		indexes: string[],
	): Promise<Set<string>>;
}

export type DependencyRow = {
	sheet: string;
	rowNumber: number;
	index: string | null;
};

type DependencyRule = {
	code: string;
	messageFor: (index: string) => string;
	candidatesFor: (index: string) => string[];
	findExisting: (
		context: DependencyContext,
		indexes: string[],
	) => Promise<Set<string>>;
};

async function bindDependencyRows(
	rows: DependencyRow[],
	inFileIndexes: Set<string> | null,
	context: DependencyContext,
	errors: ImportValidationError[],
	rule: DependencyRule,
): Promise<DependencyRow[]> {
	const accepted: DependencyRow[] = [];
	const pending: { row: DependencyRow; index: string; candidates: string[] }[] =
		[];

	for (const row of rows) {
		const index = row.index;
		if (!index) {
			accepted.push(row);
			continue;
		}

		const candidates = rule.candidatesFor(index);
		const boundInFile =
			inFileIndexes !== null &&
			closestAncestorIndex(index, inFileIndexes) !== null;
		if (boundInFile) {
			accepted.push(row);
			continue;
		}

		pending.push({ row, index, candidates });
	}

	const existing = new Set<string>();
	if (pending.length > 0 && context.workId !== null) {
		const indexes = [...new Set(pending.flatMap((p) => p.candidates))];
		for (const index of await rule.findExisting(context, indexes)) {
			existing.add(index);
		}
	}

	for (const { row, index, candidates } of pending) {
		const boundExisting = candidates.some((candidate) =>
			existing.has(candidate),
		);
		if (boundExisting) {
			accepted.push(row);
			continue;
		}

		errors.push({
			sheet: row.sheet,
			row: row.rowNumber,
			field: "Indice",
			code: rule.code,
			message: rule.messageFor(index),
			dependency: index,
		});
	}

	return accepted;
}

const budgetMessageFor = (index: string) =>
	`Indice ${index} nao possui orcamento pai disponivel`;
const scheduleMessageFor = (index: string) =>
	`Indice ${index} nao possui cronograma pai disponivel`;

export async function resolveItensDependencies(
	itens: NormalizedBudgetItem[],
	inFileBudgetIndexes: Set<string> | null,
	context: DependencyContext,
	lookup: ExistingEntityLookup,
	errors: ImportValidationError[],
): Promise<NormalizedBudgetItem[]> {
	const rows: DependencyRow[] = itens.map((row) => ({
		sheet: "Itens do Orcamento",
		rowNumber: row.rowNumber,
		index: row.index,
	}));
	const accepted = await bindDependencyRows(
		rows,
		inFileBudgetIndexes,
		context,
		errors,
		{
			code: "MISSING_BUDGET_DEPENDENCY",
			messageFor: budgetMessageFor,
			candidatesFor: (index) => [index, ...ancestorIndexesOf(index)],
			findExisting: (ctx, indexes) => lookup.hasBudgetIndexes(ctx, indexes),
		},
	);
	const acceptedRowNumbers = new Set(accepted.map((row) => row.rowNumber));
	return itens.filter((row) => acceptedRowNumbers.has(row.rowNumber));
}

export async function resolveBaselineDependencies(
	baselines: NormalizedBaselineSchedule[],
	inFileBudgetIndexes: Set<string> | null,
	context: DependencyContext,
	lookup: ExistingEntityLookup,
	errors: ImportValidationError[],
): Promise<NormalizedBaselineSchedule[]> {
	const rows: DependencyRow[] = baselines.map((row) => ({
		sheet: "Cronograma Original",
		rowNumber: row.rowNumber,
		index: row.index,
	}));
	const accepted = await bindDependencyRows(
		rows,
		inFileBudgetIndexes,
		context,
		errors,
		{
			code: "MISSING_BUDGET_DEPENDENCY",
			messageFor: budgetMessageFor,
			candidatesFor: (index) => [index, ...ancestorIndexesOf(index)],
			findExisting: (ctx, indexes) => lookup.hasBudgetIndexes(ctx, indexes),
		},
	);
	const acceptedRowNumbers = new Set(accepted.map((row) => row.rowNumber));
	return baselines.filter((row) => acceptedRowNumbers.has(row.rowNumber));
}

export async function resolveReplanningDependencies(
	revisions: NormalizedScheduleRevision[],
	inFileBaselineIndexes: Set<string> | null,
	context: DependencyContext,
	lookup: ExistingEntityLookup,
	errors: ImportValidationError[],
): Promise<NormalizedScheduleRevision[]> {
	const rows: DependencyRow[] = revisions.map((row) => ({
		sheet: "Replanejamento",
		rowNumber: row.rowNumber,
		index: row.index,
	}));
	const accepted = await bindDependencyRows(
		rows,
		inFileBaselineIndexes,
		context,
		errors,
		{
			code: "MISSING_SCHEDULE_DEPENDENCY",
			messageFor: scheduleMessageFor,
			candidatesFor: (index) => [index, ...ancestorIndexesOf(index)],
			findExisting: (ctx, indexes) => lookup.hasScheduleIndexes(ctx, indexes),
		},
	);
	const acceptedRowNumbers = new Set(accepted.map((row) => row.rowNumber));
	return revisions.filter((row) => acceptedRowNumbers.has(row.rowNumber));
}

export async function resolveMeasurementDependencies(
	measurements: NormalizedMeasurement[],
	inFileBudgetIndexes: Set<string> | null,
	context: DependencyContext,
	lookup: ExistingEntityLookup,
	errors: ImportValidationError[],
): Promise<NormalizedMeasurement[]> {
	const rows: DependencyRow[] = measurements.map((row) => ({
		sheet: "Medicoes",
		rowNumber: row.rowNumber,
		index: row.index,
	}));
	const accepted = await bindDependencyRows(
		rows,
		inFileBudgetIndexes,
		context,
		errors,
		{
			code: "MISSING_BUDGET_DEPENDENCY",
			messageFor: budgetMessageFor,
			candidatesFor: (index) => [index, ...ancestorIndexesOf(index)],
			findExisting: (ctx, indexes) => lookup.hasBudgetIndexes(ctx, indexes),
		},
	);
	const acceptedRowNumbers = new Set(accepted.map((row) => row.rowNumber));
	return measurements.filter((row) => acceptedRowNumbers.has(row.rowNumber));
}

export async function resolveActualCostDependencies(
	actualCosts: NormalizedActualCost[],
	inFileBudgetIndexes: Set<string> | null,
	context: DependencyContext,
	lookup: ExistingEntityLookup,
	errors: ImportValidationError[],
): Promise<NormalizedActualCost[]> {
	const rows: DependencyRow[] = actualCosts.map((row) => ({
		sheet: "Custos Realizados",
		rowNumber: row.rowNumber,
		index: row.budgetIndex,
	}));
	const accepted = await bindDependencyRows(
		rows,
		inFileBudgetIndexes,
		context,
		errors,
		{
			code: "MISSING_BUDGET_DEPENDENCY",
			messageFor: budgetMessageFor,
			candidatesFor: (index) => [index, ...ancestorIndexesOf(index)],
			findExisting: (ctx, indexes) => lookup.hasBudgetIndexes(ctx, indexes),
		},
	);
	const acceptedRowNumbers = new Set(accepted.map((row) => row.rowNumber));
	return actualCosts.filter((row) => acceptedRowNumbers.has(row.rowNumber));
}

export const existingEntityLookup: ExistingEntityLookup = {
	hasBudgetIndexes: (context, indexes) =>
		importRepository.existingActiveBudgetIndexes(context, indexes),
	hasScheduleIndexes: (context, indexes) =>
		importRepository.existingScheduleIndexes(context, indexes),
};
