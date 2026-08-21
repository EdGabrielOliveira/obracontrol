import { toNum } from "../../../lib/decimal-utils";
import { normalizePaymentStatus } from "../../../lib/text-utils";
import type { MetricActualCostInput } from "./metrics-core";

export type FinancialBreakdown = {
	budgetCostPerM2: number | null;
	actualCostPerM2: number | null;
	paidAmount: number;
	openAmount: number;
	bySupplier: Array<{
		supplierName: string;
		totalAmount: number;
		paidAmount: number;
		openAmount: number;
		percentage: number;
	}>;
	abcBySupplier: AbcAnalysisEntry[];
	byGroup: Array<{ group: string; totalAmount: number; percentage: number }>;
	byCategory: Array<{
		category: string;
		totalAmount: number;
		percentage: number;
	}>;
};

export type AbcAnalysisEntry = {
	supplierName: string;
	totalAmount: number;
	percentage: number;
	accumulatedPercentage: number;
	abcClass: "A" | "B" | "C";
};

export function buildAbcAnalysis(
	bySupplier: FinancialBreakdown["bySupplier"],
	_totalCost: number,
): AbcAnalysisEntry[] {
	let accumulated = 0;
	return bySupplier.map((supplier) => {
		const classBefore = accumulated;
		accumulated += supplier.percentage;
		const abcClass: AbcAnalysisEntry["abcClass"] =
			classBefore < 0.8 ? "A" : classBefore < 0.95 ? "B" : "C";
		return {
			supplierName: supplier.supplierName,
			totalAmount: supplier.totalAmount,
			percentage: supplier.percentage,
			accumulatedPercentage: accumulated,
			abcClass,
		};
	});
}

export function groupByCostField(
	costs: MetricActualCostInput[],
	keyFn: (cost: MetricActualCostInput) => string,
	totalCost: number,
): Array<{ key: string; totalAmount: number; percentage: number }> {
	const map = new Map<string, number>();
	for (const cost of costs) {
		const key = keyFn(cost);
		map.set(key, (map.get(key) ?? 0) + toNum(cost.amount));
	}
	return [...map.entries()]
		.map(([key, totalAmount]) => ({
			key,
			totalAmount,
			percentage: totalCost > 0 ? totalAmount / totalCost : 0,
		}))
		.sort((a, b) => b.totalAmount - a.totalAmount);
}

export function buildFinancialBreakdown(
	currentCosts: MetricActualCostInput[],
	activeBudget: number,
	actualCost: number,
	areaM2: number | null,
): FinancialBreakdown {
	const totalCurrentCost = currentCosts.reduce(
		(sum, c) => sum + toNum(c.amount),
		0,
	);
	const paidAmount = currentCosts
		.filter((c) => normalizePaymentStatus(c.paymentStatus) === "PAID")
		.reduce((sum, c) => sum + toNum(c.amount), 0);
	const openAmount = currentCosts
		.filter((c) => normalizePaymentStatus(c.paymentStatus) === "OPEN")
		.reduce((sum, c) => sum + toNum(c.amount), 0);

	const supplierMap = new Map<
		string,
		{ total: number; paid: number; open: number }
	>();
	for (const cost of currentCosts) {
		const name = cost.supplierName ?? "Sem fornecedor";
		const entry = supplierMap.get(name) ?? { total: 0, paid: 0, open: 0 };
		entry.total += toNum(cost.amount);
		if (normalizePaymentStatus(cost.paymentStatus) === "PAID")
			entry.paid += toNum(cost.amount);
		else entry.open += toNum(cost.amount);
		supplierMap.set(name, entry);
	}
	const bySupplier = [...supplierMap.entries()]
		.map(([supplierName, data]) => ({
			supplierName,
			totalAmount: data.total,
			paidAmount: data.paid,
			openAmount: data.open,
			percentage: totalCurrentCost > 0 ? data.total / totalCurrentCost : 0,
		}))
		.sort((a, b) => b.totalAmount - a.totalAmount);

	const byGroup = groupByCostField(
		currentCosts,
		(c) => c.costGroup ?? "Sem grupo",
		totalCurrentCost,
	).map(({ key: group, totalAmount, percentage }) => ({
		group,
		totalAmount,
		percentage,
	}));

	const byCategory = groupByCostField(
		currentCosts,
		(c) => c.category ?? "Sem categoria",
		totalCurrentCost,
	).map(({ key: category, totalAmount, percentage }) => ({
		category,
		totalAmount,
		percentage,
	}));

	return {
		budgetCostPerM2: areaM2 && areaM2 > 0 ? activeBudget / areaM2 : null,
		actualCostPerM2: areaM2 && areaM2 > 0 ? actualCost / areaM2 : null,
		paidAmount,
		openAmount,
		bySupplier,
		abcBySupplier: buildAbcAnalysis(bySupplier, totalCurrentCost),
		byGroup,
		byCategory,
	};
}
