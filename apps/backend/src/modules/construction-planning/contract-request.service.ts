import Decimal from "decimal.js";
import { canPerformRoleAction } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import { withSerializableRetry } from "../../lib/transaction-retry";
import { getBudgetItemReferences } from "./budget-control/budget-control.repository";
import {
	type ContractRequestDetail,
	contractRequestRepository,
} from "./contract-request.repository";
import { calculateQuotationSemaphore } from "./quotation-comparison";
import { findSupplierByDocument } from "./suppliers/supplier.repository";

export type ContractRequestInput = {
	title: string;
	serviceType: string;
	description: string;
	startDate: string;
	endDate: string;
	items: Array<{ budgetItemId: string; quantity: number }>;
};

function parseRequiredDate(value: string, field: string): Date {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new ConstructionError("INVALID_DATE", `${field} inválido`, 422);
	}
	return date;
}

export async function createContractRequest(
	actorId: string,
	workId: string,
	input: ContractRequestInput,
): Promise<ContractRequestDetail> {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}

	const title = input.title.trim();
	if (!title || title.length > 120) {
		throw new ConstructionError(
			"INVALID_TITLE",
			"Título da solicitação inválido",
			422,
		);
	}
	const serviceType = input.serviceType.trim();
	if (!serviceType || serviceType.length > 120) {
		throw new ConstructionError(
			"INVALID_SERVICE_TYPE",
			"Tipo de serviço da solicitação inválido",
			422,
		);
	}
	const description = input.description.trim();
	if (!description || description.length > 2_000) {
		throw new ConstructionError(
			"INVALID_DESCRIPTION",
			"Descrição da solicitação inválida",
			422,
		);
	}
	if (input.items.length === 0) {
		throw new ConstructionError(
			"EMPTY_ITEMS",
			"Selecione ao menos um item do orçamento",
			422,
		);
	}
	const indexes = new Set<string>();
	for (const item of input.items) {
		if (indexes.has(item.budgetItemId)) {
			throw new ConstructionError(
				"DUPLICATE_BUDGET_ITEM",
				"Cada item do orçamento pode ser selecionado uma vez",
				422,
			);
		}
		indexes.add(item.budgetItemId);
		if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
			throw new ConstructionError(
				"INVALID_QUANTITY",
				"Quantidade deve ser positiva",
				422,
			);
		}
	}

	const startDate = parseRequiredDate(input.startDate, "Data de início");
	const endDate = parseRequiredDate(input.endDate, "Data de fim");
	if (endDate < startDate) {
		throw new ConstructionError(
			"INVALID_PERIOD",
			"O fim do período não pode anteceder o início",
			422,
		);
	}

	const { found } = await getBudgetItemReferences(
		scope.resourceOwnerId ?? actorId,
		workId,
		input.items.map((item) => item.budgetItemId),
	);
	const referenceByInputId = new Map(
		found.map((reference) => [reference.budgetItemId, reference]),
	);
	const uncovered = input.items.find((item) => {
		const reference = referenceByInputId.get(item.budgetItemId);
		return !reference;
	});
	if (uncovered) {
		throw new ConstructionError(
			"BUDGET_VERSION_ITEM_INELIGIBLE",
			"Item do orçamento fora da versão vigente: selecione outro item",
			422,
		);
	}
	const notProjected = input.items.find(
		(item) =>
			!referenceByInputId.get(item.budgetItemId)?.operationalBudgetItemId,
	);
	if (notProjected) {
		throw new ConstructionError(
			"BUDGET_ITEM_NOT_PROJECTED",
			"Item do orçamento ainda não foi projetado para uso operacional",
			422,
		);
	}
	const persistedItems = input.items.map((item) => {
		const operationalBudgetItemId = referenceByInputId.get(
			item.budgetItemId,
		)?.operationalBudgetItemId;
		if (!operationalBudgetItemId) {
			throw new ConstructionError(
				"BUDGET_ITEM_NOT_PROJECTED",
				"Item do orçamento ainda não foi projetado para uso operacional",
				422,
			);
		}
		return {
			budgetItemId: operationalBudgetItemId,
			quantity: new Decimal(item.quantity),
		};
	});

	const request = await prisma.$transaction((tx) =>
		contractRequestRepository.createWithItems(tx, {
			ownerId: scope.resourceOwnerId ?? actorId,
			workId,
			title,
			serviceType,
			description,
			startDate,
			endDate,
			createdBy: actorId,
			items: persistedItems,
		}),
	);
	return contractRequestRepository.serializeRequest(request);
}

export async function listContractRequests(actorId: string, workId: string) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead)
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	return prisma.contractRequest.findMany({
		where: {
			ownerId: scope.resourceOwnerId,
			workId,
			status: "EM_ESPERA",
			confirmedBatchId: { not: null },
		},
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			title: true,
			serviceType: true,
			status: true,
			createdAt: true,
			contractId: true,
		},
	});
}

export async function negotiateContractRequestProposal(
	actorId: string,
	workId: string,
	requestId: string,
	proposalId: string,
	proposalValue: number,
	reason: string,
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (
		!scope.canWrite ||
		!Number.isFinite(proposalValue) ||
		proposalValue <= 0
	) {
		throw new ConstructionError(
			"INVALID_PROPOSAL_VALUE",
			"Valor negociado inválido",
			422,
		);
	}
	const normalizedReason = reason.trim();
	if (!normalizedReason || normalizedReason.length > 2_000) {
		throw new ConstructionError(
			"INVALID_NEGOTIATION_REASON",
			"Motivo da negociacao e obrigatorio",
			422,
		);
	}
	const proposal = await prisma.contractRequestProposal.findFirst({
		where: {
			id: proposalId,
			ownerId: scope.resourceOwnerId,
			workId,
			batch: { contractRequestId: requestId },
		},
		select: { id: true, proposalValue: true, originalProposalValue: true },
	});
	if (!proposal)
		throw new ConstructionError(
			"PROPOSAL_NOT_ELIGIBLE",
			"Proposta não encontrada",
			404,
		);
	if (proposalValue >= Number(proposal.proposalValue)) {
		throw new ConstructionError(
			"NEGOTIATION_MUST_REDUCE",
			"A negociação deve reduzir o valor atual",
			422,
		);
	}
	await prisma.$transaction(async (tx) => {
		await tx.contractRequestProposal.update({
			where: { id: proposal.id },
			data: { proposalValue },
		});
		await tx.auditLog.create({
			data: {
				userId: actorId,
				ownerId: scope.resourceOwnerId,
				action: "CONTRACT_REQUEST_NEGOTIATED",
				entityType: "CONTRACT_REQUEST_PROPOSAL",
				entityId: proposal.id,
				entityDescription: `Negociacao da solicitacao ${requestId}`,
				metadata: {
					previousValue: proposal.proposalValue.toString(),
					newValue: String(proposalValue),
					reason: normalizedReason,
				},
			},
		});
	});
	const originalValue = Number(
		proposal.originalProposalValue ?? proposal.proposalValue,
	);
	return {
		proposalId,
		proposalValue,
		originalProposalValue: originalValue,
		negotiationReductionAmount: originalValue - proposalValue,
		reason: normalizedReason,
	};
}

export async function selectContractRequestWinner(
	actorId: string,
	workId: string,
	requestId: string,
	proposalId: string,
	idempotencyKey: string,
	role: string | null | undefined,
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite || !canPerformRoleAction(role, "approve")) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const request = await prisma.contractRequest.findFirst({
		where: { id: requestId, ownerId: scope.resourceOwnerId, workId },
		select: { id: true, status: true, confirmedBatchId: true },
	});
	if (!request) {
		throw new ConstructionError("NOT_FOUND", "Solicitação não encontrada", 404);
	}
	if (request.status !== "EM_ESPERA" || !request.confirmedBatchId) {
		throw new ConstructionError(
			"CONTRACT_REQUEST_CONFLICT",
			"Solicitação não está aguardando seleção",
			409,
		);
	}
	const proposal = await prisma.contractRequestProposal.findFirst({
		where: {
			id: proposalId,
			batchId: request.confirmedBatchId,
			ownerId: scope.resourceOwnerId,
			workId,
		},
		select: { id: true, normalizedCnpj: true },
	});
	if (!proposal) {
		throw new ConstructionError(
			"PROPOSAL_NOT_ELIGIBLE",
			"Proposta não pertence ao mapa confirmado",
			422,
		);
	}
	const updated = await prisma.contractRequest.updateMany({
		where: {
			id: request.id,
			ownerId: scope.resourceOwnerId,
			workId,
			status: "EM_ESPERA",
		},
		data: {
			status: "AGUARDANDO_APROVACAO_FINAL",
			acceptedProposalId: proposal.id,
			acceptedBy: actorId,
		},
	});
	if (updated.count === 0) {
		throw new ConstructionError(
			"CONTRACT_REQUEST_CONFLICT",
			"A seleção já foi alterada por outro usuário",
			409,
		);
	}
	const { submitApproval } = await import("../governance/approval.service");
	let approval: Awaited<ReturnType<typeof submitApproval>>;
	try {
		approval = await submitApproval({
			actorId,
			resourceType: "CONTRACT_REQUEST",
			resourceId: request.id,
			effectAction: "CONTRACT_REQUEST_FINALIZE",
			payload: {
				workId,
				requestId: request.id,
				proposalId: proposal.id,
			},
			expectedVersion: 1,
			idempotencyKey,
		});
	} catch (error) {
		await prisma.contractRequest.updateMany({
			where: {
				id: request.id,
				ownerId: scope.resourceOwnerId,
				workId,
				status: "AGUARDANDO_APROVACAO_FINAL",
			},
			data: { status: "EM_ESPERA", acceptedProposalId: null, acceptedBy: null },
		});
		throw error;
	}
	return {
		requestId: request.id,
		status: approval.status === "PENDING" ? "PENDING" : "EXECUTED",
		approvalRequestId: approval.approvalRequestId,
		data: approval.data ?? null,
	};
}

export async function getContractRequest(
	actorId: string,
	workId: string,
	requestId: string,
): Promise<ContractRequestDetail> {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const request = await contractRequestRepository.findWithItems(
		prisma,
		actorId,
		workId,
		requestId,
	);
	if (!request) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Solicitação de contratação não encontrada",
			404,
		);
	}
	return contractRequestRepository.serializeRequest(request);
}

export async function cancelContractRequest(
	actorId: string,
	workId: string,
	requestId: string,
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const request = await prisma.contractRequest.findFirst({
		where: { id: requestId, ownerId: scope.resourceOwnerId, workId },
		select: { id: true, status: true, confirmedBatchId: true },
	});
	if (!request) {
		throw new ConstructionError("NOT_FOUND", "Solicitação não encontrada", 404);
	}
	if (request.status !== "EM_ESPERA" || request.confirmedBatchId) {
		return { cancelled: false, requestId };
	}
	await prisma.$transaction([
		prisma.importBatch.updateMany({
			where: {
				contractRequestId: request.id,
				status: { in: ["READY", "PENDING_CONFIRM", "PARSING"] },
			},
			data: {
				status: "CANCELLED",
				errorSummary: { reason: "CONTRACT_REQUEST_CANCELLED" },
			},
		}),
		prisma.contractRequest.update({
			where: { id: request.id },
			data: { status: "CANCELADA" },
		}),
	]);
	return { cancelled: true, requestId };
}

export type ContractRequestComparison = {
	request: {
		id: string;
		title: string;
		serviceType: string;
		description: string | null;
		startDate: string | null;
		endDate: string | null;
		status: string;
	};
	selectedItems: Array<{
		budgetItemId: string;
		index: string | null;
		description: string | null;
		unit: string | null;
		quantity: number;
		budgetTotal: number;
	}>;
	budget: { total: number };
	statistics: {
		budgetTotal: number;
		supplierCount: number;
		supplierLowest: number | null;
		supplierHighest: number | null;
		supplierAverage: number | null;
		lowestRatioPercent: number | null;
		averageRatioPercent: number | null;
		averageProfitMarginPercent: number | null;
		negotiatedReductionTotal: number;
		originalProposalTotal: number;
		negotiatedReductionPercent: number | null;
		classification: {
			profit: { count: number; amount: number };
			neutral: { count: number; amount: number };
			expense: { count: number; amount: number };
		};
	};
	quotation: {
		batchId: string;
		version: string | null;
		fileName: string | null;
		uploadedAt: string | null;
	} | null;
	proposals: Array<{
		id: string;
		supplier: {
			cnpj: string;
			name: string;
			registered: boolean;
			supplierId: string | null;
			linked: boolean;
		};
		proposalValue: number;
		originalProposalValue: number;
		negotiationReductionAmount: number;
		negotiationReductionPercent: number;
		profitMarginAmount: number;
		profitMarginPercent: number;
		costRatioPercent: number;
		costAlert: "GREEN" | "YELLOW" | "RED";
		semaphore: ReturnType<typeof calculateQuotationSemaphore>;
		costStatus: "PROFIT" | "NEUTRAL" | "EXPENSE";
		costDifferenceAmount: number;
		difference: { amount: number; percent: number };
		notes: string | null;
		suggestedWinner: boolean;
	}>;
	permissions: { canAccept: boolean };
};

export async function getContractRequestComparison(
	actorId: string,
	workId: string,
	requestId: string,
	role: string | null | undefined,
): Promise<ContractRequestComparison> {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const request = await prisma.contractRequest.findFirst({
		where: { id: requestId, ownerId: scope.resourceOwnerId, workId },
		include: { items: { orderBy: { sortOrder: "asc" } } },
	});
	if (!request) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Solicitação de contratação não encontrada",
			404,
		);
	}

	const references = await getBudgetItemReferences(
		scope.resourceOwnerId,
		workId,
		request.items.map((item) => item.budgetItemId),
	);
	const referenceByItem = new Map(
		references.found.map((reference) => [reference.budgetItemId, reference]),
	);
	const versionItems = await prisma.budgetVersionItem.findMany({
		where: {
			id: { in: references.found.map((reference) => reference.versionItemId) },
		},
		select: {
			id: true,
			totalCost: true,
			quantity: true,
			unitCost: true,
			description: true,
			unit: true,
		},
	});
	const versionById = new Map(
		versionItems.map((version) => [version.id, version]),
	);

	const selectedItems = request.items.map((item) => {
		const reference = referenceByItem.get(item.budgetItemId);
		const version = reference
			? versionById.get(reference.versionItemId)
			: undefined;
		return {
			budgetItemId: item.budgetItemId,
			index: reference?.index ?? null,
			description: version?.description ?? null,
			unit: version?.unit ?? null,
			quantity: Number(item.quantity),
			budgetTotal: version
				? new Decimal(item.quantity)
						.mul(
							version.unitCost ??
								(version.quantity && !version.quantity.isZero()
									? version.totalCost.div(version.quantity)
									: new Decimal(item.quantity).isZero()
										? 0
										: version.totalCost.div(new Decimal(item.quantity))),
						)
						.toNumber()
				: 0,
		};
	});
	const budgetTotal = selectedItems.reduce(
		(sum, item) => sum.plus(new Decimal(item.budgetTotal)),
		new Decimal(0),
	);
	const budgetTotalNumber = budgetTotal.toNumber();

	const proposals = request.confirmedBatchId
		? await prisma.contractRequestProposal.findMany({
				where: {
					batchId: request.confirmedBatchId,
					ownerId: scope.resourceOwnerId,
					workId,
				},
				orderBy: { proposalValue: "asc" },
			})
		: [];

	const proposalsWithSuppliers = await Promise.all(
		proposals.map(async (proposal) => {
			const supplier = await findSupplierByDocument(
				scope.resourceOwnerId,
				proposal.normalizedCnpj,
			);
			const linked =
				supplier !== null &&
				(await prisma.constructionWorkSupplier.findFirst({
					where: {
						ownerId: scope.resourceOwnerId,
						workId,
						supplierId: supplier.id,
					},
					select: { id: true },
				})) !== null;
			const value = Number(proposal.proposalValue);
			const originalProposalValue = Number(
				proposal.originalProposalValue ?? proposal.proposalValue,
			);
			const negotiationReductionAmount = Math.max(
				0,
				originalProposalValue - value,
			);
			const negotiationReductionPercent =
				originalProposalValue === 0
					? 0
					: (negotiationReductionAmount / originalProposalValue) * 100;
			const costRatioPercent =
				budgetTotalNumber === 0 ? 0 : (value / budgetTotalNumber) * 100;
			const semaphore = calculateQuotationSemaphore(budgetTotal, value);
			const profitMarginAmount =
				budgetTotalNumber === 0 ? 0 : budgetTotalNumber - value;
			const profitMarginPercent =
				budgetTotalNumber === 0
					? 0
					: (profitMarginAmount / budgetTotalNumber) * 100;
			const costAlert: "GREEN" | "YELLOW" | "RED" =
				semaphore.status === "GREEN"
					? "GREEN"
					: semaphore.status === "YELLOW"
						? "YELLOW"
						: "RED";
			const costStatus: "PROFIT" | "NEUTRAL" | "EXPENSE" =
				budgetTotalNumber === 0
					? "NEUTRAL"
					: costRatioPercent <= 90
						? "PROFIT"
						: costRatioPercent <= 100
							? "NEUTRAL"
							: "EXPENSE";
			const costDifferenceAmount =
				budgetTotalNumber === 0 ? 0 : budgetTotalNumber - value;
			return {
				id: proposal.id,
				supplier: {
					cnpj: proposal.normalizedCnpj,
					name: proposal.supplierName,
					registered: supplier !== null,
					supplierId: supplier?.id ?? null,
					linked,
				},
				proposalValue: value,
				originalProposalValue,
				negotiationReductionAmount,
				negotiationReductionPercent,
				profitMarginAmount,
				profitMarginPercent,
				costRatioPercent,
				costAlert,
				semaphore,
				costStatus,
				costDifferenceAmount,
				difference: {
					amount: value - budgetTotalNumber,
					percent:
						budgetTotalNumber === 0
							? 0
							: ((value - budgetTotalNumber) / budgetTotalNumber) * 100,
				},
				notes: proposal.notes,
				suggestedWinner: proposal.suggestedWinner,
			};
		}),
	);
	const proposalValues = proposalsWithSuppliers.map(
		(proposal) => proposal.proposalValue,
	);
	const supplierLowest = proposalValues.length
		? Math.min(...proposalValues)
		: null;
	const supplierHighest = proposalValues.length
		? Math.max(...proposalValues)
		: null;
	const supplierAverage = proposalValues.length
		? proposalValues.reduce((sum, value) => sum + value, 0) /
			proposalValues.length
		: null;
	const classification = proposalsWithSuppliers.reduce(
		(result, proposal) => {
			if (proposal.costStatus === "PROFIT") {
				result.profit.count += 1;
				result.profit.amount += proposal.costDifferenceAmount;
			} else if (proposal.costStatus === "NEUTRAL") {
				result.neutral.count += 1;
				result.neutral.amount += proposal.costDifferenceAmount;
			} else {
				result.expense.count += 1;
				result.expense.amount += Math.abs(proposal.costDifferenceAmount);
			}
			return result;
		},
		{
			profit: { count: 0, amount: 0 },
			neutral: { count: 0, amount: 0 },
			expense: { count: 0, amount: 0 },
		},
	);
	const negotiatedReductionTotal = proposalsWithSuppliers.reduce(
		(sum, proposal) => sum + proposal.negotiationReductionAmount,
		0,
	);
	const originalProposalTotal = proposalsWithSuppliers.reduce(
		(sum, proposal) => sum + proposal.originalProposalValue,
		0,
	);

	return {
		request: {
			id: request.id,
			title: request.title,
			serviceType: request.serviceType,
			description: request.description,
			startDate: request.startDate?.toISOString() ?? null,
			endDate: request.endDate?.toISOString() ?? null,
			status: request.status,
		},
		selectedItems,
		budget: { total: budgetTotalNumber },
		statistics: {
			budgetTotal: budgetTotalNumber,
			supplierCount: proposalValues.length,
			supplierLowest,
			supplierHighest,
			supplierAverage,
			lowestRatioPercent:
				supplierLowest === null || budgetTotalNumber === 0
					? null
					: (supplierLowest / budgetTotalNumber) * 100,
			averageRatioPercent:
				supplierAverage === null || budgetTotalNumber === 0
					? null
					: (supplierAverage / budgetTotalNumber) * 100,
			averageProfitMarginPercent:
				supplierAverage === null || budgetTotalNumber === 0
					? null
					: ((budgetTotalNumber - supplierAverage) / budgetTotalNumber) * 100,
			negotiatedReductionTotal,
			originalProposalTotal,
			negotiatedReductionPercent:
				originalProposalTotal === 0
					? null
					: (negotiatedReductionTotal / originalProposalTotal) * 100,
			classification,
		},
		quotation: request.confirmedBatchId
			? {
					batchId: request.confirmedBatchId,
					version: null,
					fileName: null,
					uploadedAt: null,
				}
			: null,
		proposals: proposalsWithSuppliers,
		permissions: {
			canAccept:
				canPerformRoleAction(role, "approve") &&
				request.status === "EM_ESPERA" &&
				proposals.length > 0,
		},
	};
}

export type ContractRequestAcceptance = {
	requestId: string;
	status: "ACEITA";
	acceptedProposalId: string;
	contract: {
		id: string;
		code: string | null;
		status: string | null;
		supplierId: string | null;
		supplierName: string | null;
		contractValue: number | null;
	};
	acceptedAt: string;
	acceptedBy: string;
};

export async function acceptContractRequest(
	actorId: string,
	workId: string,
	requestId: string,
	proposalId: string,
	_idempotencyKey: string | undefined,
	role: string | null | undefined,
): Promise<ContractRequestAcceptance> {
	// Deprecated compatibility helper. Public routing now delegates to
	// selectContractRequestWinner, so no HTTP path can create a contract from
	// the initial selection anymore. Kept temporarily for old internal callers
	// until Release B removes the legacy command surface.
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	if (!canPerformRoleAction(role, "approve")) {
		throw new ConstructionError(
			"FORBIDDEN",
			"Apenas aprovadores podem escolher o fornecedor",
			403,
		);
	}

	return withSerializableRetry(async (tx) => {
		const request = await tx.contractRequest.findFirst({
			where: { id: requestId, ownerId: actorId, workId },
			include: { items: { orderBy: { sortOrder: "asc" } } },
		});
		if (!request) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Solicitação de contratação não encontrada",
				404,
			);
		}
		if (request.status === "ACEITA") {
			if (!request.contractId || !request.acceptedProposalId) {
				throw new ConstructionError(
					"CONTRACT_REQUEST_CONFLICT",
					"Solicitação aceita sem contrato resultante",
					409,
				);
			}
			const contract = await tx.contract.findFirst({
				where: {
					id: request.contractId,
					ownerId: actorId,
					workId,
				},
			});
			return {
				requestId: request.id,
				status: "ACEITA",
				acceptedProposalId: request.acceptedProposalId,
				contract: {
					id: request.contractId,
					code: contract?.code ?? null,
					status: contract?.status ?? null,
					supplierId: contract?.supplierId ?? null,
					supplierName: contract?.supplierName ?? null,
					contractValue: contract ? Number(contract.contractValue) : null,
				},
				acceptedAt:
					request.acceptedAt?.toISOString() ?? new Date().toISOString(),
				acceptedBy: request.acceptedBy ?? actorId,
			};
		}
		if (request.status !== "EM_ESPERA" || !request.confirmedBatchId) {
			throw new ConstructionError(
				"CONTRACT_REQUEST_CONFLICT",
				"Solicitação não está aguardando aceite",
				409,
			);
		}

		const proposal = await tx.contractRequestProposal.findFirst({
			where: {
				id: proposalId,
				batchId: request.confirmedBatchId,
				ownerId: actorId,
				workId,
			},
		});
		if (!proposal) {
			throw new ConstructionError(
				"PROPOSAL_NOT_ELIGIBLE",
				"Proposta não pertence ao mapa confirmado",
				422,
			);
		}
		const supplier = await tx.constructionSupplier.findFirst({
			where: { ownerId: actorId, document: proposal.normalizedCnpj },
		});

		const contractCount = await tx.contract.count({
			where: { ownerId: actorId, workId },
		});
		const code = `CT-${String(contractCount + 1).padStart(3, "0")}`;
		const contract = await tx.contract.create({
			data: {
				ownerId: actorId,
				workId,
				code,
				supplierId: supplier?.id ?? null,
				supplierName: proposal.supplierName,
				contractValue: proposal.proposalValue,
				serviceType: request.serviceType,
				title: request.title,
				startDate: request.startDate,
				endDate: request.endDate,
				notes: request.description,
				status: "RASCUNHO",
				contractRequestId: request.id,
				createdBy: actorId,
			},
		});

		const references = await getBudgetItemReferences(
			actorId,
			workId,
			request.items.map((item) => item.budgetItemId),
			tx,
		);
		const referenceByItem = new Map(
			references.found.map((reference) => [reference.budgetItemId, reference]),
		);
		for (const item of request.items) {
			const reference = referenceByItem.get(item.budgetItemId);
			await tx.contractService.create({
				data: {
					contractId: contract.id,
					type: "ITEM",
					description: reference?.index ?? item.budgetItemId,
					unit: null,
					quantity: item.quantity,
					unitCost: null,
					totalCost: null,
					budgetItemId: item.budgetItemId,
					sortOrder: item.sortOrder,
				},
			});
		}

		const now = new Date();
		await tx.contractRequest.update({
			where: { id: request.id },
			data: {
				status: "ACEITA",
				acceptedProposalId: proposal.id,
				acceptedAt: now,
				acceptedBy: actorId,
				contractId: contract.id,
			},
		});

		return {
			requestId: request.id,
			status: "ACEITA",
			acceptedProposalId: proposal.id,
			contract: {
				id: contract.id,
				code,
				status: "RASCUNHO",
				supplierId: supplier?.id ?? null,
				supplierName: proposal.supplierName,
				contractValue: Number(proposal.proposalValue),
			},
			acceptedAt: now.toISOString(),
			acceptedBy: actorId,
		};
	});
}

export async function revertContractRequestAcceptance(
	actorId: string,
	workId: string,
	requestId: string,
	role: string | null | undefined,
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	if (!canPerformRoleAction(role, "approve")) {
		throw new ConstructionError(
			"FORBIDDEN",
			"Apenas aprovadores podem reverter a escolha",
			403,
		);
	}

	return withSerializableRetry(async (tx) => {
		const request = await tx.contractRequest.findFirst({
			where: { id: requestId, ownerId: actorId, workId },
			select: {
				id: true,
				status: true,
				contractId: true,
				acceptedProposalId: true,
			},
		});
		if (!request) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Solicitação de contratação não encontrada",
				404,
			);
		}
		if (request.status !== "ACEITA" || !request.contractId) {
			throw new ConstructionError(
				"CONTRACT_REQUEST_CONFLICT",
				"A solicitação ainda não possui um aceite para reverter",
				409,
			);
		}

		const contract = await tx.contract.findFirst({
			where: { id: request.contractId, ownerId: actorId, workId },
			select: {
				id: true,
				status: true,
				instrumentGeneratedAt: true,
				_count: {
					select: {
						measurements: true,
						payments: true,
						folders: true,
						amendments: true,
					},
				},
			},
		});
		if (!contract) {
			throw new ConstructionError(
				"CONTRACT_REQUEST_CONFLICT",
				"Contrato resultante não encontrado",
				409,
			);
		}
		const hasRegisteredData =
			contract.status !== "RASCUNHO" ||
			contract.instrumentGeneratedAt !== null ||
			contract._count.measurements > 0 ||
			contract._count.payments > 0 ||
			contract._count.folders > 0 ||
			contract._count.amendments > 0;
		if (hasRegisteredData) {
			throw new ConstructionError(
				"CONTRACT_REQUEST_REVERT_BLOCKED",
				"Não é possível voltar para a cotação após cadastrar medições, pagamentos, documentos ou aditivos",
				409,
			);
		}

		await tx.contract.delete({ where: { id: contract.id } });
		await tx.contractRequest.update({
			where: { id: request.id },
			data: {
				status: "EM_ESPERA",
				contractId: null,
				acceptedProposalId: null,
				acceptedAt: null,
				acceptedBy: null,
			},
		});

		return { requestId: request.id, reverted: true, status: "EM_ESPERA" };
	});
}
