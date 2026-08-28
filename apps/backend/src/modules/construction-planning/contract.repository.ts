import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../lib/errors";
import { roundCurrency } from "../../lib/math-utils";
import { toFiniteNumber } from "../../lib/number-utils";
import { buildPaginatedResponse } from "../../lib/pagination";
import { pickDefined } from "../../lib/pick-defined";
import { prisma } from "../../lib/prisma";
import { getWorkspaceIdForUser } from "../../lib/workspace";
import type { ContractSnapshotRow } from "./bi/metric-source";
import { contractTotal } from "./calculators/contract-calculator";
import {
	isOperationalContractStatus,
	OPERATIONAL_CONTRACT_STATUSES,
} from "./contract-status";
import type {
	CreateContractInput,
	CreateContractServiceInput,
	LinkBudgetInput,
	UpdateContractAmendmentInput,
	UpdateContractInput,
	UpdateContractServiceInput,
} from "./schemas/contract.schema";
import { findSupplierByDocumentOrName } from "./suppliers/supplier.repository";

type QuotationSupplierRow = {
	supplierDocument?: unknown;
	supplierAddress?: unknown;
	supplierPhone?: unknown;
	supplierEmail?: unknown;
	supplierResponsible?: unknown;
};

function importedText(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const text = value.trim();
	return text.length > 0 ? text : null;
}

function documentDigits(value: unknown): string | null {
	const text = importedText(value);
	if (!text) return null;
	const digits = text.replace(/\D/g, "");
	return digits.length > 0 ? digits : null;
}

export async function listContractSnapshotRows(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<ContractSnapshotRow[]> {
	const contracts = await prisma.contract.findMany({
		where: {
			ownerId,
			workId,
			status: { in: [...OPERATIONAL_CONTRACT_STATUSES] },
			...(asOfDate ? { createdAt: { lte: asOfDate } } : {}),
		},
		select: {
			id: true,
			contractValue: true,
			status: true,
			payments: {
				where: { status: "PAGO" },
				select: { paidValue: true },
			},
		},
		orderBy: { createdAt: "asc" },
	});

	return contracts.map((contract) => ({
		id: contract.id,
		contractValue: Number(contract.contractValue),
		measuredValue: null,
		paidValue: contract.payments.reduce(
			(sum, payment) => sum + Number(payment.paidValue),
			0,
		),
		status: contract.status,
	}));
}

export function deriveServiceTotalCost(input: {
	quantity?: Prisma.Decimal | number | null;
	unitCost?: Prisma.Decimal | number | null;
	totalCost?: Prisma.Decimal | number | null;
}) {
	const totalCost = toFiniteNumber(input.totalCost);
	if (totalCost > 0) return totalCost;
	const quantity = toFiniteNumber(input.quantity);
	const unitCost = Number(input.unitCost ?? 0);
	return quantity > 0 && unitCost > 0
		? roundCurrency(quantity * unitCost)
		: null;
}

export async function listContracts(
	ownerId: string,
	workId: string,
	filters?: {
		q?: string;
		status?: string;
		supplierName?: string;
		page?: number;
		limit?: number;
	},
) {
	const where: Prisma.ContractWhereInput = { ownerId, workId };
	if (filters?.status) where.status = filters.status;
	if (filters?.supplierName)
		where.supplierName = {
			contains: filters.supplierName,
		};
	if (filters?.q) {
		const exactCode = await prisma.contract.findFirst({
			where: { ...where, code: filters.q },
			orderBy: { createdAt: "desc" },
		});
		if (exactCode) {
			const page = filters.page ?? 1;
			const limit = filters.limit ?? 10;
			return buildPaginatedResponse([exactCode], 1, page, limit);
		}
		where.OR = [
			{ code: { contains: filters.q } },
			{ supplierName: { contains: filters.q } },
			{ title: { contains: filters.q } },
		];
	}

	const page = filters?.page ?? 1;
	const limit = filters?.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.contract.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.contract.count({ where }),
	]);

	return buildPaginatedResponse(data, total, page, limit);
}

export async function getContractById(
	ownerId: string,
	workId: string,
	contractId: string,
) {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId, workId },
		include: {
			supplier: {
				select: {
					id: true,
					name: true,
					document: true,
					responsibleName: true,
					responsibleDocument: true,
					contact: true,
					addressZipCode: true,
					addressStreet: true,
					addressNumber: true,
					addressComplement: true,
					addressDistrict: true,
					addressCity: true,
					addressState: true,
				},
			},
			services: {
				orderBy: { sortOrder: "asc" },
				include: {
					budgetItem: {
						select: {
							id: true,
							identityId: true,
							description: true,
							index: true,
							unit: true,
							quantity: true,
							unitCost: true,
							totalCost: true,
						},
					},
				},
			},
			folders: true,
			contractRequest: {
				select: {
					id: true,
					acceptedProposalId: true,
					confirmedBatchId: true,
				},
			},
			quotations: {
				select: { id: true },
				take: 1,
			},
			amendments: {
				where: { ownerId, approvalStatus: "APPROVED" },
				orderBy: { date: "desc" },
				include: { measurements: { select: { measurementId: true } } },
			},
		},
	});
	if (!contract) return null;
	const activeVersion = prisma.budgetVersion
		? await prisma.budgetVersion.findFirst({
				where: { ownerId, workId, isActive: true },
				select: {
					versionNumber: true,
					items: { select: { identityId: true, index: true } },
				},
			})
		: null;
	const activeIndexByIdentity = new Map(
		(activeVersion?.items ?? []).map((item) => [item.identityId, item.index]),
	);
	const servicesWithCurrentIndex = contract.services.map((service) => {
		const identityId = service.budgetItem?.identityId;
		const currentIndex = identityId
			? activeIndexByIdentity.get(identityId)
			: undefined;
		return {
			...service,
			budgetItem: service.budgetItem
				? {
						...service.budgetItem,
						displayIndex:
							currentIndex && activeVersion
								? currentIndex
								: service.budgetItem.index,
					}
				: service.budgetItem,
		};
	});
	const acceptedProposalId = contract.contractRequest?.acceptedProposalId;
	const acceptedProposal = acceptedProposalId
		? await prisma.contractRequestProposal.findFirst({
				where: {
					id: acceptedProposalId,
					ownerId,
					workId,
				},
				select: {
					originalProposalValue: true,
					proposalValue: true,
					normalizedCnpj: true,
					supplierName: true,
				},
			})
		: null;
	const resolvedSupplier =
		contract.supplier ??
		(acceptedProposal
			? await findSupplierByDocumentOrName(
					ownerId,
					acceptedProposal.normalizedCnpj,
					acceptedProposal.supplierName,
				)
			: null);
	const importRows =
		!resolvedSupplier &&
		acceptedProposal &&
		contract.contractRequest?.confirmedBatchId
			? await prisma.importRow.findMany({
					where: { batchId: contract.contractRequest.confirmedBatchId },
					select: { values: true },
				})
			: [];
	const importedSupplier = importRows.find((row) => {
		const values = row.values as QuotationSupplierRow;
		return (
			documentDigits(values.supplierDocument) ===
			acceptedProposal?.normalizedCnpj
		);
	})?.values as QuotationSupplierRow | undefined;
	const supplierCandidate = resolvedSupplier
		? null
		: {
				name: acceptedProposal?.supplierName ?? contract.supplierName,
				document: acceptedProposal?.normalizedCnpj ?? null,
				address: importedText(importedSupplier?.supplierAddress),
				phone: importedText(importedSupplier?.supplierPhone),
				email: importedText(importedSupplier?.supplierEmail),
				responsibleName: importedText(importedSupplier?.supplierResponsible),
			};
	const originalProposalValue = acceptedProposal
		? Number(
				acceptedProposal.originalProposalValue ??
					acceptedProposal.proposalValue,
			)
		: null;
	const negotiatedProposalValue = acceptedProposal
		? Number(acceptedProposal.proposalValue)
		: null;
	const amendments = (contract.amendments ?? []).map((amendment) => ({
		...amendment,
		measurementIds: (amendment.measurements ?? []).map(
			(link) => link.measurementId,
		),
	}));
	return {
		...contract,
		quotationId: contract.quotations?.[0]?.id ?? null,
		supplier: resolvedSupplier,
		supplierCandidate,
		services: servicesWithCurrentIndex,
		totalValue: contractTotal(
			Number(contract.contractValue),
			amendments.map((amendment) => ({
				kind: amendment.kind,
				value: Number(amendment.value),
			})),
		),
		amendmentTotal: roundCurrency(
			amendments.reduce(
				(sum, amendment) =>
					amendment.kind === "ADITIVO"
						? sum + Number(amendment.value)
						: sum - Number(amendment.value),
				0,
			),
		),
		quotation: acceptedProposal
			? {
					originalProposalValue,
					negotiatedValue: negotiatedProposalValue ?? 0,
					negotiationReductionAmount: originalProposalValue
						? Math.max(
								0,
								originalProposalValue - (negotiatedProposalValue ?? 0),
							)
						: null,
					negotiationReductionPercent: originalProposalValue
						? ((originalProposalValue - (negotiatedProposalValue ?? 0)) /
								originalProposalValue) *
							100
						: null,
				}
			: null,
	};
}

export async function createContract(
	ownerId: string,
	workId: string,
	input: CreateContractInput & {
		supplierName: string;
		createdBy?: string | null;
	},
) {
	const workDelegate = (
		prisma as unknown as {
			constructionWork?: {
				findUnique?: (
					args: unknown,
				) => Promise<{ workspaceId?: string | null } | null>;
			};
		}
	).constructionWork;
	const work = workDelegate?.findUnique
		? await workDelegate.findUnique({
				where: { id: workId },
				select: { workspaceId: true },
			})
		: null;
	const workspaceId =
		work?.workspaceId ?? (await getWorkspaceIdForUser(ownerId));
	return prisma.contract.create({
		data: {
			ownerId,
			...(workspaceId ? { workspaceId } : {}),
			workId,
			code: input.code,
			supplierName: input.supplierName,
			supplierId: input.supplierId ?? null,
			contractValue: input.contractValue,
			serviceType: input.serviceType ?? null,
			...(input.objectDescription !== undefined
				? { objectDescription: input.objectDescription ?? null }
				: {}),
			title: input.title ?? null,
			startDate: input.startDate ? new Date(input.startDate) : null,
			endDate: input.endDate ? new Date(input.endDate) : null,
			// O contrato só pode ser ativado por uma transição de status posterior.
			status: "RASCUNHO",
			createdBy: input.createdBy ?? null,
			notes: input.notes ?? null,
		},
	});
}

type LegacyContractUpdateInput = UpdateContractInput & {
	code?: string;
	supplierName?: string;
	supplierId?: string | null;
	contractValue?: number;
	status?: string;
	statusReason?: string;
	notes?: string;
};

export async function updateContract(
	ownerId: string,
	workId: string,
	contractId: string,
	input: LegacyContractUpdateInput,
) {
	const existing = await prisma.contract.findFirst({
		where: { id: contractId, ownerId, workId },
	});
	if (!existing) return null;

	const updateData = pickDefined(input, [
		"serviceType",
		"objectDescription",
		"title",
		"supplierId",
		"supplierName",
		"contractValue",
		"status",
		"statusReason",
		"notes",
	] as (keyof typeof input)[]);
	if (input.startDate !== undefined)
		(updateData as Record<string, unknown>).startDate = input.startDate
			? new Date(input.startDate)
			: null;
	if (input.endDate !== undefined)
		(updateData as Record<string, unknown>).endDate = input.endDate
			? new Date(input.endDate)
			: null;
	if (input.status !== undefined || input.statusReason !== undefined)
		(updateData as Record<string, unknown>).statusChangedAt = new Date();

	return prisma.contract.update({
		where: { id: contractId, ownerId },
		data: updateData as Record<string, unknown>,
	});
}

export async function deleteContract(
	ownerId: string,
	workId: string,
	contractId: string,
) {
	const item = await prisma.contract.findFirst({
		where: { id: contractId, ownerId, workId },
	});
	if (!item) return null;
	await prisma.contract.delete({ where: { id: contractId, ownerId } });
	return item;
}

export async function getContractsSummary(ownerId: string, workId: string) {
	const contracts = await prisma.contract.findMany({
		where: { ownerId, workId },
		include: {
			measurements: {
				where: { status: "ACEITO" },
				include: { items: true },
			},
			services: true,
			payments: true,
			supplier: { select: { name: true } },
			amendments: { where: { approvalStatus: "APPROVED" } },
		},
	});
	const operationalContracts = contracts.filter((contract) =>
		isOperationalContractStatus(contract.status),
	);
	const pendingContracts = contracts.filter(
		(contract) => contract.status === "A_INICIAR",
	);
	const draftContracts = contracts.filter(
		(contract) => contract.status === "RASCUNHO",
	);

	const perContract = operationalContracts.map((c) => {
		const servicesById = new Map(
			c.services.map((service) => [
				service.id,
				{
					quantity: toFiniteNumber(service.quantity),
					unitCost: Number(service.unitCost ?? 0),
					totalCost: deriveServiceTotalCost(service) ?? 0,
				},
			]),
		);
		let measuredValue = 0;
		for (const m of c.measurements) {
			for (const item of m.items) {
				const service = servicesById.get(item.serviceId);
				const measuredQuantity = Number(
					item.accumulatedQuantity ?? item.measuredQuantity ?? 0,
				);
				const measuredPercentage = Number(
					item.accumulatedPercentage ?? item.measuredPercentage ?? 0,
				);
				measuredValue += Number(
					item.accumulatedValue ??
						item.measuredValue ??
						(measuredQuantity > 0 && service?.unitCost
							? measuredQuantity * service.unitCost
							: measuredPercentage > 0 && service?.totalCost
								? service.totalCost * (measuredPercentage / 100)
								: 0),
				);
			}
		}
		return {
			contractValue: contractTotal(
				Number(c.contractValue),
				(c.amendments ?? []).map((amendment) => ({
					kind: amendment.kind,
					value: Number(amendment.value),
				})),
			),
			measuredValue,
			paidValue: c.payments
				.filter((p) => p.status === "PAGO")
				.reduce((s, p) => s + Number(p.paidValue), 0),
			outstandingValue: c.payments
				.filter((p) => p.status === "EM_ABERTO")
				.reduce((s, p) => s + Number(p.paidValue), 0),
			supplierId: c.supplierId,
			supplierName: c.supplier?.name ?? null,
		};
	});

	const totalContracts = contracts.length;
	const totalContractValue = perContract.reduce(
		(sum, c) => sum + c.contractValue,
		0,
	);
	const totalMeasuredValue = perContract.reduce(
		(sum, c) => sum + c.measuredValue,
		0,
	);
	const totalPaidValue = perContract.reduce((sum, c) => sum + c.paidValue, 0);
	const totalOutstandingValue = perContract.reduce(
		(sum, c) => sum + c.outstandingValue,
		0,
	);

	const bySupplierMap = new Map<
		string,
		{
			supplierId: string | null;
			supplierName: string | null;
			contractedValue: number;
			measuredValue: number;
			paidValue: number;
		}
	>();
	for (const c of perContract) {
		const key = c.supplierId ?? "";
		const group = bySupplierMap.get(key) ?? {
			supplierId: c.supplierId,
			supplierName: c.supplierName,
			contractedValue: 0,
			measuredValue: 0,
			paidValue: 0,
		};
		group.contractedValue += c.contractValue;
		group.measuredValue += c.measuredValue;
		group.paidValue += c.paidValue;
		bySupplierMap.set(key, group);
	}
	const bySupplier = [...bySupplierMap.values()].sort((a, b) => {
		if (a.supplierName === null) return 1;
		if (b.supplierName === null) return -1;
		return a.supplierName.localeCompare(b.supplierName);
	});

	return {
		totalContracts,
		operationalContracts: operationalContracts.length,
		pendingContracts: pendingContracts.length,
		draftContracts: draftContracts.length,
		pendingContractValue: roundCurrency(
			pendingContracts.reduce((sum, contract) => {
				return sum + Number(contract.contractValue);
			}, 0),
		),
		totalContractValue: roundCurrency(totalContractValue),
		approvedMeasurements: operationalContracts.reduce(
			(sum, c) => sum + c.measurements.length,
			0,
		),
		totalMeasuredValue: roundCurrency(totalMeasuredValue),
		measuredPercentage:
			totalContractValue > 0 ? totalMeasuredValue / totalContractValue : 0,
		totalPaidValue: roundCurrency(totalPaidValue),
		totalOutstandingValue: roundCurrency(totalOutstandingValue),
		paidPercentage:
			totalContractValue > 0 ? totalPaidValue / totalContractValue : 0,
		bySupplier: bySupplier.map((group) => ({
			...group,
			contractedValue: roundCurrency(group.contractedValue),
			measuredValue: roundCurrency(group.measuredValue),
			paidValue: roundCurrency(group.paidValue),
		})),
	};
}

export async function listCrossContractMeasurements(
	ownerId: string,
	workId: string,
) {
	const where: Prisma.ContractMeasurementWhereInput = {
		ownerId,
		contract: { workId },
		status: "ACEITO",
	};

	return prisma.contractMeasurement.findMany({
		where,
		include: {
			contract: { select: { id: true, code: true, supplierName: true } },
			items: true,
		},
		orderBy: { date: "desc" },
	});
}

// ContractService CRUD
export async function listContractServices(
	ownerId: string,
	contractId: string,
) {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId },
	});
	if (!contract) return null;

	const services = await prisma.contractService.findMany({
		where: { contractId },
		orderBy: { sortOrder: "asc" },
		include: {
			budgetItem: {
				select: {
					id: true,
					description: true,
					index: true,
					unit: true,
					quantity: true,
					unitCost: true,
					totalCost: true,
				},
			},
		},
	});

	return services.map((service) => ({
		...service,
		totalCost: service.totalCost ?? deriveServiceTotalCost(service),
	}));
}

export async function getContractServiceById(
	db: Prisma.TransactionClient | typeof prisma,
	ownerId: string,
	contractId: string,
	serviceId: string,
): Promise<{
	id: string;
	budgetItemId: string | null;
	totalCost: number;
} | null> {
	const service = await db.contractService.findFirst({
		where: { id: serviceId, contractId, contract: { ownerId } },
		select: { id: true, budgetItemId: true, totalCost: true },
	});
	if (!service) return null;
	return {
		id: service.id,
		budgetItemId: service.budgetItemId,
		totalCost: Number(service.totalCost ?? 0),
	};
}

export async function getContractServiceBudgetItem(
	ownerId: string,
	contractId: string,
	budgetItemId: string,
): Promise<{ id: string; description: string; index: string } | null> {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { workId: true },
	});
	if (!contract) return null;

	const item = await prisma.constructionBudgetItem.findFirst({
		where: { id: budgetItemId, ownerId, workId: contract.workId },
		select: { id: true, description: true, index: true },
	});
	if (!item) {
		throw new ConstructionError(
			"INVALID_BUDGET_ITEM",
			"Item de orcamento nao pertence a obra do contrato",
			422,
		);
	}
	return item;
}

export async function createContractService(
	ownerId: string,
	contractId: string,
	input: CreateContractServiceInput,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const contract = await db.contract.findFirst({
		where: { id: contractId, ownerId },
	});
	if (!contract) return null;

	const budgetItem = await db.constructionBudgetItem.findFirst({
		where: {
			id: input.budgetItemId,
			ownerId,
			workId: contract.workId,
		},
		select: { type: true, description: true, unit: true },
	});
	if (!budgetItem) {
		throw new ConstructionError(
			"INVALID_BUDGET_ITEM",
			"Item de orcamento nao pertence a obra do contrato",
			422,
		);
	}

	return db.contractService.create({
		data: {
			contractId,
			type: budgetItem.type,
			description: budgetItem.description,
			parentId: null,
			unit: budgetItem.unit,
			quantity: input.quantity ?? null,
			unitCost: input.unitCost ?? null,
			totalCost: deriveServiceTotalCost(input),
			budgetItemId: input.budgetItemId,
			sortOrder: input.sortOrder ?? 0,
		},
	});
}

export async function createContractServices(
	ownerId: string,
	contractId: string,
	inputs: CreateContractServiceInput[],
	tx: Prisma.TransactionClient,
) {
	const contract = await tx.contract.findFirst({
		where: { id: contractId, ownerId },
	});
	if (!contract) return null;

	const created = [];
	for (const input of inputs) {
		const service = await createContractService(ownerId, contractId, input, tx);
		if (!service) return null;
		created.push(service);
	}
	return created;
}

export async function updateContractService(
	ownerId: string,
	contractId: string,
	serviceId: string,
	input: UpdateContractServiceInput,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const existing = await db.contractService.findFirst({
		where: { id: serviceId, contractId, contract: { ownerId } },
	});
	if (!existing) return null;

	const budgetItemId = input.budgetItemId ?? existing.budgetItemId;
	if (!budgetItemId) {
		throw new ConstructionError(
			"INVALID_BUDGET_ITEM",
			"Servico precisa estar vinculado a um item de orcamento",
			422,
		);
	}
	const contract = await db.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { workId: true },
	});
	const budgetItem = contract
		? await db.constructionBudgetItem.findFirst({
				where: { id: budgetItemId, ownerId, workId: contract.workId },
				select: { type: true, description: true, unit: true },
			})
		: null;
	if (!budgetItem) {
		throw new ConstructionError(
			"INVALID_BUDGET_ITEM",
			"Item de orcamento nao pertence a obra do contrato",
			422,
		);
	}

	const updateData = pickDefined(input, [
		"quantity",
		"unitCost",
		"budgetItemId",
		"sortOrder",
	] as (keyof typeof input)[]);
	(updateData as Record<string, unknown>).type = budgetItem.type;
	(updateData as Record<string, unknown>).description = budgetItem.description;
	(updateData as Record<string, unknown>).unit = budgetItem.unit;
	(updateData as Record<string, unknown>).budgetItemId = budgetItemId;
	(updateData as Record<string, unknown>).totalCost = deriveServiceTotalCost({
		quantity: input.quantity ?? existing.quantity,
		unitCost: input.unitCost ?? existing.unitCost,
	});

	return db.contractService.update({
		where: { id: serviceId },
		data: updateData as Record<string, unknown>,
	});
}

export async function deleteContractService(
	ownerId: string,
	contractId: string,
	serviceId: string,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const item = await db.contractService.findFirst({
		where: { id: serviceId, contractId, contract: { ownerId } },
	});
	if (!item) return null;
	await db.contractService.delete({ where: { id: serviceId, contractId } });
	return item;
}

// ContractAmendment CRUD
export async function listAmendments(ownerId: string, contractId: string) {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { id: true },
	});
	if (!contract) return null;

	const amendments = await prisma.constructionContractAmendment.findMany({
		where: { ownerId, contractId },
		orderBy: { date: "desc" },
		include: { measurements: { select: { measurementId: true } } },
	});
	return amendments.map((amendment) => ({
		...amendment,
		measurementIds: (amendment.measurements ?? []).map(
			(link) => link.measurementId,
		),
	}));
}

export async function countAmendments(ownerId: string, contractId: string) {
	return prisma.constructionContractAmendment.count({
		where: { ownerId, contractId },
	});
}

export async function createAmendment(
	ownerId: string,
	contractId: string,
	input: {
		kind: string;
		value: number;
		reason: string;
		date: string;
		createdBy: string;
		measurementIds: string[];
	},
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const contract = await db.contract.findFirst({
		where: { id: contractId, ownerId },
		select: { id: true },
	});
	if (!contract) return null;

	const measurementIds = [...new Set(input.measurementIds)];
	const measurements = await db.contractMeasurement.findMany({
		where: {
			id: { in: measurementIds },
			ownerId,
			contractId,
		},
		select: { id: true },
	});
	if (measurements.length !== measurementIds.length) {
		throw new ConstructionError(
			"CONTRACT_AMENDMENT_MEASUREMENT_INVALID",
			"Todas as medicoes do aditivo devem pertencer ao contrato",
			422,
		);
	}

	const amendment = await db.constructionContractAmendment.create({
		data: {
			ownerId,
			contractId,
			kind: input.kind,
			value: input.value,
			reason: input.reason,
			date: new Date(input.date),
			createdBy: input.createdBy,
		},
	});
	await db.contractAmendmentMeasurement.createMany({
		data: measurementIds.map((measurementId) => ({
			ownerId,
			amendmentId: amendment.id,
			measurementId,
		})),
	});
	return { ...amendment, measurementIds };
}

export async function updateAmendment(
	ownerId: string,
	contractId: string,
	amendmentId: string,
	input: UpdateContractAmendmentInput,
) {
	return prisma.$transaction(async (db) => {
		const existing = await db.constructionContractAmendment.findFirst({
			where: { id: amendmentId, ownerId, contractId },
		});
		if (!existing) return null;

		const updateData = pickDefined(input, [
			"kind",
			"value",
			"reason",
		] as (keyof typeof input)[]);
		if (input.date !== undefined)
			(updateData as Record<string, unknown>).date = new Date(input.date);

		const updated = await db.constructionContractAmendment.update({
			where: { id: amendmentId, ownerId },
			data: updateData as Record<string, unknown>,
		});

		let resolvedMeasurementIds: string[] | null = null;
		if (input.measurementIds !== undefined) {
			const measurementIds = [...new Set(input.measurementIds)];
			resolvedMeasurementIds = measurementIds;
			const measurements = await db.contractMeasurement.findMany({
				where: {
					id: { in: measurementIds },
					ownerId,
					contractId,
				},
				select: { id: true },
			});
			if (measurements.length !== measurementIds.length) {
				throw new ConstructionError(
					"CONTRACT_AMENDMENT_MEASUREMENT_INVALID",
					"Todas as medicoes do aditivo devem pertencer ao contrato",
					422,
				);
			}
			await db.contractAmendmentMeasurement.deleteMany({
				where: { amendmentId },
			});
			await db.contractAmendmentMeasurement.createMany({
				data: measurementIds.map((measurementId) => ({
					ownerId,
					amendmentId,
					measurementId,
				})),
			});
		}

		return {
			previous: existing,
			updated: {
				...updated,
				measurementIds:
					resolvedMeasurementIds ??
					(
						await db.contractAmendmentMeasurement.findMany({
							where: { amendmentId },
							select: { measurementId: true },
						})
					).map((link) => link.measurementId),
			},
		};
	});
}

export async function deleteAmendment(
	ownerId: string,
	contractId: string,
	amendmentId: string,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const item = await db.constructionContractAmendment.findFirst({
		where: { id: amendmentId, ownerId, contractId },
	});
	if (!item) return null;
	await db.constructionContractAmendment.delete({
		where: { id: amendmentId, ownerId },
	});
	return item;
}

export async function linkServicesToBudget(
	ownerId: string,
	contractId: string,
	input: LinkBudgetInput,
	tx?: Prisma.TransactionClient,
) {
	const db = tx ?? prisma;
	const contract = await db.contract.findFirst({
		where: { id: contractId, ownerId },
	});
	if (!contract) return null;

	const budgetItemIds = [...new Set(input.links.map((l) => l.budgetItemId))];
	const budgetItems = await db.constructionBudgetItem.findMany({
		where: { id: { in: budgetItemIds }, workId: contract.workId },
		select: { id: true },
	});
	if (budgetItems.length !== budgetItemIds.length) {
		throw new ConstructionError(
			"INVALID_BUDGET_ITEM",
			"Item de orcamento nao pertence a obra do contrato",
			422,
		);
	}

	const run = async (activeTx: Prisma.TransactionClient) => {
		const results = [];
		for (const link of input.links) {
			const updated = await activeTx.contractService.update({
				where: { id: link.serviceId, contractId },
				data: { budgetItemId: link.budgetItemId },
			});
			results.push(updated);
		}
		return results;
	};

	if (tx) return run(tx);
	return prisma.$transaction(run);
}
