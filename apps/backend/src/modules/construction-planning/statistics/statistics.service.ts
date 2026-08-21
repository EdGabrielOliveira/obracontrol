import { ConstructionError } from "../../../lib/errors";
import { periodKeyOf, type SchedulePeriod } from "../../../lib/period-utils";
import { prisma } from "../../../lib/prisma";

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
) {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true },
	});
	if (!work)
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);

	const [costs, measurements, contracts] = await Promise.all([
		prisma.constructionActualCost.findMany({
			where: { ownerId, workId, costDate: { not: null } },
			select: { amount: true, costDate: true, supplierName: true },
		}),
		prisma.workMeasurement.findMany({
			where: { ownerId, workId },
			select: { date: true, items: { select: { measuredValue: true } } },
		}),
		prisma.contract.findMany({
			where: { ownerId, workId },
			select: { createdAt: true, contractValue: true, supplierName: true },
		}),
	]);

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
	for (const measurement of measurements) {
		add(
			series,
			periodKeyOf(measurement.date, period),
			"measurements",
			measurement.items.reduce(
				(sum, item) => sum + Number(item.measuredValue ?? 0),
				0,
			),
		);
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
		series: [...series.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, values]) => ({ date, ...values })),
		suppliers: [...suppliers.entries()]
			.sort(([, a], [, b]) => b.costs + b.contracts - (a.costs + a.contracts))
			.map(([name, values]) => ({ name, ...values })),
	};
}
