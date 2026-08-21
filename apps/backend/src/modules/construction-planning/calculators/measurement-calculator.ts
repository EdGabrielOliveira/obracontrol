import { toFiniteNumber } from "../../../lib/number-utils";

export type CanonicalMeasurementInput = {
	id: string;
	source: "imported" | "operational";
	budgetItemId: string | null;
	index: string;
	date: Date | null;
	number: number | null;
	measuredQuantity: number | null;
	measuredValue: number | null;
	measuredPercentage: number | null;
	accumulatedQuantity: number | null;
	accumulatedValue: number | null;
	accumulatedPercentage: number | null;
};

export type MeasurementItemTotals = {
	accumulatedValue: number;
	accumulatedPercentage: number;
	measuredCurrentValue: number;
	measuredCurrentPercentage: number;
};

export type MeasurementTotalsResult = {
	totalMeasured: number;
	totalMeasuredPercentage: number;
	balanceToMeasure: number;
	balancePercentage: number;
	items: Record<string, MeasurementItemTotals>;
};

function resolveMeasuredValue(
	item: CanonicalMeasurementInput,
	budgetTotalCost: number,
): { value: number; percentage: number } {
	const accQty = toFiniteNumber(item.accumulatedQuantity);
	const accVal = toFiniteNumber(item.accumulatedValue);
	const accPct = toFiniteNumber(item.accumulatedPercentage);

	const accumulatedValue =
		accVal > 0
			? accVal
			: accPct > 0 && budgetTotalCost > 0
				? (accPct / 100) * budgetTotalCost
				: accQty > 0 && budgetTotalCost > 0
					? (accQty / Math.max(1, toFiniteNumber(item.measuredQuantity || 1))) *
						budgetTotalCost
					: 0;

	const accumulatedPercentage =
		accPct > 0
			? accPct
			: budgetTotalCost > 0
				? (accumulatedValue / budgetTotalCost) * 100
				: 0;

	return { value: accumulatedValue, percentage: accumulatedPercentage };
}

export function calculateMeasurementTotals(params: {
	budgetItems: Array<{
		id: string;
		index: string;
		totalCost: number;
		quantity: number | null;
	}>;
	measurements: Array<CanonicalMeasurementInput>;
}): MeasurementTotalsResult {
	const measurements = params.measurements;

	const itemResults: Record<string, MeasurementItemTotals> = {};

	let totalMeasured = 0;
	let totalMeasuredPercentage = 0;
	let totalBudgeted = 0;

	for (const budgetItem of params.budgetItems) {
		const itemMeasurements = measurements.filter(
			(m) =>
				m.budgetItemId === budgetItem.id ||
				(m.index && m.index === budgetItem.index),
		);

		if (itemMeasurements.length === 0) continue;

		itemMeasurements.sort(
			(a, b) =>
				new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime() ||
				(a.number ?? 0) - (b.number ?? 0),
		);

		const latest = itemMeasurements[itemMeasurements.length - 1];
		const resolved = resolveMeasuredValue(latest, budgetItem.totalCost);

		const currentValue = toFiniteNumber(latest.measuredValue);
		const currentPercentage = toFiniteNumber(latest.measuredPercentage);

		itemResults[budgetItem.id] = {
			accumulatedValue: resolved.value,
			accumulatedPercentage: resolved.percentage,
			measuredCurrentValue: currentValue,
			measuredCurrentPercentage: currentPercentage,
		};

		totalMeasured += resolved.value;
		totalMeasuredPercentage += resolved.percentage;
		totalBudgeted += budgetItem.totalCost;
	}

	const balanceToMeasure = Math.max(0, totalBudgeted - totalMeasured);
	const balancePercentage =
		totalBudgeted > 0
			? ((totalBudgeted - totalMeasured) / totalBudgeted) * 100
			: 0;

	return {
		totalMeasured,
		totalMeasuredPercentage,
		balanceToMeasure,
		balancePercentage,
		items: itemResults,
	};
}

export type MeasurementTreeNode = {
	id: string;
	parentId: string | null;
	index: string;
	description: string;
	totalCost: number;
	sortOrder: number;
	measuredCurrent: { quantity: number; value: number; percentage: number };
	measuredAccumulated: { quantity: number; value: number; percentage: number };
	balanceToMeasure: { quantity: number; value: number; percentage: number };
	children: MeasurementTreeNode[];
};

type FlatBudgetItem = {
	id: string;
	parentId: string | null;
	index: string;
	sortOrder: number;
	totalCost: number;
	quantity: number | null;
	description?: string;
};

export function buildCanonicalMeasurementTree(
	budgetItems: FlatBudgetItem[],
	measurementTotals: Record<string, MeasurementItemTotals>,
): MeasurementTreeNode[] {
	const nodes = new Map<string, MeasurementTreeNode>();
	const roots: MeasurementTreeNode[] = [];

	for (const item of budgetItems) {
		const totals = measurementTotals[item.id];
		const accumulated = totals ?? {
			accumulatedValue: 0,
			accumulatedPercentage: 0,
			measuredCurrentValue: 0,
			measuredCurrentPercentage: 0,
		};
		const balanceValue = item.totalCost - accumulated.accumulatedValue;

		nodes.set(item.id, {
			id: item.id,
			parentId: item.parentId,
			index: item.index,
			description: item.description ?? "",
			totalCost: item.totalCost,
			sortOrder: item.sortOrder,
			measuredCurrent: {
				quantity: 0,
				value: accumulated.measuredCurrentValue,
				percentage: accumulated.measuredCurrentPercentage,
			},
			measuredAccumulated: {
				quantity: 0,
				value: accumulated.accumulatedValue,
				percentage: accumulated.accumulatedPercentage,
			},
			balanceToMeasure: {
				quantity: toFiniteNumber(item.quantity),
				value: Math.max(0, balanceValue),
				percentage:
					item.totalCost > 0
						? (Math.max(0, balanceValue) / item.totalCost) * 100
						: 0,
			},
			children: [],
		});
	}

	for (const item of budgetItems) {
		const node = nodes.get(item.id);
		if (!node) continue;
		if (item.parentId && nodes.has(item.parentId)) {
			nodes.get(item.parentId)?.children.push(node);
		} else {
			roots.push(node);
		}
	}

	roots.sort(
		(a, b) => a.sortOrder - b.sortOrder || a.index.localeCompare(b.index),
	);
	for (const item of roots) sortChildren(item);

	function sortChildren(node: MeasurementTreeNode) {
		node.children.sort(
			(a, b) => a.sortOrder - b.sortOrder || a.index.localeCompare(b.index),
		);
		for (const child of node.children) sortChildren(child);
	}

	rollupTree(roots);

	return roots;
}

function rollupTree(nodes: MeasurementTreeNode[]): void {
	for (const node of nodes) {
		if (node.children.length > 0) {
			rollupTree(node.children);
			node.measuredCurrent = node.children.reduce(
				(acc, child) => ({
					quantity: acc.quantity + child.measuredCurrent.quantity,
					value: acc.value + child.measuredCurrent.value,
					percentage: acc.percentage + child.measuredCurrent.percentage,
				}),
				{ quantity: 0, value: 0, percentage: 0 },
			);
			node.measuredAccumulated = node.children.reduce(
				(acc, child) => ({
					quantity: acc.quantity + child.measuredAccumulated.quantity,
					value: acc.value + child.measuredAccumulated.value,
					percentage: acc.percentage + child.measuredAccumulated.percentage,
				}),
				{ quantity: 0, value: 0, percentage: 0 },
			);
			node.balanceToMeasure = node.children.reduce(
				(acc, child) => ({
					quantity: acc.quantity + child.balanceToMeasure.quantity,
					value: acc.value + child.balanceToMeasure.value,
					percentage: acc.percentage + child.balanceToMeasure.percentage,
				}),
				{ quantity: 0, value: 0, percentage: 0 },
			);
		}
	}
}
