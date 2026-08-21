import { toFiniteNumber } from "../../../lib/number-utils";

export type BudgetNode = {
	id: string;
	parentId: string | null;
	index: string;
	type: string;
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number;
	plannedStart: unknown;
	plannedEnd: unknown;
	completionPercentage: number | null;
	sortOrder: number;
	children: BudgetNode[];
};

export function deriveBudgetItemTotalCost(input: {
	totalCost?: number | null;
	quantity?: number | null;
	unitCost?: number | null;
	laborUnitCost?: number | null;
	materialUnitCost?: number | null;
	equipmentUnitCost?: number | null;
	otherUnitCost?: number | null;
}): number {
	const unitCost = input.unitCost ?? null;
	const labor = input.laborUnitCost ?? 0;
	const material = input.materialUnitCost ?? 0;
	const equipment = input.equipmentUnitCost ?? 0;
	const other = input.otherUnitCost ?? 0;
	const derivedUnitCost = unitCost ?? labor + material + equipment + other;
	const quantity = input.quantity ?? null;
	return (
		input.totalCost ??
		(quantity !== null && quantity !== undefined
			? quantity * derivedUnitCost
			: 0)
	);
}

export function buildBudgetTree(
	items: Array<Record<string, unknown>>,
): BudgetNode[] {
	const nodes = new Map<string, BudgetNode>();
	const roots: BudgetNode[] = [];

	for (const item of items) {
		const id = String(item.id);
		nodes.set(id, {
			id,
			parentId: (item.parentId as string | null) ?? null,
			index: String(item.index),
			type: String(item.type ?? "ITEM"),
			description: String(item.description ?? ""),
			unit: (item.unit as string | null) ?? null,
			quantity: item.quantity != null ? toFiniteNumber(item.quantity) : null,
			unitCost: item.unitCost != null ? toFiniteNumber(item.unitCost) : null,
			totalCost: toFiniteNumber(item.totalCost),
			plannedStart: item.plannedStart ?? null,
			plannedEnd: item.plannedEnd ?? null,
			completionPercentage:
				item.completionPercentage != null
					? toFiniteNumber(item.completionPercentage)
					: null,
			sortOrder: toFiniteNumber(item.sortOrder),
			children: [],
		});
	}

	for (const item of items) {
		const id = String(item.id);
		const parentId = (item.parentId as string | null) ?? null;
		const node = nodes.get(id);
		if (!node) continue;
		if (parentId && nodes.has(parentId)) {
			nodes.get(parentId)?.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortTree = (list: BudgetNode[]) => {
		list.sort(
			(a, b) => a.sortOrder - b.sortOrder || a.index.localeCompare(b.index),
		);
		for (const item of list) sortTree(item.children);
	};

	sortTree(roots);
	return roots;
}

export function rollupBudgetTree(nodes: BudgetNode[]): void {
	for (const node of nodes) {
		if (node.children.length > 0) {
			rollupBudgetTree(node.children);
			node.totalCost = node.children.reduce(
				(acc, child) => acc + child.totalCost,
				0,
			);
		}
	}
}

export type BudgetSummary = {
	totalBudgeted: number;
	leafCount: number;
};

export function calculateBudgetSummary(nodes: BudgetNode[]): BudgetSummary {
	let totalBudgeted = 0;
	let leafCount = 0;

	for (const node of nodes) {
		if (node.children.length > 0) {
			const childSummary = calculateBudgetSummary(node.children);
			totalBudgeted += childSummary.totalBudgeted;
			leafCount += childSummary.leafCount;
		} else {
			totalBudgeted += node.totalCost;
			leafCount++;
		}
	}

	return { totalBudgeted, leafCount };
}

export type BdiResult = {
	bdiPercentage: number;
	bdiValue: number;
	totalDirectCost: number;
	totalFinalPrice: number;
};

export function calculateBdi(
	totalDirectCost: number,
	bdiPercentage: number | null | undefined,
): BdiResult {
	const pct = bdiPercentage ?? 0;
	const bdiValue = totalDirectCost * (pct / 100);
	return {
		bdiPercentage: pct,
		bdiValue,
		totalDirectCost,
		totalFinalPrice: totalDirectCost + bdiValue,
	};
}
