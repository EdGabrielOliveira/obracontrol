import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "../../lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export type WorkMeasurementItemRow = {
	id: string;
	budgetItemId: string;
	measuredQuantity: Prisma.Decimal | null;
	measurementId: string;
	measurement: { id: string; workId: string };
};

export type ContractMeasurementItemRow = {
	id: string;
	serviceId: string;
	measuredQuantity: Prisma.Decimal | null;
	measurementId: string;
	measurement: {
		id: string;
		contractId: string;
		contract: { workId: string };
	};
};

export type WorkMeasurementItemForReclassify = {
	id: string;
	budgetItemId: string;
	measuredQuantity: Prisma.Decimal | null;
};

export type CoverageRow = {
	id: string;
	ownerId: string;
	workMeasurementItemId: string;
	contractMeasurementItemId: string;
	quantity: Prisma.Decimal | null;
	amount: Prisma.Decimal;
};

export async function getWorkMeasurementItem(
	ownerId: string,
	workId: string,
	itemId: string,
	db: Db = prisma,
): Promise<WorkMeasurementItemRow | null> {
	return db.workMeasurementItem.findFirst({
		where: {
			id: itemId,
			measurement: { ownerId, workId },
		},
		select: {
			id: true,
			budgetItemId: true,
			measuredQuantity: true,
			measurementId: true,
			measurement: { select: { id: true, workId: true } },
		},
	});
}

export async function getContractMeasurementItem(
	ownerId: string,
	workId: string,
	itemId: string,
	db: Db = prisma,
): Promise<ContractMeasurementItemRow | null> {
	return db.contractMeasurementItem.findFirst({
		where: {
			id: itemId,
			measurement: { ownerId, contract: { workId } },
		},
		select: {
			id: true,
			serviceId: true,
			measuredQuantity: true,
			measurementId: true,
			measurement: {
				select: {
					id: true,
					contractId: true,
					contract: { select: { workId: true } },
				},
			},
		},
	});
}

export async function getContractServiceBudgetItem(
	db: Db,
	serviceId: string,
	contractId: string,
): Promise<string | null> {
	const service = await db.contractService.findFirst({
		where: { id: serviceId, contractId },
		select: { budgetItemId: true },
	});
	return service?.budgetItemId ?? null;
}

export async function getContractServiceBudgetItems(
	db: Db,
	contractId: string,
	serviceIds: string[],
): Promise<Map<string, string | null>> {
	if (serviceIds.length === 0) return new Map();
	const services = await db.contractService.findMany({
		where: { contractId, id: { in: serviceIds } },
		select: { id: true, budgetItemId: true },
	});
	return new Map(services.map((service) => [service.id, service.budgetItemId]));
}

export async function getWorkMeasurementItemsByIds(
	ownerId: string,
	workId: string,
	itemIds: string[],
	db: Db = prisma,
): Promise<WorkMeasurementItemRow[]> {
	if (itemIds.length === 0) return [];
	return db.workMeasurementItem.findMany({
		where: { id: { in: itemIds }, measurement: { ownerId, workId } },
		select: {
			id: true,
			budgetItemId: true,
			measuredQuantity: true,
			measurementId: true,
			measurement: { select: { id: true, workId: true } },
		},
	});
}

export async function getContractMeasurementItemsByIds(
	ownerId: string,
	workId: string,
	itemIds: string[],
	db: Db = prisma,
): Promise<ContractMeasurementItemRow[]> {
	if (itemIds.length === 0) return [];
	return db.contractMeasurementItem.findMany({
		where: {
			id: { in: itemIds },
			measurement: { ownerId, contract: { workId } },
		},
		select: {
			id: true,
			serviceId: true,
			measuredQuantity: true,
			measurementId: true,
			measurement: {
				select: {
					id: true,
					contractId: true,
					contract: { select: { workId: true } },
				},
			},
		},
	});
}

export async function findCoveragesByPairs(
	db: Db,
	pairs: Array<{
		workMeasurementItemId: string;
		contractMeasurementItemId: string;
	}>,
): Promise<CoverageRow[]> {
	if (pairs.length === 0) return [];
	return db.constructionMeasurementCoverage.findMany({
		where: {
			OR: pairs.map((pair) => ({
				workMeasurementItemId: pair.workMeasurementItemId,
				contractMeasurementItemId: pair.contractMeasurementItemId,
			})),
		},
	});
}

export async function sumCoveragesByWorkItems(
	db: Db,
	itemIds: string[],
): Promise<Map<string, Decimal>> {
	if (itemIds.length === 0) return new Map();
	const rows = await db.constructionMeasurementCoverage.findMany({
		where: { workMeasurementItemId: { in: itemIds } },
		select: { workMeasurementItemId: true, quantity: true },
	});
	const totals = new Map<string, Decimal>();
	for (const row of rows) {
		totals.set(
			row.workMeasurementItemId,
			(totals.get(row.workMeasurementItemId) ?? new Decimal(0)).plus(
				row.quantity ?? 0,
			),
		);
	}
	return totals;
}

export async function sumCoveragesByContractItems(
	db: Db,
	itemIds: string[],
): Promise<Map<string, Decimal>> {
	if (itemIds.length === 0) return new Map();
	const rows = await db.constructionMeasurementCoverage.findMany({
		where: { contractMeasurementItemId: { in: itemIds } },
		select: { contractMeasurementItemId: true, quantity: true },
	});
	const totals = new Map<string, Decimal>();
	for (const row of rows) {
		totals.set(
			row.contractMeasurementItemId,
			(totals.get(row.contractMeasurementItemId) ?? new Decimal(0)).plus(
				row.quantity ?? 0,
			),
		);
	}
	return totals;
}

export async function sumCoveragesByWorkItem(
	db: Db,
	itemId: string,
): Promise<Decimal> {
	const rows = await db.constructionMeasurementCoverage.findMany({
		where: { workMeasurementItemId: itemId },
		select: { quantity: true },
	});
	return rows.reduce((sum, row) => sum.plus(row.quantity ?? 0), new Decimal(0));
}

export async function sumCoveragesByContractItem(
	db: Db,
	itemId: string,
): Promise<Decimal> {
	const rows = await db.constructionMeasurementCoverage.findMany({
		where: { contractMeasurementItemId: itemId },
		select: { quantity: true },
	});
	return rows.reduce((sum, row) => sum.plus(row.quantity ?? 0), new Decimal(0));
}

export async function findCoverageByPair(
	db: Db,
	workMeasurementItemId: string,
	contractMeasurementItemId: string,
): Promise<CoverageRow | null> {
	return db.constructionMeasurementCoverage.findFirst({
		where: { workMeasurementItemId, contractMeasurementItemId },
	});
}

export async function createCoverage(
	db: Db,
	data: {
		ownerId: string;
		workMeasurementItemId: string;
		contractMeasurementItemId: string;
		quantity: Decimal;
		amount: Decimal;
	},
): Promise<CoverageRow> {
	return db.constructionMeasurementCoverage.create({ data });
}

export async function createCoverages(
	db: Db,
	data: Array<{
		ownerId: string;
		workMeasurementItemId: string;
		contractMeasurementItemId: string;
		quantity: Decimal;
		amount: Decimal;
	}>,
): Promise<CoverageRow[]> {
	if (data.length === 0) return [];
	await db.constructionMeasurementCoverage.createMany({ data });
	return findCoveragesByPairs(
		db,
		data.map(({ workMeasurementItemId, contractMeasurementItemId }) => ({
			workMeasurementItemId,
			contractMeasurementItemId,
		})),
	);
}

export async function getCoverage(
	ownerId: string,
	coverageId: string,
	db: Db = prisma,
): Promise<CoverageRow | null> {
	return db.constructionMeasurementCoverage.findFirst({
		where: { id: coverageId, ownerId },
	});
}

export async function deleteCoverage(db: Db, coverageId: string) {
	return db.constructionMeasurementCoverage.delete({
		where: { id: coverageId },
	});
}

export async function getWorkMeasurementItems(
	ownerId: string,
	measurementId: string,
	db: Db = prisma,
): Promise<WorkMeasurementItemForReclassify[]> {
	return db.workMeasurementItem.findMany({
		where: { measurementId, measurement: { ownerId } },
		select: {
			id: true,
			budgetItemId: true,
			measuredQuantity: true,
		},
	});
}

export async function countCoveragesByWorkMeasurement(
	ownerId: string,
	measurementId: string,
	db: Db = prisma,
): Promise<number> {
	return db.constructionMeasurementCoverage.count({
		where: {
			ownerId,
			workMeasurementItem: { measurementId },
		},
	});
}

export async function findContractMeasurementItemsWithCoverageSums(
	ownerId: string,
	measurementId: string,
	db: Db = prisma,
): Promise<
	Array<{
		id: string;
		measuredQuantity: Prisma.Decimal | null;
		coveredQuantity: Decimal;
	}>
> {
	const items = await db.contractMeasurementItem.findMany({
		where: { measurementId, measurement: { ownerId } },
		select: {
			id: true,
			measuredQuantity: true,
			coverages: { select: { quantity: true } },
		},
	});
	return items.map((item) => ({
		id: item.id,
		measuredQuantity: item.measuredQuantity,
		coveredQuantity: item.coverages.reduce(
			(sum, row) => sum.plus(row.quantity ?? 0),
			new Decimal(0),
		),
	}));
}

export async function listCoverages(ownerId: string, workId: string) {
	return prisma.constructionMeasurementCoverage.findMany({
		where: {
			ownerId,
			workMeasurementItem: { measurement: { workId } },
		},
		include: {
			workMeasurementItem: {
				select: {
					id: true,
					budgetItemId: true,
					measurement: { select: { id: true, number: true } },
				},
			},
			contractMeasurementItem: {
				select: {
					id: true,
					serviceId: true,
					measurement: {
						select: {
							id: true,
							number: true,
							contract: { select: { id: true, code: true } },
						},
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});
}
