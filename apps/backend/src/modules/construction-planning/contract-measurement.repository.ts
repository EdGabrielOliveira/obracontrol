import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../lib/errors";
import { roundCurrency } from "../../lib/math-utils";
import { toFiniteNumber } from "../../lib/number-utils";
import { buildPaginatedResponse } from "../../lib/pagination";
import { pickDefined } from "../../lib/pick-defined";
import { prisma } from "../../lib/prisma";
import {
	PAYMENT_TRANSITIONS,
	validateStatusTransition,
} from "../../lib/status-machine";
import { contractTotal } from "./calculators/contract-calculator";
import { nextMeasurementNumber } from "./measurement-common";
import type {
	CreateContractMeasurementInput,
	CreateContractPaymentInput,
	UpdateContractMeasurementInput,
	UpdateContractPaymentInput,
} from "./schemas/contract.schema";

async function requireContract(
	db: Prisma.TransactionClient | typeof prisma,
	ownerId: string,
	contractId: string,
): Promise<{ id: string }> {
	const contract = await db.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { id: true },
	});
	if (!contract) {
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	}
	return contract;
}

async function validateServiceIds(
	db: Prisma.TransactionClient | typeof prisma,
	ownerId: string,
	contractId: string,
	serviceIds: string[],
) {
	if (serviceIds.length === 0) return;
	const valid = await db.contractService.count({
		where: { id: { in: serviceIds }, contractId, contract: { ownerId } },
	});
	if (valid !== serviceIds.length) {
		throw new ConstructionError(
			"INVALID_SERVICE",
			"Servico invalido para este contrato",
			422,
		);
	}
}

export async function getContractServicesById(
	db: Prisma.TransactionClient | typeof prisma,
	ownerId: string,
	contractId: string,
	serviceIds: string[],
) {
	if (serviceIds.length === 0) return new Map<string, ContractServiceTotals>();

	const services = await db.contractService.findMany({
		where: { id: { in: serviceIds }, contractId, contract: { ownerId } },
		select: { id: true, quantity: true, unitCost: true, totalCost: true },
	});

	return new Map(
		services.map((service) => [
			service.id,
			{
				quantity: toFiniteNumber(service.quantity),
				unitCost: Number(service.unitCost ?? 0),
				totalCost:
					Number(service.totalCost ?? 0) ||
					toFiniteNumber(service.quantity) * Number(service.unitCost ?? 0),
			},
		]),
	);
}

type ContractServiceTotals = {
	quantity: number;
	unitCost: number;
	totalCost: number;
};

export type { ContractServiceTotals as ContractServiceTotalsExport };

export type ContractMeasurementItemPayload = {
	serviceId: string;
	measuredQuantity?: Prisma.Decimal | number | null;
	measuredValue?: Prisma.Decimal | number | null;
	measuredPercentage?: Prisma.Decimal | number | null;
	accumulatedQuantity?: Prisma.Decimal | number | null;
	accumulatedValue?: Prisma.Decimal | number | null;
	accumulatedPercentage?: Prisma.Decimal | number | null;
};

export function buildMeasurementItemData(
	item: ContractMeasurementItemPayload,
	service?: ContractServiceTotals,
) {
	const serviceQuantity = service?.quantity ?? 0;
	const serviceUnitCost = service?.unitCost ?? 0;
	const serviceTotalCost = service?.totalCost ?? 0;

	const measuredQuantity =
		item.measuredQuantity === null || item.measuredQuantity === undefined
			? undefined
			: toFiniteNumber(item.measuredQuantity);
	const explicitMeasuredValue =
		item.measuredValue === null || item.measuredValue === undefined
			? undefined
			: toFiniteNumber(item.measuredValue);
	const explicitMeasuredPercentage =
		item.measuredPercentage === null || item.measuredPercentage === undefined
			? undefined
			: toFiniteNumber(item.measuredPercentage);
	const measuredValue =
		explicitMeasuredValue ??
		(measuredQuantity !== undefined && serviceUnitCost > 0
			? roundCurrency(measuredQuantity * serviceUnitCost)
			: explicitMeasuredPercentage !== undefined && serviceTotalCost > 0
				? roundCurrency(serviceTotalCost * (explicitMeasuredPercentage / 100))
				: undefined);
	const measuredPercentage =
		measuredQuantity !== undefined && serviceQuantity > 0
			? roundCurrency((measuredQuantity / serviceQuantity) * 100)
			: explicitMeasuredPercentage ??
				(measuredValue !== undefined && serviceTotalCost > 0
					? roundCurrency((measuredValue / serviceTotalCost) * 100)
					: undefined);
	const resolvedQuantity =
		measuredQuantity ??
		(explicitMeasuredPercentage !== undefined && serviceQuantity > 0
			? roundCurrency(serviceQuantity * (explicitMeasuredPercentage / 100))
			: undefined);
	const explicitAccumulatedQuantity =
		item.accumulatedQuantity === null || item.accumulatedQuantity === undefined
			? undefined
			: toFiniteNumber(item.accumulatedQuantity);
	const explicitAccumulatedValue =
		item.accumulatedValue === null || item.accumulatedValue === undefined
			? undefined
			: toFiniteNumber(item.accumulatedValue);
	const explicitAccumulatedPercentage =
		item.accumulatedPercentage === null ||
		item.accumulatedPercentage === undefined
			? undefined
			: toFiniteNumber(item.accumulatedPercentage);

	return {
		serviceId: item.serviceId,
		measuredQuantity: resolvedQuantity ?? null,
		measuredValue: measuredValue ?? null,
		measuredPercentage,
		accumulatedQuantity:
			explicitAccumulatedQuantity ?? resolvedQuantity ?? null,
		accumulatedValue: explicitAccumulatedValue ?? measuredValue ?? null,
		accumulatedPercentage: explicitAccumulatedPercentage ?? measuredPercentage,
	};
}

function hydrateContractMeasurementItems<
	T extends {
		items: Array<{ serviceId: string } & Record<string, unknown>>;
	},
>(measurement: T, servicesById: Map<string, ContractServiceTotals>) {
	return {
		...measurement,
		items: measurement.items.map((item) => ({
			...item,
			...buildMeasurementItemData(
				item as ContractMeasurementItemPayload,
				servicesById.get(item.serviceId),
			),
		})),
	} as T;
}

function contractMeasuredValue(
	item: ContractMeasurementItemPayload,
	service?: ContractServiceTotals,
) {
	const hydrated = buildMeasurementItemData(item, service);
	return Number(hydrated.accumulatedValue ?? hydrated.measuredValue ?? 0);
}

export async function listMeasurements(
	ownerId: string,
	contractId: string,
	filters?: { q?: string; page?: number; limit?: number },
) {
	const where: Prisma.ContractMeasurementWhereInput = { ownerId, contractId };

	const page = filters?.page ?? 1;
	const limit = filters?.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.contractMeasurement.findMany({
			where,
			include: { items: true },
			orderBy: { date: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.contractMeasurement.count({ where }),
	]);
	const servicesById = await getContractServicesById(
		prisma,
		ownerId,
		contractId,
		[...new Set(data.flatMap((m) => m.items.map((item) => item.serviceId)))],
	);

	return buildPaginatedResponse(
		data.map((measurement) =>
			hydrateContractMeasurementItems(measurement, servicesById),
		),
		total,
		page,
		limit,
	);
}

export async function getMeasurementById(
	ownerId: string,
	contractId: string,
	measurementId: string,
) {
	const measurement = await prisma.contractMeasurement.findFirst({
		where: { id: measurementId, ownerId, contractId },
		include: { items: true },
	});
	if (!measurement) return null;
	const servicesById = await getContractServicesById(
		prisma,
		ownerId,
		contractId,
		measurement.items.map((item) => item.serviceId),
	);
	return hydrateContractMeasurementItems(measurement, servicesById);
}

export async function getServiceTotals(
	ownerId: string,
	contractId: string,
	serviceIds: string[],
	db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Record<string, number>> {
	const ids = [...new Set(serviceIds)];
	if (ids.length === 0) return {};
	const services = await db.contractService.findMany({
		where: { id: { in: ids }, contractId, contract: { ownerId } },
		select: { id: true, quantity: true, unitCost: true, totalCost: true },
	});
	return Object.fromEntries(
		services.map((service) => [
			service.id,
			Number(service.totalCost ?? 0) ||
				toFiniteNumber(service.quantity) * Number(service.unitCost ?? 0),
		]),
	);
}

export async function getContractPeriod(
	ownerId: string,
	contractId: string,
): Promise<{ startDate: Date | null; endDate: Date | null } | null> {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { startDate: true, endDate: true },
	});
	if (!contract) return null;
	return { startDate: contract.startDate, endDate: contract.endDate };
}

export async function getContractLedgerContext(
	ownerId: string,
	contractId: string,
	db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{
	workId: string;
	startDate: Date | null;
	endDate: Date | null;
} | null> {
	const contract = await db.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { workId: true, startDate: true, endDate: true },
	});
	if (!contract) return null;
	return {
		workId: contract.workId,
		startDate: contract.startDate,
		endDate: contract.endDate,
	};
}

export async function getServiceBudgetItems(
	db: Prisma.TransactionClient | typeof prisma,
	ownerId: string,
	contractId: string,
	serviceIds: string[],
): Promise<Map<string, { budgetItemId: string | null; totalCost: number }>> {
	if (serviceIds.length === 0) return new Map();
	const services = await db.contractService.findMany({
		where: { id: { in: serviceIds }, contractId, contract: { ownerId } },
		select: {
			id: true,
			budgetItemId: true,
			totalCost: true,
			quantity: true,
			unitCost: true,
		},
	});
	return new Map(
		services.map((service) => [
			service.id,
			{
				budgetItemId: service.budgetItemId,
				totalCost:
					Number(service.totalCost ?? 0) ||
					Number(service.quantity ?? 0) * Number(service.unitCost ?? 0),
			},
		]),
	);
}

export async function countPaidPaymentsForMeasurement(
	db: Prisma.TransactionClient | typeof prisma,
	ownerId: string,
	measurementId: string,
): Promise<number> {
	return db.contractPayment.count({
		where: { ownerId, measurementId, status: "PAGO" },
	});
}

export async function createMeasurement(
	ownerId: string,
	contractId: string,
	input: CreateContractMeasurementInput & { createdBy?: string | null },
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	await requireContract(db, ownerId, contractId);
	await validateServiceIds(
		db,
		ownerId,
		contractId,
		input.items.map((i) => i.serviceId),
	);
	const servicesById = await getContractServicesById(
		db,
		ownerId,
		contractId,
		input.items.map((i) => i.serviceId),
	);

	const run = async (t: Prisma.TransactionClient) => {
		const nextNumber =
			input.number ??
			(await nextMeasurementNumber(t, "contractMeasurement", {
				ownerId,
				contractId,
			}));

		const measurement = await t.contractMeasurement.create({
			data: {
				ownerId,
				contractId,
				number: nextNumber,
				date: new Date(input.date),
				title: input.title ?? null,
				discountValue: input.discountValue ?? null,
				retentionValue: input.retentionValue ?? null,
				taxValue: input.taxValue ?? null,
				balanceOverride: false,
				evidenceNote: null,
				createdBy: input.createdBy ?? null,
				notes: input.notes ?? null,
				// Medições só entram no ciclo financeiro depois da aceitação;
				// nenhum chamador de baixo nível pode criar uma medição já aceita.
				status: "RASCUNHO",
			},
		});

		await t.contractMeasurementItem.createMany({
			data: input.items.map((item) => ({
				measurementId: measurement.id,
				...buildMeasurementItemData(item, servicesById.get(item.serviceId)),
			})),
		});

		return t.contractMeasurement.findFirst({
			where: { id: measurement.id },
			include: { items: true },
		});
	};

	if (tx) return run(tx);
	return prisma.$transaction(run);
}

export async function updateMeasurement(
	ownerId: string,
	contractId: string,
	measurementId: string,
	input: UpdateContractMeasurementInput,
) {
	const existing = await prisma.contractMeasurement.findFirst({
		where: { id: measurementId, ownerId, contractId },
		include: { items: true },
	});
	if (!existing) return null;

	return prisma.$transaction(async (tx) => {
		if (input.items) {
			await validateServiceIds(
				tx,
				ownerId,
				contractId,
				input.items.map((i) => i.serviceId),
			);
		}

		const updateData: Record<string, unknown> = {
			...pickDefined(input, [
				"title",
				"discountValue",
				"retentionValue",
				"taxValue",
			] as (keyof typeof input)[]),
		};
		if (input.date !== undefined) updateData.date = new Date(input.date);
		if (input.notes !== undefined) updateData.notes = input.notes;
		if (input.items) {
			updateData.balanceOverride = false;
			updateData.evidenceNote = null;
		}

		if (Object.keys(updateData).length > 0) {
			await tx.contractMeasurement.update({
				where: { id: measurementId, ownerId },
				data: updateData,
			});
		}

		if (input.items) {
			const servicesById = await getContractServicesById(
				tx,
				ownerId,
				contractId,
				input.items.map((i) => i.serviceId),
			);

			const existingByServiceId = new Map(
				existing.items.map((item) => [item.serviceId, item]),
			);
			const payloadServiceIds = new Set(
				input.items.map((item) => item.serviceId),
			);

			for (const payloadItem of input.items) {
				const existingItem = existingByServiceId.get(payloadItem.serviceId);
				if (existingItem) {
					await tx.contractMeasurementItem.update({
						where: { id: existingItem.id },
						data: buildMeasurementItemData(
							payloadItem,
							servicesById.get(payloadItem.serviceId),
						),
					});
				} else {
					await tx.contractMeasurementItem.create({
						data: {
							measurementId,
							...buildMeasurementItemData(
								payloadItem,
								servicesById.get(payloadItem.serviceId),
							),
						},
					});
				}
			}

			for (const existingItem of existing.items) {
				if (!payloadServiceIds.has(existingItem.serviceId)) {
					await tx.contractMeasurementItem.delete({
						where: { id: existingItem.id },
					});
				}
			}
		}

		return tx.contractMeasurement.findFirst({
			where: { id: measurementId },
			include: { items: true },
		});
	});
}

export async function deleteMeasurement(
	ownerId: string,
	contractId: string,
	measurementId: string,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const item = await db.contractMeasurement.findFirst({
		where: { id: measurementId, ownerId, contractId },
	});
	if (!item) return null;
	await db.contractMeasurement.delete({
		where: { id: measurementId, ownerId },
	});
	return item;
}

export async function updateMeasurementStatus(
	ownerId: string,
	contractId: string,
	measurementId: string,
	status: string,
	statusReason?: string | null,
	statusChangedBy?: string | null,
	tx?: Prisma.TransactionClient,
	expectedStatus?: string,
) {
	const db = tx ?? prisma;
	const result = await db.contractMeasurement.updateMany({
		where: {
			id: measurementId,
			ownerId,
			contractId,
			...(expectedStatus ? { status: expectedStatus } : {}),
		},
		data: {
			status,
			statusReason: statusReason ?? null,
			statusChangedAt: new Date(),
			archivedAt: status === "ARQUIVADO" ? new Date() : null,
			archivedBy: status === "ARQUIVADO" ? (statusChangedBy ?? null) : null,
		},
	});
	return result.count > 0;
}

export async function getContractAggregate(
	ownerId: string,
	contractId: string,
) {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId },
		include: {
			services: { orderBy: { sortOrder: "asc" } },
			measurements: {
				where: { status: "ACEITO" },
				include: { items: true },
				orderBy: { date: "desc" },
			},
			payments: { orderBy: { date: "desc" } },
			amendments: { where: { approvalStatus: "APPROVED" } },
		},
	});

	if (!contract) return null;

	const totalServicesValue = contract.services.reduce(
		(sum, s) =>
			sum +
			(Number(s.totalCost) ||
				Number(s.quantity ?? 0) * Number(s.unitCost ?? 0)),
		0,
	);

	const servicesById = new Map(
		contract.services.map((service) => [
			service.id,
			{
				quantity: toFiniteNumber(service.quantity),
				unitCost: Number(service.unitCost ?? 0),
				totalCost:
					Number(service.totalCost ?? 0) ||
					toFiniteNumber(service.quantity) * Number(service.unitCost ?? 0),
			},
		]),
	);
	const measurements = contract.measurements.map((measurement) =>
		hydrateContractMeasurementItems(measurement, servicesById),
	);

	let totalMeasured = 0;
	let retentionTotal = 0;
	let discountTotal = 0;

	for (const m of measurements) {
		for (const item of m.items) {
			totalMeasured += contractMeasuredValue(
				item,
				servicesById.get(item.serviceId),
			);
		}
		retentionTotal += toFiniteNumber(m.retentionValue);
		discountTotal += toFiniteNumber(m.discountValue);
	}

	const totalPaid = contract.payments
		.filter((p) => p.status === "PAGO")
		.reduce((sum, p) => sum + toFiniteNumber(p.paidValue), 0);

	const contractValue = contractTotal(
		toFiniteNumber(contract.contractValue),
		(contract.amendments ?? []).map((amendment) => ({
			kind: amendment.kind,
			value: Number(amendment.value),
		})),
	);

	return {
		contract: {
			id: contract.id,
			code: contract.code,
			supplierName: contract.supplierName,
			title: contract.title,
			status: contract.status,
			contractValue,
		},
		services: contract.services.map((service) => ({
			...service,
			totalCost: servicesById.get(service.id)?.totalCost ?? service.totalCost,
		})),
		measurements,
		payments: contract.payments,
		totals: {
			totalContracted: contractValue,
			totalServicesValue: roundCurrency(totalServicesValue),
			totalMeasured: roundCurrency(totalMeasured),
			totalPaid: roundCurrency(totalPaid),
			retentionTotal: roundCurrency(retentionTotal),
			discountTotal: roundCurrency(discountTotal),
			balance: roundCurrency(contractValue - totalPaid),
			measuredPercentage: contractValue > 0 ? totalMeasured / contractValue : 0,
		},
		measurementsCount: contract.measurements.length,
		paymentsCount: contract.payments.length,
	};
}

export async function getMeasurementMap(ownerId: string, contractId: string) {
	const aggregate = await getContractAggregate(ownerId, contractId);
	if (!aggregate) {
		return {
			totalContractValue: 0,
			totalMeasured: 0,
			totalMeasuredPercentage: 0,
			balanceToMeasure: 0,
			balancePercentage: 0,
			services: [],
		};
	}

	const measurementByService = new Map<
		string,
		{ accumulatedValue: number | null; measuredValue: number | null }
	>();
	for (const m of aggregate.measurements) {
		for (const item of m.items) {
			const existing = measurementByService.get(item.serviceId);
			const val = toFiniteNumber(item.accumulatedValue ?? item.measuredValue);
			if (existing) {
				measurementByService.set(item.serviceId, {
					accumulatedValue: (existing.accumulatedValue ?? 0) + val,
					measuredValue:
						(existing.measuredValue ?? 0) + toFiniteNumber(item.measuredValue),
				});
			} else {
				measurementByService.set(item.serviceId, {
					accumulatedValue: val,
					measuredValue: toFiniteNumber(item.measuredValue),
				});
			}
		}
	}

	const effectiveCost = (s: {
		totalCost: import("@prisma/client").Prisma.Decimal | number | null;
		quantity: import("@prisma/client").Prisma.Decimal | number | null;
		unitCost: import("@prisma/client").Prisma.Decimal | number | null;
	}) =>
		Number(s.totalCost) || Number(s.quantity ?? 0) * Number(s.unitCost ?? 0);

	return {
		totalContractValue: aggregate.totals.totalContracted,
		totalMeasured: aggregate.totals.totalMeasured,
		totalMeasuredPercentage: aggregate.totals.measuredPercentage,
		balanceToMeasure:
			aggregate.totals.totalContracted - aggregate.totals.totalMeasured,
		balancePercentage:
			aggregate.totals.totalContracted > 0
				? (aggregate.totals.totalContracted - aggregate.totals.totalMeasured) /
					aggregate.totals.totalContracted
				: 0,
		services: aggregate.services.map((s) => {
			const contractValue = effectiveCost(s);
			const m = measurementByService.get(s.id);
			const measured = m?.accumulatedValue ?? 0;
			return {
				id: s.id,
				description: s.description,
				type: s.type,
				contractValue,
				measuredValue: measured,
				measuredPercentage: contractValue > 0 ? measured / contractValue : 0,
				balance: contractValue - measured,
			};
		}),
	};
}

function buildServiceTree(
	items: Array<
		{
			id: string;
			parentId: string | null;
			sortOrder: number;
			description: string;
		} & Record<string, unknown>
	>,
) {
	const nodes = new Map<
		string,
		(typeof items)[number] & { children: Array<(typeof items)[number]> }
	>();
	const roots: Array<
		(typeof items)[number] & { children: Array<(typeof items)[number]> }
	> = [];

	for (const item of items) {
		nodes.set(item.id, { ...item, children: [] });
	}

	for (const item of items) {
		const node = nodes.get(item.id);
		if (!node) continue;
		if (item.parentId && nodes.has(item.parentId))
			nodes.get(item.parentId)?.children.push(node);
		else roots.push(node);
	}

	const sortTree = (list: typeof roots) => {
		list.sort(
			(a, b) =>
				a.sortOrder - b.sortOrder || a.description.localeCompare(b.description),
		);
		for (const item of list) sortTree(item.children as typeof roots);
	};

	sortTree(roots);
	return roots;
}

export async function getMeasurementDetail(
	ownerId: string,
	contractId: string,
	measurementId: string,
) {
	const [contract, measurement, services] = await Promise.all([
		prisma.contract.findFirst({
			where: { id: contractId, ownerId },
			select: {
				id: true,
				code: true,
				supplierName: true,
				title: true,
				status: true,
				contractValue: true,
			},
		}),
		prisma.contractMeasurement.findFirst({
			where: { id: measurementId, ownerId, contractId },
			include: { items: true },
		}),
		prisma.contractService.findMany({
			where: { contractId, contract: { ownerId } },
			orderBy: { sortOrder: "asc" },
		}),
	]);

	if (!contract || !measurement) return null;
	const servicesById = new Map(
		services.map((service) => [
			service.id,
			{
				quantity: toFiniteNumber(service.quantity),
				unitCost: Number(service.unitCost ?? 0),
				totalCost:
					Number(service.totalCost ?? 0) ||
					toFiniteNumber(service.quantity) * Number(service.unitCost ?? 0),
			},
		]),
	);
	const hydratedMeasurement = hydrateContractMeasurementItems(
		measurement,
		servicesById,
	);

	const serviceTree = buildServiceTree(services as never[]);
	const currentByService = new Map<
		string,
		{ quantity: number; value: number; percentage: number }
	>();
	const accumulatedByService = new Map<
		string,
		{ quantity: number; value: number; percentage: number }
	>();

	for (const item of hydratedMeasurement.items) {
		currentByService.set(item.serviceId, {
			quantity: Number(item.measuredQuantity ?? 0),
			value: toFiniteNumber(item.measuredValue),
			percentage: Number(item.measuredPercentage ?? 0),
		});
		accumulatedByService.set(item.serviceId, {
			quantity: Number(item.accumulatedQuantity ?? 0),
			value: Number(item.accumulatedValue ?? 0),
			percentage: Number(item.accumulatedPercentage ?? 0),
		});
	}

	const items = serviceTree.map((service) => {
		const current = currentByService.get(service.id) ?? {
			quantity: 0,
			value: 0,
			percentage: 0,
		};
		const accumulated = accumulatedByService.get(service.id) ?? {
			quantity: 0,
			value: 0,
			percentage: 0,
		};
		const serviceTotals = servicesById.get(service.id as string);
		const contractValue =
			serviceTotals?.totalCost ?? Number(service.totalCost ?? 0);
		return {
			...service,
			measuredCurrent: current,
			measuredAccumulated: accumulated,
			balance: {
				quantity: toFiniteNumber(service.quantity) - accumulated.quantity,
				value: contractValue - accumulated.value,
				percentage:
					contractValue > 0
						? ((contractValue - accumulated.value) / contractValue) * 100
						: 0,
			},
		};
	});

	const totals = {
		contractValue: toFiniteNumber(contract.contractValue),
		measuredCurrent: roundCurrency(
			hydratedMeasurement.items.reduce(
				(sum, item) => sum + toFiniteNumber(item.measuredValue),
				0,
			),
		),
		measuredAccumulated: roundCurrency(
			hydratedMeasurement.items.reduce(
				(sum, item) => sum + Number(item.accumulatedValue ?? 0),
				0,
			),
		),
		balance: roundCurrency(
			toFiniteNumber(contract.contractValue) -
				hydratedMeasurement.items.reduce(
					(sum, item) => sum + Number(item.accumulatedValue ?? 0),
					0,
				),
		),
	};

	return {
		contract,
		measurement: hydratedMeasurement,
		serviceTree: items,
		totals,
	};
}

export async function listPayments(
	ownerId: string,
	contractId: string,
	filters?: { page?: number; limit?: number },
) {
	const page = filters?.page ?? 1;
	const limit = filters?.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.contractPayment.findMany({
			where: { ownerId, contractId },
			orderBy: { date: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.contractPayment.count({ where: { ownerId, contractId } }),
	]);

	return buildPaginatedResponse(data, total, page, limit);
}

export async function getPaymentById(
	ownerId: string,
	contractId: string,
	paymentId: string,
) {
	return prisma.contractPayment.findFirst({
		where: { id: paymentId, ownerId, contractId },
	});
}

export async function getPaymentBalance(
	ownerId: string,
	contractId: string,
	opts?: { excludePaymentId?: string; tx?: Prisma.TransactionClient },
) {
	const db = opts?.tx ?? prisma;
	const [contract, payments] = await Promise.all([
		db.contract.findFirst({
			where: { id: contractId, ownerId },
			select: {
				id: true,
				contractValue: true,
				amendments: {
					where: { approvalStatus: "APPROVED" },
					select: { kind: true, value: true },
				},
			},
		}),
		db.contractPayment.findMany({
			where: { ownerId, contractId },
			select: { id: true, status: true, paidValue: true },
		}),
	]);

	if (!contract) return null;

	const totalPaid = payments
		.filter((p) => p.status === "PAGO" && p.id !== opts?.excludePaymentId)
		.reduce((sum, p) => sum + toFiniteNumber(p.paidValue), 0);

	return {
		derivedTotal: contractTotal(
			toFiniteNumber(contract.contractValue),
			(contract.amendments ?? []).map((amendment) => ({
				kind: amendment.kind,
				value: Number(amendment.value),
			})),
		),
		totalPaid,
	};
}

export async function createPayment(
	ownerId: string,
	contractId: string,
	input: CreateContractPaymentInput,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	await requireContract(db, ownerId, contractId);
	if (input.measurementId) {
		const measurement = await db.contractMeasurement.findFirst({
			where: { id: input.measurementId, ownerId, contractId },
			select: { id: true },
		});
		if (!measurement) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Medicao vinculada nao encontrada no contrato",
				404,
			);
		}
	}

	return db.contractPayment.create({
		data: {
			ownerId,
			contractId,
			date: new Date(input.date),
			value: input.value,
			paidValue: input.paidValue,
			measurementId: input.measurementId ?? null,
			description: input.description ?? null,
			retentionValue: input.retentionValue ?? null,
			discountValue: input.discountValue ?? null,
			status: input.status ?? "EM_ABERTO",
			balanceOverride: input.balanceOverride ?? false,
		},
	});
}

export async function updatePayment(
	ownerId: string,
	contractId: string,
	paymentId: string,
	input: UpdateContractPaymentInput,
) {
	const existing = await prisma.contractPayment.findFirst({
		where: { id: paymentId, ownerId, contractId },
	});
	if (!existing) return null;

	if (input.status) {
		validateStatusTransition(
			"Pagamento",
			PAYMENT_TRANSITIONS,
			existing.status,
			input.status,
		);
	}

	if (input.measurementId !== undefined) {
		const measurement = await prisma.contractMeasurement.findFirst({
			where: {
				id: input.measurementId ?? undefined,
				ownerId,
				contractId,
			},
			select: { id: true },
		});
		if (input.measurementId && !measurement) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Medicao vinculada nao encontrada no contrato",
				404,
			);
		}
	}

	const updateData = pickDefined(input, [
		"value",
		"paidValue",
		"measurementId",
		"description",
		"retentionValue",
		"discountValue",
		"status",
		"balanceOverride",
	] as (keyof typeof input)[]);
	if (input.date !== undefined)
		(updateData as Record<string, unknown>).date = new Date(input.date);

	return prisma.contractPayment.update({
		where: { id: paymentId, ownerId },
		data: updateData,
	});
}

export async function deletePayment(
	ownerId: string,
	contractId: string,
	paymentId: string,
) {
	const item = await prisma.contractPayment.findFirst({
		where: { id: paymentId, ownerId, contractId },
	});
	if (!item) return null;
	await prisma.contractPayment.delete({ where: { id: paymentId, ownerId } });
	return item;
}

export async function getPaymentsSummary(ownerId: string, contractId: string) {
	const [contract, payments] = await Promise.all([
		prisma.contract.findFirst({
			where: { id: contractId, ownerId },
			include: {
				measurements: {
					include: { items: true },
				},
			},
		}),
		prisma.contractPayment.findMany({ where: { ownerId, contractId } }),
	]);

	if (!contract) return null;

	let totalMeasuredValue = 0;
	for (const m of contract.measurements) {
		for (const item of m.items) {
			totalMeasuredValue += Number(
				item.accumulatedValue ?? item.measuredValue ?? 0,
			);
		}
	}

	const totalPaid = payments
		.filter((p) => p.status === "PAGO")
		.reduce((s, p) => s + toFiniteNumber(p.paidValue), 0);
	const totalOutstanding = payments
		.filter((p) => p.status === "EM_ABERTO")
		.reduce((s, p) => s + toFiniteNumber(p.paidValue), 0);
	const totalRetention = payments.reduce(
		(s, p) => s + Number(p.retentionValue ?? 0),
		0,
	);
	const totalDiscount = payments.reduce(
		(s, p) => s + Number(p.discountValue ?? 0),
		0,
	);

	return {
		totalContractValue: toFiniteNumber(contract.contractValue),
		approvedMeasurements: contract.measurements.length,
		totalMeasuredValue: roundCurrency(totalMeasuredValue),
		totalPaymentsLaunched: payments.length,
		totalPaidValue: roundCurrency(totalPaid),
		totalOutstandingValue: roundCurrency(totalOutstanding),
		totalRetention: roundCurrency(totalRetention),
		totalDiscount: roundCurrency(totalDiscount),
	};
}
