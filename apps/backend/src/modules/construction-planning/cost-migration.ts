import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";

export type LegacyCostAllocation = {
	budgetItemId: string;
	value?: Decimal | number | string | null;
	percentage?: Decimal | number | string | null;
};

export type CostMigrationCandidate = {
	budgetItemId: string;
	versionItemId: string;
	identityId: string;
};

export type CostSuccessor = {
	lineageKey: string;
	sequence: number;
	sourceCostId: string;
	budgetVersionItemId: string;
	amount: Decimal;
};

const TOLERANCE = new Decimal("0.01");

function decimal(value: Decimal | number | string | null | undefined) {
	return value == null ? null : new Decimal(value.toString());
}

function money(value: Decimal) {
	return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function planLegacyCostMigration(input: {
	sourceCostId: string;
	amount: Decimal | number | string;
	allocations: readonly LegacyCostAllocation[];
	candidates: ReadonlyMap<string, readonly CostMigrationCandidate[]>;
}): CostSuccessor[] {
	const amount = money(new Decimal(input.amount.toString()));
	if (amount.lte(0)) {
		throw new ConstructionError(
			"COST_MIGRATION_INVALID_AMOUNT",
			"Custo deve ser positivo",
			422,
		);
	}
	const allocations = input.allocations;
	if (allocations.length === 0) {
		throw new ConstructionError(
			"COST_MIGRATION_UNRESOLVABLE",
			"Custo sem alocacao legada nao possui identidade inequivoca",
			422,
		);
	}
	const rows = allocations.map((allocation) => {
		const candidates = input.candidates.get(allocation.budgetItemId) ?? [];
		if (candidates.length !== 1) {
			throw new ConstructionError(
				"COST_MIGRATION_AMBIGUOUS_ITEM",
				`Item sem sucessor inequivoco: ${allocation.budgetItemId}`,
				422,
			);
		}
		const value = decimal(allocation.value);
		const percentage = decimal(allocation.percentage);
		if (value == null && percentage == null) {
			throw new ConstructionError(
				"COST_MIGRATION_INVALID_ALLOCATION",
				"Alocacao sem valor",
				422,
			);
		}
		const raw = value ?? amount.mul(percentage ?? 0).div(100);
		if (raw.lte(0)) {
			throw new ConstructionError(
				"COST_MIGRATION_INVALID_ALLOCATION",
				"Alocacao deve ser positiva",
				422,
			);
		}
		return { candidate: candidates[0], value: money(raw) };
	});
	const total = rows.reduce((sum, row) => sum.plus(row.value), new Decimal(0));
	const delta = amount.minus(total);
	if (delta.abs().gt(TOLERANCE)) {
		throw new ConstructionError(
			"COST_MIGRATION_DIVERGENT_TOTAL",
			"Soma das alocacoes diverge do custo acima de R$ 0,01",
			422,
		);
	}
	if (!delta.isZero())
		rows[rows.length - 1].value = rows[rows.length - 1].value.plus(delta);
	return rows.map((row, index) => ({
		lineageKey: `${input.sourceCostId}:${String(index + 1).padStart(4, "0")}`,
		sequence: index + 1,
		sourceCostId: input.sourceCostId,
		budgetVersionItemId: row.candidate.versionItemId,
		amount: row.value,
	}));
}
