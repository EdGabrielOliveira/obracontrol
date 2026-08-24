import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { createContractWithEffectsInTx } from "./contracts/contract-creation.service";
import { calculateQuotationSemaphore } from "./quotation-comparison";
import { getWorkOrThrow } from "./repository";
import {
	findSupplierByDocument,
	getSupplierById,
} from "./suppliers/supplier.repository";

export type QuotationProposalInput = {
	supplierId?: string | null;
	supplierDocument?: string | null;
	supplierName: string;
	value: number;
	justification?: string | null;
};

export type QuotationView = {
	id: string;
	workId: string;
	contractCode: string | null;
	serviceType: string | null;
	title: string;
	observation: string | null;
	status: string;
	maxSuppliers: number;
	contractId: string | null;
	items: Array<{
		id?: string;
		budgetItemId: string;
		quantity: number;
		budgetItem?: {
			id: string;
			index: string;
			description: string;
			unit: string | null;
			unitCost: number | null;
			totalCost: number | null;
		};
	}>;
	proposals: Array<{
		id: string;
		supplierId: string | null;
		supplierName: string;
		supplierDocument: string | null;
		supplierAddress: string | null;
		supplierPhone: string | null;
		supplierEmail: string | null;
		supplierResponsible: string | null;
		serviceDescription: string | null;
		value: number;
		serviceStartDate: string | null;
		executionTermDays: number | null;
		paymentTerms: string | null;
		notes: string | null;
		justification: string | null;
		isWinner: boolean;
	}>;
	createdAt: string;
};

export type QuotationComparison = Omit<QuotationView, "proposals"> & {
	budgetTotal: number | null;
	proposals: Array<
		QuotationView["proposals"][number] & {
			supplierRegistered: boolean;
			differenceFromBudget: number | null;
			originalValue: number;
			negotiatedValue: number;
			semaphore: ReturnType<typeof calculateQuotationSemaphore>;
			round: number | null;
			negotiationHistory: Array<{
				previousValue: number;
				newValue: number;
				actorId: string;
				reason: string;
				createdAt: string;
			}>;
		}
	>;
};

const MAX_PROPOSALS_DEFAULT = 3;

function normalizeSupplierDocument(raw?: string | null): string | null {
	if (raw == null) return null;
	const digits = raw.replace(/\D/g, "");
	if (!digits) return null;
	if (digits.length !== 14) {
		throw new ConstructionError("INVALID_CNPJ", "CNPJ invalido", 400);
	}
	return digits;
}

function toView(row: {
	id: string;
	workId: string;
	contractCode?: string | null;
	serviceType?: string | null;
	title: string;
	observation: string | null;
	status: string;
	maxSuppliers: number;
	contractId: string | null;
	createdAt: Date;
	proposals: Array<{
		id: string;
		supplierId?: string | null;
		supplierName: string;
		supplierDocument?: string | null;
		supplierAddress?: string | null;
		supplierPhone?: string | null;
		supplierEmail?: string | null;
		supplierResponsible?: string | null;
		serviceDescription?: string | null;
		value: Decimal | number;
		serviceStartDate?: Date | string | null;
		executionTermDays?: number | null;
		paymentTerms?: string | null;
		notes?: string | null;
		justification: string | null;
		isWinner: boolean;
	}>;
	budgetItems?: Array<{
		id: string;
		budgetItemId: string;
		quantity: Decimal | number;
		budgetItem?: {
			id: string;
			index: string;
			description: string;
			unit: string | null;
			unitCost: Decimal | number | null;
			totalCost: Decimal | number | null;
		};
	}>;
}): QuotationView {
	return {
		id: row.id,
		workId: row.workId,
		contractCode: row.contractCode ?? null,
		serviceType: row.serviceType ?? null,
		title: row.title,
		observation: row.observation,
		status: row.status,
		maxSuppliers: row.maxSuppliers,
		contractId: row.contractId,
		items: (row.budgetItems ?? []).map((item) => ({
			id: item.id,
			budgetItemId: item.budgetItemId,
			quantity: Number(item.quantity),
			budgetItem: item.budgetItem
				? {
						id: item.budgetItem.id,
						index: item.budgetItem.index,
						description: item.budgetItem.description,
						unit: item.budgetItem.unit,
						unitCost:
							item.budgetItem.unitCost == null
								? null
								: Number(item.budgetItem.unitCost),
						totalCost:
							item.budgetItem.totalCost == null
								? null
								: Number(item.budgetItem.totalCost),
					}
				: undefined,
		})),
		proposals: row.proposals.map((p) => ({
			id: p.id,
			supplierId: p.supplierId ?? null,
			supplierName: p.supplierName,
			supplierDocument: p.supplierDocument ?? null,
			supplierAddress: p.supplierAddress ?? null,
			supplierPhone: p.supplierPhone ?? null,
			supplierEmail: p.supplierEmail ?? null,
			supplierResponsible: p.supplierResponsible ?? null,
			serviceDescription: p.serviceDescription ?? null,
			value: Number(p.value),
			serviceStartDate:
				p.serviceStartDate == null
					? null
					: p.serviceStartDate instanceof Date
						? p.serviceStartDate.toISOString()
						: new Date(p.serviceStartDate).toISOString(),
			executionTermDays: p.executionTermDays ?? null,
			paymentTerms: p.paymentTerms ?? null,
			notes: p.notes ?? null,
			justification: p.justification,
			isWinner: p.isWinner,
		})),
		createdAt: row.createdAt.toISOString(),
	};
}

export const quotationService = {
	async create(
		ownerId: string,
		workId: string,
		input: {
			serviceType?: string | null;
			title: string;
			observation?: string | null;
			startDate?: string | null;
			endDate?: string | null;
			maxSuppliers?: number;
			items: Array<{ budgetItemId: string; quantity: number }>;
		},
		ctx: { userId: string },
	): Promise<QuotationView> {
		await getWorkOrThrow(ownerId, workId);
		if (!input.title.trim()) {
			throw new ConstructionError("INVALID_INPUT", "Titulo obrigatorio", 400);
		}
		if (input.items.length === 0) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Selecione ao menos uma etapa ou item do orcamento",
				400,
			);
		}
		const itemIds = input.items.map((item) => item.budgetItemId);
		if (new Set(itemIds).size !== itemIds.length) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Nao repita itens do orcamento",
				400,
			);
		}
		const budgetItems =
			itemIds.length === 0
				? []
				: await prisma.constructionBudgetItem.findMany({
						where: { ownerId, workId, id: { in: itemIds } },
						select: {
							id: true,
							index: true,
							description: true,
							unit: true,
							unitCost: true,
							totalCost: true,
						},
					});
		const budgetItemById = new Map(budgetItems.map((item) => [item.id, item]));
		if (budgetItems.length !== itemIds.length) {
			throw new ConstructionError(
				"INVALID_BUDGET_ITEM",
				"Um ou mais itens nao pertencem a obra",
				422,
			);
		}
		const maxSuppliers = Math.min(
			Math.max(input.maxSuppliers ?? MAX_PROPOSALS_DEFAULT, 1),
			5,
		);
		const created = await prisma.$transaction(async (tx) => {
			const quotation = await tx.quotation.create({
				data: {
					ownerId,
					workId,
					contractCode: null,
					serviceType: input.serviceType?.trim() || null,
					title: input.title.trim(),
					observation: input.observation ?? null,
					startDate: input.startDate ? new Date(input.startDate) : null,
					endDate: input.endDate ? new Date(input.endDate) : null,
					status: "EM_COTACAO",
					maxSuppliers,
					createdBy: ctx.userId,
				},
				include: { proposals: true },
			});
			if (input.items.length > 0) {
				await tx.quotationBudgetItem.createMany({
					data: input.items.map((item) => ({
						ownerId,
						workId,
						quotationId: quotation.id,
						budgetItemId: item.budgetItemId,
						quantity: item.quantity,
					})),
				});
			}
			await tx.quotationRound.create({
				data: {
					quotationId: quotation.id,
					roundNumber: 1,
					createdBy: ctx.userId,
				},
			});
			return {
				...quotation,
				budgetItems: input.items.map((item) => ({
					id: `new-${item.budgetItemId}`,
					budgetItemId: item.budgetItemId,
					quantity: item.quantity,
					budgetItem: budgetItemById.get(item.budgetItemId),
				})),
			};
		});
		return toView(created);
	},

	async get(ownerId: string, quotationId: string): Promise<QuotationView> {
		const row = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId },
			include: {
				proposals: { orderBy: { value: "asc" } },
				budgetItems: {
					include: { budgetItem: true },
					orderBy: { createdAt: "asc" },
				},
				rounds: {
					orderBy: { roundNumber: "asc" },
					include: {
						events: { orderBy: { createdAt: "asc" } },
					},
				},
			},
		});
		if (!row) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		return toView(row);
	},

	async getComparison(
		ownerId: string,
		workId: string,
		quotationId: string,
	): Promise<QuotationComparison> {
		const row = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId, workId },
			include: {
				proposals: { orderBy: { value: "asc" } },
				budgetItems: {
					include: { budgetItem: true },
					orderBy: { createdAt: "asc" },
				},
				rounds: {
					orderBy: { roundNumber: "asc" },
					include: {
						events: { orderBy: { createdAt: "asc" } },
					},
				},
			},
		});
		if (!row) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}

		const view = toView(row);
		const rawBudgetItems = row.budgetItems ?? [];
		const supplierIdsByDocument = new Map<string, string>();
		await Promise.all(
			view.proposals.map(async (proposal) => {
				if (!proposal.supplierDocument) return;
				const supplier = await findSupplierByDocument(
					ownerId,
					proposal.supplierDocument,
				);
				if (supplier) {
					supplierIdsByDocument.set(proposal.supplierDocument, supplier.id);
				}
			}),
		);
		const hasCompleteBudgetValues = view.items.every(
			(item) => item.budgetItem?.unitCost != null,
		);
		const budgetTotalDecimal = hasCompleteBudgetValues
			? rawBudgetItems.reduce(
					(total, item) =>
						total.plus(
							new Decimal(item.quantity.toString()).mul(
								item.budgetItem?.unitCost?.toString() ?? 0,
							),
						),
					new Decimal(0),
				)
			: null;
		const budgetTotal = budgetTotalDecimal?.toNumber() ?? null;
		const rounds = row.rounds ?? [];
		const latestRound = rounds[rounds.length - 1];

		return {
			...view,
			budgetTotal,
			proposals: view.proposals.map((proposal) => {
				const resolvedSupplierId = proposal.supplierDocument
					? (supplierIdsByDocument.get(proposal.supplierDocument) ?? null)
					: proposal.supplierId;
				return {
					...proposal,
					supplierId: resolvedSupplierId,
					supplierRegistered:
						proposal.supplierDocument != null &&
						supplierIdsByDocument.has(proposal.supplierDocument),
					differenceFromBudget:
						budgetTotal == null ? null : proposal.value - budgetTotal,
					originalValue: proposal.value,
					negotiatedValue: proposal.value,
					semaphore: calculateQuotationSemaphore(
						budgetTotalDecimal ?? 0,
						new Decimal(proposal.value),
					),
					round: latestRound?.roundNumber ?? null,
					negotiationHistory: rounds.flatMap((round) =>
						round.events
							.filter((event) => event.proposalId === proposal.id)
							.map((event) => ({
								previousValue: Number(event.previousValue),
								newValue: Number(event.newValue),
								actorId: event.actorId,
								reason: event.reason,
								createdAt: event.createdAt.toISOString(),
							})),
					),
				};
			}),
		};
	},

	async list(ownerId: string, workId: string): Promise<QuotationView[]> {
		const rows = await prisma.quotation.findMany({
			where: { ownerId, workId },
			orderBy: { createdAt: "desc" },
			include: {
				proposals: { orderBy: { value: "asc" } },
				budgetItems: {
					include: { budgetItem: true },
					orderBy: { createdAt: "asc" },
				},
			},
		});
		return rows.map(toView);
	},

	// DEC-003: ate maxSuppliers propostas por cotacao (padrao 3).
	async addProposal(
		ownerId: string,
		quotationId: string,
		input: QuotationProposalInput,
	): Promise<QuotationView> {
		const quotation = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId },
			include: { proposals: true },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		if (quotation.status === "CONTRATADA") {
			throw new ConstructionError(
				"QUOTATION_CLOSED",
				"Cotacao ja contratada: nao aceita novas propostas",
				409,
			);
		}
		if (quotation.proposals.length >= quotation.maxSuppliers) {
			throw new ConstructionError(
				"QUOTATION_MAX_PROPOSALS",
				`Limite de ${quotation.maxSuppliers} propostas atingido`,
				422,
			);
		}
		if (!input.supplierName.trim()) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Nome do fornecedor obrigatorio",
				400,
			);
		}
		if (input.value <= 0) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Valor da proposta deve ser positivo",
				400,
			);
		}
		const supplierDocument = normalizeSupplierDocument(input.supplierDocument);
		const duplicate = quotation.proposals.find(
			(p) =>
				(supplierDocument && p.supplierDocument === supplierDocument) ||
				(!supplierDocument &&
					p.supplierName.trim().toLowerCase() ===
						input.supplierName.trim().toLowerCase()),
		);
		if (duplicate) {
			throw new ConstructionError(
				"DUPLICATE_PROPOSAL",
				"Ja existe proposta deste fornecedor",
				409,
			);
		}

		await prisma.quotationProposal.create({
			data: {
				quotationId,
				supplierId: input.supplierId ?? null,
				supplierDocument,
				supplierName: input.supplierName.trim(),
				value: new Decimal(input.value),
				justification: input.justification ?? null,
			},
		});

		const nextStatus =
			quotation.status === "EM_COTACAO" ? "NEGOCIACAO" : quotation.status;
		if (nextStatus !== quotation.status) {
			await prisma.quotation.update({
				where: { id: quotationId },
				data: { status: nextStatus },
			});
		}

		return this.get(ownerId, quotationId);
	},

	// Reuniao 06/08: sessao de negociacao — edita valor com justificativa.
	async negotiate(
		ownerId: string,
		quotationId: string,
		proposalId: string,
		input: { value: number; justification: string },
		ctx: { userId: string } = { userId: ownerId },
	): Promise<QuotationView> {
		const quotation = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		if (quotation.status === "CONTRATADA") {
			throw new ConstructionError(
				"QUOTATION_CLOSED",
				"Cotacao ja contratada: negociacao encerrada",
				409,
			);
		}
		if (input.value <= 0) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Valor da proposta deve ser positivo",
				400,
			);
		}
		if (!input.justification.trim()) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Justificativa obrigatoria na negociacao",
				400,
			);
		}
		const proposal = await prisma.quotationProposal.findFirst({
			where: { id: proposalId, quotationId },
			select: { id: true, value: true },
		});
		if (!proposal) {
			throw new ConstructionError("NOT_FOUND", "Proposta nao encontrada", 404);
		}
		await prisma.$transaction(async (tx) => {
			let round = await tx.quotationRound.findFirst({
				where: { quotationId },
				orderBy: { roundNumber: "desc" },
			});
			if (!round) {
				round = await tx.quotationRound.create({
					data: { quotationId, roundNumber: 1, createdBy: ctx.userId },
				});
			}
			await tx.proposalNegotiationEvent.create({
				data: {
					roundId: round.id,
					proposalId,
					previousValue: proposal.value,
					newValue: new Decimal(input.value),
					actorId: ctx.userId,
					reason: input.justification.trim(),
				},
			});
			await tx.quotationProposal.update({
				where: { id: proposalId },
				data: {
					value: new Decimal(input.value),
					justification: input.justification.trim(),
				},
			});
			await tx.auditLog.create({
				data: {
					userId: ctx.userId,
					ownerId,
					action: "QUOTATION_NEGOTIATED",
					entityType: "QUOTATION_PROPOSAL",
					entityId: proposalId,
					entityDescription: `Negociacao da cotacao ${quotation.title}`,
					metadata: {
						quotationId,
						previousValue: proposal.value.toString(),
						newValue: String(input.value),
					},
				},
			});
		});
		return this.get(ownerId, quotationId);
	},

	// Abre uma nova rodada sem apagar as propostas já recebidas. A próxima
	// rodada continua usando o mesmo registro até a migração para histórico
	// explícito de rodadas; nenhuma proposta existente é sobrescrita.
	async requote(ownerId: string, quotationId: string): Promise<QuotationView> {
		const quotation = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		if (quotation.status === "CONTRATADA") {
			throw new ConstructionError(
				"QUOTATION_CLOSED",
				"Cotacao ja contratada: nao aceita recotacao",
				409,
			);
		}
		await prisma.$transaction(async (tx) => {
			const latest = await tx.quotationRound.findFirst({
				where: { quotationId },
				orderBy: { roundNumber: "desc" },
			});
			await tx.quotationRound.create({
				data: {
					quotationId,
					roundNumber: (latest?.roundNumber ?? 0) + 1,
				},
			});
			await tx.quotation.update({
				where: { id: quotationId },
				data: { status: "EM_COTACAO" },
			});
			await tx.auditLog.create({
				data: {
					userId: ownerId,
					ownerId,
					action: "QUOTATION_REQUOTED",
					entityType: "QUOTATION",
					entityId: quotationId,
					entityDescription: `Recotacao ${quotation.title}`,
					metadata: { roundNumber: (latest?.roundNumber ?? 0) + 1 },
				},
			});
		});
		return this.get(ownerId, quotationId);
	},

	async revertContract(
		ownerId: string,
		workId: string,
		quotationId: string,
		ctx: { userId: string },
	): Promise<QuotationView> {
		const quotation = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId, workId },
			select: { id: true, contractId: true, status: true, title: true },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		if (!quotation.contractId) {
			throw new ConstructionError(
				"QUOTATION_CONFLICT",
				"A cotacao ainda nao possui um contrato para reverter",
				409,
			);
		}

		await prisma.$transaction(async (tx) => {
			const contract = await tx.contract.findFirst({
				where: { id: quotation.contractId ?? "", ownerId, workId },
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
					"QUOTATION_CONFLICT",
					"Contrato resultante nao encontrado",
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
					"QUOTATION_REVERT_BLOCKED",
					"Nao e possivel voltar para a cotacao apos cadastrar medicoes, pagamentos, documentos ou aditivos",
					409,
				);
			}

			await tx.contract.delete({ where: { id: contract.id } });
			await tx.quotationProposal.updateMany({
				where: { quotationId: quotation.id },
				data: { isWinner: false },
			});
			await tx.quotation.update({
				where: { id: quotation.id },
				data: { status: "NEGOCIACAO", contractId: null },
			});
			await tx.auditLog.create({
				data: {
					userId: ctx.userId,
					ownerId,
					action: "QUOTATION_REVERTED",
					entityType: "QUOTATION",
					entityId: quotation.id,
					entityDescription: `Retorno da cotacao ${quotation.title}`,
					metadata: { revertedContractId: contract.id },
				},
			});
		});

		return this.get(ownerId, quotationId);
	},

	// Escolhe o vencedor e delega a criação do contrato ao gateway único.
	// O gateway valida cobertura/ledger e só então vincula a cotação.
	async chooseWinner(
		ownerId: string,
		quotationId: string,
		proposalId: string,
		ctx: { userId: string },
	): Promise<QuotationView> {
		const quotation = await prisma.quotation.findFirst({
			where: { id: quotationId, ownerId },
			include: { proposals: true },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		if (quotation.status === "CONTRATADA") {
			throw new ConstructionError(
				"QUOTATION_CLOSED",
				"Cotacao ja contratada",
				409,
			);
		}
		const winner = quotation.proposals.find((p) => p.id === proposalId);
		if (!winner) {
			throw new ConstructionError("NOT_FOUND", "Proposta nao encontrada", 404);
		}
		const winnerSupplier = winner.supplierId
			? (await getSupplierById(ownerId, winner.supplierId))?.id
			: winner.supplierDocument
				? (await findSupplierByDocument(ownerId, winner.supplierDocument))?.id
				: null;
		await prisma.$transaction(async (tx) => {
			// A escolha é uma etapa própria. Quando o fornecedor ainda não existe,
			// registre o vencedor e aguarde o cadastro antes de criar o contrato.
			if (!winnerSupplier) {
				await tx.quotationProposal.updateMany({
					where: { quotationId },
					data: { isWinner: false },
				});
				await tx.quotationProposal.update({
					where: { id: proposalId },
					data: { isWinner: true },
				});
				await tx.quotation.update({
					where: { id: quotationId },
					data: { status: "ESCOLHIDA", contractId: null },
				});
				return;
			}

			const quotationItems = await tx.quotationBudgetItem.findMany({
				where: { quotationId, ownerId, workId: quotation.workId },
				include: { budgetItem: true },
				orderBy: { createdAt: "asc" },
			});
			if (quotationItems.length === 0) {
				throw new ConstructionError(
					"INVALID_INPUT",
					"Solicitacao sem etapa ou item de orcamento",
					422,
				);
			}
			if (quotationItems.some((item) => item.budgetItem.unitCost == null)) {
				throw new ConstructionError(
					"BUDGET_VERSION_NOT_AVAILABLE",
					"Item da cotação sem custo unitário elegível",
					422,
				);
			}
			const gateway = await createContractWithEffectsInTx(tx, {
				resourceOwnerId: ownerId,
				actorId: ctx.userId,
				workId: quotation.workId,
				origin: { type: "QUOTATION", quotationId },
				supplier: { name: winner.supplierName, supplierId: winnerSupplier },
				contract: {
					code: `Q-${quotation.id}`,
					serviceType: quotation.serviceType,
					title: quotation.title,
					contractValue: Number(winner.value),
					startDate: quotation.startDate,
					endDate: quotation.endDate,
					status: "RASCUNHO",
					notes: quotation.observation,
				},
				services: quotationItems.map((item) => ({
					budgetItemId: item.budgetItemId,
					description: item.budgetItem.description,
					quantity: Number(item.quantity),
					unitCost: Number(item.budgetItem.unitCost),
				})),
				idempotencyKey: `quotation:${quotationId}:winner:${proposalId}`,
			});

			await tx.quotationProposal.updateMany({
				where: { quotationId },
				data: { isWinner: false },
			});
			await tx.quotationProposal.update({
				where: { id: proposalId },
				data: { isWinner: true },
			});
			await tx.quotation.update({
				where: { id: quotationId },
				data: { status: "CONTRATADA", contractId: gateway.contract.id },
			});
			await tx.auditLog.create({
				data: {
					userId: ctx.userId,
					ownerId,
					action: "APPROVE",
					entityType: "QUOTATION",
					entityId: quotationId,
					entityDescription: `Aprovacao da cotacao ${quotation.title}`,
					newState: {
						status: "CONTRATADA",
						contractId: gateway.contract.id,
						proposalId,
					},
					metadata: { approverId: ctx.userId },
				},
			});

			return gateway;
		});

		return this.get(ownerId, quotationId);
	},
};
