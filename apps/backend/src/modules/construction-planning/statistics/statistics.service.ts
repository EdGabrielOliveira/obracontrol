import { ConstructionError } from "../../../lib/errors";
import { periodKeyOf, type SchedulePeriod } from "../../../lib/period-utils";
import { prisma } from "../../../lib/prisma";
import {
	composeMeasurementInputs,
	measurementValueDelta,
} from "../bi/execution-facts";
import { OPERATIONAL_CONTRACT_STATUSES } from "../contract-status";

type EventTotals = { costs: number; measurements: number; contracts: number };

function add(
	map: Map<string, EventTotals>,
	key: string,
	field: keyof EventTotals,
	value: number,
) {
	const current = map.get(key) ?? { costs: 0, measurements: 0, contracts: 0 };
	current[field] += value;
	map.set(key, current);
}

export async function getWorkStatistics(
	ownerId: string,
	workId: string,
	period: SchedulePeriod,
	asOfDate = new Date(),
) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true, activeImportId: true },
	});
	if (!work)
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	const activeImportId =
		work.activeImportId ??
		(
			await prisma.constructionImport.findFirst({
				where: { ownerId, workId },
				orderBy: { createdAt: "desc" },
				select: { id: true },
			})
		)?.id ??
		null;

	const [costs, importedMeasurements, manualMeasurements, contracts] =
		await Promise.all([
			prisma.constructionActualCost.findMany({
				where: {
					ownerId,
					workId,
					costDate: { not: null, lte: asOfDate },
				},
				select: { amount: true, costDate: true, supplierName: true },
			}),
			prisma.constructionMeasurement.findMany({
				where: {
					ownerId,
					workId,
					status: "ACEITO",
					measurementDate: { not: null, lte: asOfDate },
					OR: [
						...(activeImportId ? [{ importId: activeImportId }] : []),
						{ importId: null },
					],
				},
				select: {
					budgetItemId: true,
					measurementDate: true,
					measuredValue: true,
					measuredPercentageAccumulated: true,
					measuredQuantityAccumulated: true,
				},
			}),
			prisma.workMeasurement.findMany({
				where: {
					ownerId,
					workId,
					status: "ACEITO",
					archivedAt: null,
					date: { lte: asOfDate },
				},
				include: {
					items: {
						select: {
							budgetItemId: true,
							measuredValue: true,
							accumulatedValue: true,
							accumulatedPercentage: true,
							accumulatedQuantity: true,
						},
					},
				},
				orderBy: { date: "asc" },
			}),
			prisma.contract.findMany({
				where: {
					ownerId,
					workId,
					status: { in: [...OPERATIONAL_CONTRACT_STATUSES] },
					createdAt: { lte: asOfDate },
				},
				select: { createdAt: true, contractValue: true, supplierName: true },
			}),
		]);
	const measurements = composeMeasurementInputs(
		importedMeasurements.map((measurement) => ({
			budgetItemId: measurement.budgetItemId,
			measurementDate: measurement.measurementDate,
			measuredValue: measurement.measuredValue,
			measuredPercentageAccumulated: measurement.measuredPercentageAccumulated,
			measuredQuantityAccumulated: measurement.measuredQuantityAccumulated,
		})),
		manualMeasurements,
	);

	const series = new Map<string, EventTotals>();
	const suppliers = new Map<string, { costs: number; contracts: number }>();
	for (const cost of costs) {
		if (!cost.costDate) continue;
		add(
			series,
			periodKeyOf(cost.costDate, period),
			"costs",
			Number(cost.amount),
		);
		const name = cost.supplierName?.trim() || "Sem fornecedor";
		const current = suppliers.get(name) ?? { costs: 0, contracts: 0 };
		current.costs += Number(cost.amount);
		suppliers.set(name, current);
	}
	const previousByItem = new Map<string, (typeof measurements)[number]>();
	for (const measurement of measurements) {
		if (!measurement.measurementDate) continue;
		const key = measurement.budgetItemId ?? measurement.index ?? "unknown";
		add(
			series,
			periodKeyOf(measurement.measurementDate, period),
			"measurements",
			measurementValueDelta(measurement, previousByItem.get(key)),
		);
		previousByItem.set(key, measurement);
	}
	for (const contract of contracts) {
		add(
			series,
			periodKeyOf(contract.createdAt, period),
			"contracts",
			Number(contract.contractValue),
		);
		const name = contract.supplierName?.trim() || "Sem fornecedor";
		const current = suppliers.get(name) ?? { costs: 0, contracts: 0 };
		current.contracts += Number(contract.contractValue);
		suppliers.set(name, current);
	}

	return {
		period,
		asOfDate: asOfDate.toISOString(),
		series: [...series.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, values]) => ({ date, ...values })),
		suppliers: [...suppliers.entries()]
			.sort(([, a], [, b]) => b.costs + b.contracts - (a.costs + a.contracts))
			.map(([name, values]) => ({ name, ...values })),
	};
}
