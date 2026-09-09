import type {
	DbItemCalculationInput,
	DbMeasurementInput,
} from "../bi/calculations";
import { toMetricItem } from "../bi/calculations";
import { latestMeasurementPercentage } from "../bi/metrics-core";

export type ActualDates = {
	actualStart: Date | null;
	actualEnd: Date | null;
};

function utcDay(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function measurementProgress(
	item: DbItemCalculationInput,
	measurement: DbMeasurementInput,
	dataDate: Date,
): number {
	return latestMeasurementPercentage(
		toMetricItem(item),
		[measurement],
		dataDate,
	);
}

export function buildActualDatesByItem(
	items: DbItemCalculationInput[],
	measurements: DbMeasurementInput[],
	dataDate: Date,
): Map<string, ActualDates> {
	const itemsById = new Map(items.map((item) => [item.id, item]));
	const itemsByIndex = new Map<string, DbItemCalculationInput[]>();
	for (const item of items) {
		const indexedItems = itemsByIndex.get(item.index) ?? [];
		indexedItems.push(item);
		itemsByIndex.set(item.index, indexedItems);
	}

	const datesByItem = new Map(
		items.map((item) => [
			item.id,
			{ actualStart: item.actualStart, actualEnd: item.actualEnd },
		]),
	);
	for (const measurement of measurements) {
		if (
			!measurement.measurementDate ||
			utcDay(measurement.measurementDate) > utcDay(dataDate)
		)
			continue;

		const matchedItems = measurement.budgetItemId
			? [itemsById.get(measurement.budgetItemId)].filter(
					(item): item is DbItemCalculationInput => item != null,
				)
			: [
					measurement.budgetItemIndex,
					measurement.budgetIndex,
					measurement.index,
				]
					.filter((index): index is string => index != null)
					.flatMap((index) => itemsByIndex.get(index) ?? [])
					.filter(
						(item, index, all) =>
							all.findIndex((candidate) => candidate.id === item.id) === index,
					);

		for (const item of matchedItems) {
			const dates = datesByItem.get(item.id);
			if (!dates) continue;
			const progress = measurementProgress(item, measurement, dataDate);
			if (
				progress > 0 &&
				(!dates.actualStart || measurement.measurementDate < dates.actualStart)
			) {
				dates.actualStart = measurement.measurementDate;
			}
			if (
				progress >= 1 &&
				(!dates.actualEnd || measurement.measurementDate > dates.actualEnd)
			) {
				dates.actualEnd = measurement.measurementDate;
			}
		}
	}

	return datesByItem;
}

export function isScheduleStartDelayed(
	item: {
		plannedStart: Date | null | undefined;
		actualStart: Date | null | undefined;
	},
	referenceDate: Date,
): boolean {
	return Boolean(
		item.plannedStart &&
			!item.actualStart &&
			utcDay(item.plannedStart) < utcDay(referenceDate),
	);
}
