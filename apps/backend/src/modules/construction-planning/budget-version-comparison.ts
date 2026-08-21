import Decimal from "decimal.js";

export type BudgetSnapshotItem = {
	index: string;
	parentIndex: string | null;
	type: "STAGE" | "ITEM";
	description: string;
	unit: string | null;
	quantity: Decimal | null;
	unitCost: Decimal | null;
	totalCost: Decimal;
	plannedStart: Date | null;
	plannedEnd: Date | null;
};

export type BudgetSnapshotCostItem = Pick<
	BudgetSnapshotItem,
	"index" | "parentIndex" | "totalCost"
>;

export type BudgetExposure = {
	contractedQuantity: Decimal;
	measuredQuantity: Decimal;
	executedQuantity: Decimal;
	paidQuantity: Decimal;
};

export type BudgetChangeClassification =
	| "UNCHANGED"
	| "INCREASED"
	| "DECREASED"
	| "ADDED"
	| "REMOVED"
	| "STRUCTURE_CHANGED"
	| "SCHEDULE_CHANGED";

export type BudgetComparisonIssue = {
	code:
		| "BUDGET_IDENTITY_CONFLICT"
		| "BUDGET_REDUCTION_BELOW_EXPOSURE"
		| "INVALID_BUDGET_HIERARCHY";
	itemIndex: string;
	message: string;
};

export type BudgetComparisonRow = {
	itemIndex: string;
	parentIndex: string | null;
	level: BudgetSnapshotItem["type"];
	description: string;
	classification: BudgetChangeClassification[];
	previous: BudgetSnapshotItem | null;
	candidate: BudgetSnapshotItem | null;
	delta: {
		quantity: number;
		unitCost: number;
		totalCost: number;
		plannedStartDays: number | null;
		plannedEndDays: number | null;
		plannedDurationDays: number | null;
	};
	validation: { valid: boolean; violations: BudgetComparisonIssue[] };
};

export type BudgetVersionComparison = {
	sourceTotal: number;
	candidateTotal: number;
	grossIncrease: number;
	suppression: number;
	netImpact: number;
	impactPercent: number;
	countsByClassification: Record<BudgetChangeClassification, number>;
	blockingIssues: BudgetComparisonIssue[];
	rows: BudgetComparisonRow[];
};

export function normalizeBudgetDescription(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.replace(/\s+/g, " ")
		.toLocaleUpperCase("pt-BR");
}

function dateDeltaDays(
	previous: Date | null,
	candidate: Date | null,
): number | null {
	if (!previous || !candidate) return previous === candidate ? 0 : null;
	return Math.round((candidate.getTime() - previous.getTime()) / 86_400_000);
}

function durationDays(item: BudgetSnapshotItem): number | null {
	return dateDeltaDays(item.plannedStart, item.plannedEnd);
}

function maximumExposure(exposure: BudgetExposure | undefined): Decimal {
	return [
		exposure?.contractedQuantity,
		exposure?.measuredQuantity,
		exposure?.executedQuantity,
		exposure?.paidQuantity,
	].reduce<Decimal>(
		(maximum, value) => (value?.greaterThan(maximum) ? value : maximum),
		new Decimal(0),
	);
}

function compareItemValues(
	previous: BudgetSnapshotItem,
	candidate: BudgetSnapshotItem,
): BudgetChangeClassification[] {
	const classifications: BudgetChangeClassification[] = [];
	const structureChanged =
		previous.parentIndex !== candidate.parentIndex ||
		previous.type !== candidate.type ||
		normalizeBudgetDescription(previous.description) !==
			normalizeBudgetDescription(candidate.description) ||
		previous.unit !== candidate.unit;
	const totalDelta = candidate.totalCost.minus(previous.totalCost);
	const quantityChanged = !(previous.quantity ?? new Decimal(0)).eq(
		candidate.quantity ?? new Decimal(0),
	);
	const unitCostChanged = !(previous.unitCost ?? new Decimal(0)).eq(
		candidate.unitCost ?? new Decimal(0),
	);

	if (
		totalDelta.greaterThan(0) ||
		(quantityChanged &&
			(candidate.quantity ?? new Decimal(0)).greaterThan(
				previous.quantity ?? new Decimal(0),
			)) ||
		(unitCostChanged &&
			(candidate.unitCost ?? new Decimal(0)).greaterThan(
				previous.unitCost ?? new Decimal(0),
			))
	) {
		classifications.push("INCREASED");
	} else if (
		totalDelta.lessThan(0) ||
		(quantityChanged &&
			(candidate.quantity ?? new Decimal(0)).lessThan(
				previous.quantity ?? new Decimal(0),
			)) ||
		(unitCostChanged &&
			(candidate.unitCost ?? new Decimal(0)).lessThan(
				previous.unitCost ?? new Decimal(0),
			))
	) {
		classifications.push("DECREASED");
	}
	if (structureChanged) classifications.push("STRUCTURE_CHANGED");

	if (
		dateDeltaDays(previous.plannedStart, candidate.plannedStart) !== 0 ||
		dateDeltaDays(previous.plannedEnd, candidate.plannedEnd) !== 0 ||
		durationDays(previous) !== durationDays(candidate)
	) {
		classifications.push("SCHEDULE_CHANGED");
	}

	if (classifications.length === 0) classifications.push("UNCHANGED");
	return classifications;
}

function hierarchyIssue(items: BudgetSnapshotItem[]): BudgetComparisonIssue[] {
	const indexes = new Set(items.map((item) => item.index));
	return items
		.filter(
			(item) => item.parentIndex !== null && !indexes.has(item.parentIndex),
		)
		.map((item) => ({
			code: "INVALID_BUDGET_HIERARCHY" as const,
			itemIndex: item.index,
			message: `Pai do item ${item.index} não existe no orçamento`,
		}));
}

export function sumLeafBudgetSnapshotCosts(
	items: readonly BudgetSnapshotCostItem[],
): Decimal {
	const parentIndexes = new Set(
		items
			.map((item) => item.parentIndex)
			.filter((parent): parent is string => parent !== null),
	);
	return items
		.filter((item) => !parentIndexes.has(item.index))
		.reduce((sum, item) => sum.plus(item.totalCost), new Decimal(0));
}

function rowFor(
	previous: BudgetSnapshotItem | null,
	candidate: BudgetSnapshotItem | null,
	classification: BudgetChangeClassification[],
	violations: BudgetComparisonIssue[],
): BudgetComparisonRow {
	const source = previous ?? candidate;
	const target = candidate ?? previous;
	if (!source || !target)
		throw new Error("Linha de comparação sem origem e candidato");
	return {
		itemIndex: source.index,
		parentIndex: target.parentIndex,
		level: target.type,
		description: target.description,
		classification,
		previous,
		candidate,
		delta: {
			quantity: new Decimal(candidate?.quantity ?? 0)
				.minus(previous?.quantity ?? 0)
				.toNumber(),
			unitCost: new Decimal(candidate?.unitCost ?? 0)
				.minus(previous?.unitCost ?? 0)
				.toNumber(),
			totalCost: new Decimal(candidate?.totalCost ?? 0)
				.minus(previous?.totalCost ?? 0)
				.toNumber(),
			plannedStartDays: dateDeltaDays(
				previous?.plannedStart ?? null,
				candidate?.plannedStart ?? null,
			),
			plannedEndDays: dateDeltaDays(
				previous?.plannedEnd ?? null,
				candidate?.plannedEnd ?? null,
			),
			plannedDurationDays:
				previous && candidate
					? (durationDays(candidate) ?? 0) - (durationDays(previous) ?? 0)
					: null,
		},
		validation: { valid: violations.length === 0, violations },
	};
}

export function compareBudgetVersionSnapshots(
	sourceItems: BudgetSnapshotItem[],
	candidateItems: BudgetSnapshotItem[],
	exposureByIndex: ReadonlyMap<string, BudgetExposure>,
): BudgetVersionComparison {
	const blockingIssues = [
		...hierarchyIssue(sourceItems),
		...hierarchyIssue(candidateItems),
	];
	const sourceByIndex = new Map(sourceItems.map((item) => [item.index, item]));
	const candidateByIndex = new Map(
		candidateItems.map((item) => [item.index, item]),
	);
	const indexes = new Set([
		...sourceByIndex.keys(),
		...candidateByIndex.keys(),
	]);
	const rows: BudgetComparisonRow[] = [];

	for (const itemIndex of [...indexes].sort((left, right) =>
		left.localeCompare(right, undefined, { numeric: true }),
	)) {
		const previous = sourceByIndex.get(itemIndex) ?? null;
		const candidate = candidateByIndex.get(itemIndex) ?? null;
		const violations: BudgetComparisonIssue[] = [];

		if (previous && candidate) {
			if (
				normalizeBudgetDescription(previous.description) !==
				normalizeBudgetDescription(candidate.description)
			) {
				violations.push({
					code: "BUDGET_IDENTITY_CONFLICT",
					itemIndex,
					message: `O índice ${itemIndex} aponta para itens diferentes: "${previous.description}" e "${candidate.description}"`,
				});
			}
			const exposure = exposureByIndex.get(itemIndex);
			const minimumQuantity = maximumExposure(exposure);
			if (
				minimumQuantity.greaterThan(0) &&
				minimumQuantity.greaterThan(candidate.quantity ?? new Decimal(0))
			) {
				violations.push({
					code: "BUDGET_REDUCTION_BELOW_EXPOSURE",
					itemIndex,
					message: `A redução do item ${itemIndex} ultrapassa a quantidade já comprometida ou realizada`,
				});
			}
		} else if (previous && !candidate) {
			const exposure = exposureByIndex.get(itemIndex);
			const minimumQuantity = maximumExposure(exposure);
			if (minimumQuantity.greaterThan(0)) {
				violations.push({
					code: "BUDGET_REDUCTION_BELOW_EXPOSURE",
					itemIndex,
					message: `A supressão do item ${itemIndex} ultrapassa a quantidade já comprometida ou realizada`,
				});
			}
		}

		const classification: BudgetChangeClassification[] =
			previous && candidate
				? compareItemValues(previous, candidate)
				: previous
					? ["REMOVED"]
					: ["ADDED"];
		rows.push(rowFor(previous, candidate, classification, violations));
		blockingIssues.push(...violations);
	}

	const sourceTotal = sumLeafBudgetSnapshotCosts(sourceItems);
	const candidateTotal = sumLeafBudgetSnapshotCosts(candidateItems);
	const netImpact = candidateTotal.minus(sourceTotal);
	const grossIncrease = rows.reduce(
		(sum, row) =>
			row.delta.totalCost > 0
				? sum.plus(new Decimal(row.delta.totalCost))
				: sum,
		new Decimal(0),
	);
	const suppression = rows.reduce(
		(sum, row) =>
			row.delta.totalCost < 0
				? sum.plus(new Decimal(row.delta.totalCost).abs())
				: sum,
		new Decimal(0),
	);
	const countsByClassification = {
		UNCHANGED: 0,
		INCREASED: 0,
		DECREASED: 0,
		ADDED: 0,
		REMOVED: 0,
		STRUCTURE_CHANGED: 0,
		SCHEDULE_CHANGED: 0,
	} satisfies Record<BudgetChangeClassification, number>;
	for (const row of rows) {
		for (const classification of row.classification)
			countsByClassification[classification] += 1;
	}

	return {
		sourceTotal: sourceTotal.toNumber(),
		candidateTotal: candidateTotal.toNumber(),
		grossIncrease: grossIncrease.toNumber(),
		suppression: suppression.toNumber(),
		netImpact: netImpact.toNumber(),
		impactPercent: sourceTotal.isZero()
			? 0
			: netImpact.dividedBy(sourceTotal).times(100).toNumber(),
		countsByClassification,
		blockingIssues,
		rows,
	};
}

const ADITIVO_CLASSIFICATIONS = new Set<BudgetChangeClassification>([
	"INCREASED",
	"DECREASED",
	"ADDED",
	"REMOVED",
	"STRUCTURE_CHANGED",
	"SCHEDULE_CHANGED",
]);

export function hasBudgetVersionChanges(
	comparison: BudgetVersionComparison,
): boolean {
	return comparison.rows.some((row) =>
		row.classification.some((classification) =>
			ADITIVO_CLASSIFICATIONS.has(classification),
		),
	);
}
