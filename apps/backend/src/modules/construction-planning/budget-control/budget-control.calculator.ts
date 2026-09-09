import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import type {
	BalanceCalculationInput,
	BudgetAllocationInput,
	BudgetBalance,
	BudgetImpactPlan,
	ImpactPlanningInput,
	NormalizedAllocation,
} from "./budget-control.types";

const CURRENCY_DECIMALS = 2;
const ALLOCATION_SUM_TOLERANCE = new Decimal("0.10");

function asDecimal(value: Decimal | number): Decimal {
	return value instanceof Decimal ? value : new Decimal(value);
}

function roundCurrency(value: Decimal | number): Decimal {
	return asDecimal(value).toDecimalPlaces(
		CURRENCY_DECIMALS,
		Decimal.ROUND_HALF_UP,
	);
}

export function calculateAnalyticLimit(
	quantity: Decimal,
	unitCost: Decimal,
): Decimal {
	return roundCurrency(quantity.mul(unitCost));
}

export function normalizeCostAllocations(
	amount: Decimal,
	allocations: BudgetAllocationInput[],
): NormalizedAllocation[] {
	if (!allocations || allocations.length === 0) {
		throw new ConstructionError(
			"BUDGET_ITEM_REQUIRED",
			"Informe ao menos uma alocação de item de orçamento",
			422,
		);
	}

	const seen = new Set<string>();
	const rows: Array<{
		budgetItemId: string;
		basis: "PERCENTAGE" | "VALUE";
		percentage?: number;
		value?: number;
	}> = [];
	for (const allocation of allocations) {
		if (!allocation.budgetItemId || seen.has(allocation.budgetItemId)) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				"Alocação duplicada para o mesmo item de orçamento",
				422,
			);
		}
		seen.add(allocation.budgetItemId);

		const basisCount = [
			allocation.quantity,
			allocation.value,
			allocation.percentage,
		].filter((v) => v !== undefined).length;
		if (basisCount === 0 || basisCount > 1) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				"Informe apenas uma base de alocação por item (valor ou percentual)",
				422,
			);
		}
		if (allocation.quantity !== undefined) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				"Alocação de custo não aceita base de quantidade",
				422,
			);
		}
		if (
			allocation.value !== undefined &&
			(amount.lessThan(0) ? allocation.value >= 0 : allocation.value <= 0)
		) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				amount.lessThan(0)
					? "Valor de alocação deve ser negativo para custos negativos"
					: "Valor de alocação deve ser positivo",
				422,
			);
		}
		if (
			allocation.percentage !== undefined &&
			(allocation.percentage < 0 || allocation.percentage > 100)
		) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				"Percentual de alocação deve estar entre 0 e 100",
				422,
			);
		}

		rows.push({
			budgetItemId: allocation.budgetItemId,
			basis: allocation.percentage !== undefined ? "PERCENTAGE" : "VALUE",
			percentage: allocation.percentage,
			value: allocation.value,
		});
	}

	const basisSet = new Set(rows.map((row) => row.basis));
	if (basisSet.size > 1) {
		throw new ConstructionError(
			"BUDGET_ALLOCATION_MISMATCH",
			"Informe apenas uma base de alocação por custo (percentual ou valor)",
			422,
		);
	}

	if (rows[0]?.basis === "PERCENTAGE") {
		const totalPercentage = rows.reduce(
			(sum, row) => sum.plus(row.percentage ?? 0),
			new Decimal(0),
		);
		if (
			totalPercentage.lessThan(new Decimal("99.9")) ||
			totalPercentage.greaterThan(new Decimal("100.1"))
		) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				"A soma das alocações percentuais não corresponde a 100%",
				422,
			);
		}
		return rows.map((row, index) => ({
			budgetItemId: row.budgetItemId,
			basis: "PERCENTAGE" as const,
			percentage: round2(row.percentage ?? 0),
			value: distributePercentageResidual(amount, rows, index),
		}));
	}

	const normalized = rows.map((row) => ({
		budgetItemId: row.budgetItemId,
		basis: "VALUE" as const,
		percentage: roundNumber(
			!amount.isZero()
				? new Decimal(row.value ?? 0).div(amount).mul(100)
				: new Decimal(0),
		),
		value: roundCurrency(new Decimal(row.value ?? 0)),
	}));
	const total = normalized.reduce(
		(sum, row) => sum.plus(row.value),
		new Decimal(0),
	);
	if (total.minus(amount).abs().greaterThan(ALLOCATION_SUM_TOLERANCE)) {
		throw new ConstructionError(
			"BUDGET_ALLOCATION_MISMATCH",
			"A soma das alocações não corresponde ao total do custo",
			422,
		);
	}
	return normalized;
}

function distributePercentageResidual(
	amount: Decimal,
	rows: Array<{
		budgetItemId: string;
		percentage?: number;
	}>,
	index: number,
): Decimal {
	const raw = rows.map((row) => amount.mul(row.percentage ?? 0).div(100));
	const rounded = raw.map((value) =>
		value.toDecimalPlaces(CURRENCY_DECIMALS, Decimal.ROUND_DOWN),
	);
	const remainingCents = amount
		.minus(rounded.reduce((sum, value) => sum.plus(value), new Decimal(0)))
		.div("0.01")
		.toDecimalPlaces(0);
	const order = raw
		.map((value, i) => ({
			i,
			fraction: value.minus(rounded[i]).abs(),
		}))
		.sort((a, b) => b.fraction.comparedTo(a.fraction) || a.i - b.i);
	if (remainingCents.isZero() || order.length === 0) return rounded[index];

	const sign = remainingCents.isNegative() ? -1 : 1;
	const absoluteCents = remainingCents.abs();
	const baseCents = absoluteCents.div(order.length).floor();
	const extraCents = absoluteCents
		.minus(baseCents.mul(order.length))
		.toNumber();
	const rank = order.findIndex((entry) => entry.i === index);
	const centsForItem = baseCents.plus(rank >= 0 && rank < extraCents ? 1 : 0);
	return rounded[index].plus(centsForItem.mul(sign).mul("0.01"));
}

function roundNumber(value: Decimal): number {
	return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function round2(value: number): number {
	return new Decimal(value)
		.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
		.toNumber();
}

export function calculateBalances(
	input: BalanceCalculationInput,
): BudgetBalance {
	const limit = roundCurrency(input.limit);
	const approvedCommitted = roundCurrency(input.approvedCommitted);
	const approvedConsumed = roundCurrency(
		asDecimal(input.independentConsumed).plus(input.uncoveredContractConsumed),
	);
	const pendingImpact = roundCurrency(input.pendingImpact);
	const availableBalance = roundCurrency(
		limit.minus(approvedCommitted).minus(approvedConsumed),
	);
	const projectedBalance = roundCurrency(availableBalance.minus(pendingImpact));

	return {
		budgetItemId: input.budgetItemId,
		limit: Number(limit),
		approvedCommitted: Number(approvedCommitted),
		approvedConsumed: Number(approvedConsumed),
		pendingImpact: Number(pendingImpact),
		availableBalance: Number(availableBalance),
		projectedBalance: Number(projectedBalance),
	};
}

export function buildImpactPlan(input: ImpactPlanningInput): BudgetImpactPlan {
	const balances = calculateBalances(input);
	const amount = roundCurrency(input.amount);
	const available = new Decimal(balances.availableBalance);
	const status = amount.lte(available) ? "APPROVED" : "PENDING_APPROVAL";
	const projectedBalance = roundCurrency(
		available.minus(balances.pendingImpact).minus(amount),
	);

	return {
		budgetItemId: input.budgetItemId,
		impactType: input.impactType,
		status,
		amount,
		availableBalance: balances.availableBalance,
		projectedBalance: Number(projectedBalance),
	};
}
