import type { Prisma } from "@prisma/client";
import { writeAudit } from "../../lib/audit-writer";
import { normalizeRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import { validateStatusTransition } from "../../lib/status-machine";
import { withSerializableRetry } from "../../lib/transaction-retry";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../governance/notification.service";
import { findActiveImpactsBySource } from "./budget-control/budget-control.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import type {
	BudgetApplyContext,
	BudgetMutationResult,
} from "./budget-control/budget-control.types";
import { withOverflowApproval } from "./budget-control/overflow-approval";
import * as contractRepository from "./contract.repository";
import { CONTRACT_TRANSITIONS } from "./contract-status";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "./governance-guard";
import { generateContractInstrumentArtifact } from "./instrument/artifact.service";
import {
	AMENDMENT_SOURCE_TYPE,
	COMPONENT_AMENDMENT,
	COMPONENT_BASE,
	competenceOf,
	resolveLedgerItemRef,
	SERVICE_SOURCE_TYPE,
} from "./ledger/ledger.integration";
import { findLedgerEventsBySourcePrefix } from "./ledger/ledger.repository";
import { getWorkOrThrow } from "./repository";
import type {
	ContractServicePreviewInput,
	ContractServicePreviewResult,
	CreateContractAmendmentInput,
	CreateContractInput,
	CreateContractServiceInput,
	CreateContractServicesInput,
	LinkBudgetInput,
	UpdateContractAmendmentInput,
	UpdateContractInput,
	UpdateContractServiceInput,
} from "./schemas/contract.schema";
import {
	findWorkSupplier,
	getSupplierById,
} from "./suppliers/supplier.repository";

export class ContractService {
	constructor(
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
	) {}

	private async assertWritable(
		ownerId: string,
		workId: string,
		contractId?: string,
	) {
		await this.governance.assertWritable(ownerId, "CONTRACT", workId);
		if (contractId) {
			await this.governance.assertWritable(
				ownerId,
				"CONTRACT_STATUS",
				contractId,
			);
		}
	}

	private async notifyAmendmentApprovers(
		ownerId: string,
		workId: string,
		contractId: string,
		amendmentId: string,
		role: "GESTOR" | "GERENTE",
	) {
		const scope = await resolveResourceScope(ownerId, { workId });
		const membershipRows = await Promise.all([
			role === "GESTOR" && scope.path.costCenterId
				? prisma.costCenterMembership.findMany({
						where: { costCenterId: scope.path.costCenterId, revokedAt: null },
						select: { userId: true, user: { select: { role: true } } },
					})
				: Promise.resolve([]),
			prisma.organizationMembership.findMany({
				where: { organizationId: scope.path.organizationId, revokedAt: null },
				select: { userId: true, user: { select: { role: true } } },
			}),
			prisma.companyMembership.findMany({
				where: {
					revokedAt: null,
					company: {
						organizations: { some: { id: scope.path.organizationId } },
					},
				},
				select: { userId: true, user: { select: { role: true } } },
			}),
		]);
		const recipients = new Set<string>();
		for (const row of membershipRows.flat()) {
			if (normalizeRole(row.user?.role) === role) recipients.add(row.userId);
		}
		for (const recipientId of recipients) {
			await notificationService.create({
				recipientId,
				eventType: "CONTRACT_AMENDMENT_APPROVAL_REQUIRED",
				referenceId: amendmentId,
				title: "Aditivo de contrato aguardando aprovação",
				body: `Revise o aditivo do contrato em /app/obras/${workId}/contratos/${contractId}?tab=aditivos`,
			});
		}
	}

	private async approveAmendment(
		ownerId: string,
		workId: string,
		contractId: string,
		amendment: {
			id: string;
			kind: string;
			value: unknown;
			reason: string;
			date: Date;
		},
		actorId: string,
	) {
		const reference = await this.contractCommitmentRef(
			ownerId,
			workId,
			contractId,
		);
		if (!reference)
			throw new ConstructionError(
				"CONTRACT_BUDGET_COVERAGE_MISSING",
				"Sem cobertura orcamentaria vigente para o aditivo",
				422,
			);
		return withSerializableRetry(async (tx) => {
			const signedValue =
				amendment.kind === "ADITIVO"
					? Number(amendment.value)
					: -Number(amendment.value);
			await budgetControlService.apply(
				ownerId,
				workId,
				{
					workId,
					allocations: [
						{ budgetItemId: reference.budgetItemId, value: signedValue },
					],
					amount: signedValue,
					impactType: "COMMITMENT",
					sourceType: AMENDMENT_SOURCE_TYPE,
					sourceId: `${amendment.id}#1`,
					componentId: COMPONENT_AMENDMENT,
					competence: competenceOf(amendment.date),
					occurredAt: amendment.date,
				},
				{ userId: actorId },
				tx,
			);
			const result = await tx.constructionContractAmendment.update({
				where: { id: amendment.id, ownerId },
				data: {
					approvalStatus: "APPROVED",
					gerenteReviewedBy: actorId,
					gerenteReviewedAt: new Date(),
					effectiveAt: new Date(),
				},
			});
			await writeAudit(tx, {
				userId: actorId,
				ownerId,
				action: "APPROVE",
				entityType: "CONTRACT_AMENDMENT",
				entityId: amendment.id,
				entityDescription: `Aditivo ${amendment.kind} - ${amendment.reason}`,
				newState: {
					approvalStatus: "APPROVED",
					value: Number(amendment.value),
				},
			});
			return result;
		});
	}

	// Guarda compartilhada entre previa, criacao e lote: o item precisa de
	// cobertura orcamentaria vigente para virar compromisso do contrato.
	private async assertServiceBudgetCoverage(
		ownerId: string,
		workId: string,
		budgetItemId: string,
	) {
		const ref = await resolveLedgerItemRef(ownerId, workId, budgetItemId);
		if (!ref) {
			throw new ConstructionError(
				"CONTRACT_BUDGET_COVERAGE_MISSING",
				"Sem cobertura orcamentaria vigente para o servico do contrato",
				422,
			);
		}
		return ref;
	}

	// Item orcamentario vigente para compromissos do contrato: o primeiro
	// servico vinculado ao orcamento com cobertura na versao vigente.
	private async contractCommitmentRef(
		ownerId: string,
		workId: string,
		contractId: string,
	): Promise<
		| ({ identityId: string; versionItemId: string } & { budgetItemId: string })
		| null
	> {
		const services = await contractRepository.listContractServices(
			ownerId,
			contractId,
		);
		if (!services) return null;
		for (const service of services) {
			if (!service.budgetItemId) continue;
			const ref = await resolveLedgerItemRef(
				ownerId,
				workId,
				service.budgetItemId,
			);
			if (ref) return { ...ref, budgetItemId: service.budgetItemId };
		}
		return null;
	}

	private async applyServiceCommitment(
		ownerId: string,
		workId: string,
		input: {
			budgetItemId: string;
			sourceId: string;
			componentId: string;
			amount: number;
			occurredAt: Date;
		},
		ctx: BudgetApplyContext,
		tx: Prisma.TransactionClient,
	): Promise<BudgetMutationResult> {
		return budgetControlService.apply(
			ownerId,
			workId,
			{
				workId,
				allocations: [
					{
						budgetItemId: input.budgetItemId,
						value: input.amount,
					},
				],
				amount: input.amount,
				impactType: "COMMITMENT",
				sourceType: SERVICE_SOURCE_TYPE,
				sourceId: input.sourceId,
				componentId: input.componentId,
				competence: competenceOf(input.occurredAt),
				occurredAt: input.occurredAt,
			},
			ctx,
			tx,
		);
	}

	private async reverseSourceCommitments(
		ownerId: string,
		workId: string,
		sourceType: string,
		sourceIdPrefix: string,
		ctx: BudgetApplyContext,
		tx: Prisma.TransactionClient,
	) {
		const events = await findLedgerEventsBySourcePrefix(tx, {
			sourceType,
			sourceIdPrefix,
		});
		const versionIds = [
			...new Set(
				events
					.map((event) => event.sourceId)
					.filter((id): id is string => Boolean(id)),
			),
		];
		for (const versionId of versionIds) {
			const impacts = await findActiveImpactsBySource(
				tx,
				ownerId,
				workId,
				sourceType,
				versionId,
			);
			for (const impact of impacts) {
				if (impact.status === "APPROVED") {
					await budgetControlService.reverse(ownerId, impact.id, ctx, tx);
				} else if (impact.status === "PENDING") {
					await budgetControlService.reject(ownerId, impact.id, ctx, tx);
				}
			}
		}
	}

	private async resolveSupplier<T extends { supplierId?: string | null }>(
		ownerId: string,
		workId: string,
		input: T,
	): Promise<T & { supplierName?: string }> {
		if (input.supplierId == null) return input;
		const supplier = await getSupplierById(ownerId, input.supplierId);
		if (!supplier) {
			throw new ConstructionError(
				"INVALID_SUPPLIER",
				"Fornecedor nao pertence ao proprietario",
				422,
			);
		}
		const workLink = await findWorkSupplier(ownerId, workId, input.supplierId);
		if (!workLink) {
			throw new ConstructionError(
				"SUPPLIER_OUTSIDE_WORK",
				"Fornecedor nao esta vinculado a esta obra",
				422,
			);
		}
		const withName = input as T & { supplierName?: string };
		if (withName.supplierName !== undefined) return withName;
		return { ...withName, supplierName: supplier.name };
	}

	async listContracts(
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
		await getWorkOrThrow(ownerId, workId);
		return contractRepository.listContracts(ownerId, workId, filters);
	}

	async getContract(ownerId: string, workId: string, contractId: string) {
		await getWorkOrThrow(ownerId, workId);
		const contract = await contractRepository.getContractById(
			ownerId,
			workId,
			contractId,
		);
		if (!contract) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return contract;
	}

	/**
	 * DEC-005 (USR-002): criacao de contrato e comando relevante. SUPERVISOR
	 * gera solicitacao PENDING (sem efeito); GESTOR, GERENTE e ADMIN executam
	 * o efeito direto (handler CONTRACT_CREATE) na mesma transacao.
	 */
	async createContract(
		ownerId: string,
		workId: string,
		input: CreateContractInput,
		ctx: { userId: string },
	) {
		if (!input.objectDescription?.trim()) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Descricao do contrato obrigatoria",
				422,
			);
		}
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId);
		if (!input.supplierId?.trim()) {
			throw new ConstructionError(
				"INVALID_SUPPLIER",
				"Selecione um fornecedor cadastrado",
				422,
			);
		}
		// Cada solicitacao recebe sua propria chave de idempotencia. Nao
		// bloquear por workId: contratos distintos podem tramitar em paralelo
		// para fornecedores diferentes na mesma obra.
		const resolved = await this.resolveSupplier(ownerId, workId, input);
		// Invariante do createContractSchema (superRefine exige supplierName OU
		// supplierId; resolveSupplier denormaliza o nome quando so o id e enviado).
		// TypeScript nao infere o resultado de superRefine, entao o cast e
		// necessario — ele documenta o invariante em vez de enfraquece-lo.
		const contractInput = {
			...resolved,
			createdBy: ctx.userId,
		} as CreateContractInput & {
			supplierName: string;
			createdBy?: string | null;
		};

		const commandId = `contract-create-${crypto.randomUUID()}`;
		const { submitApproval } = await import("../governance/approval.service");
		const result = await submitApproval({
			actorId: ctx.userId,
			resourceType: "CONTRACT",
			resourceId: null,
			commandId,
			effectAction: "CONTRACT_CREATE",
			payload: {
				workId,
				contract: contractInput,
				services: input.services,
				createdBy: ctx.userId,
			},
			expectedVersion: 1,
			idempotencyKey: commandId,
		});

		if (result.status === "PENDING") {
			return {
				status: "PENDING" as const,
				approvalRequest: {
					id: result.approvalRequestId,
					requiredApproverRole:
						result.requiredApproverRole ?? ("GERENTE" as const),
					organizationId: result.scope?.organizationId ?? "",
					costCenterId: result.scope?.costCenterId ?? null,
					createdAt: new Date().toISOString(),
				},
			};
		}

		return { status: "EXECUTED" as const, data: result.data };
	}

	async updateContract(
		ownerId: string,
		workId: string,
		contractId: string,
		input: UpdateContractInput,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		const existing = await contractRepository.getContractById(
			ownerId,
			workId,
			contractId,
		);
		if (!existing) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		if (input.status !== undefined) {
			validateStatusTransition(
				"Contrato",
				CONTRACT_TRANSITIONS,
				existing.status,
				input.status,
			);
			if (
				(input.status === "PARALISADO" || input.status === "ARQUIVADO") &&
				!input.statusReason?.trim()
			) {
				throw new ConstructionError(
					"STATUS_REASON_REQUIRED",
					"Informe o motivo para suspender ou arquivar o contrato",
					422,
				);
			}
		}
		const { submitApproval } = await import("../governance/approval.service");
		const commandId = `contract-update-${contractId}-${crypto.randomUUID()}`;
		const result = await submitApproval({
			actorId: ctx.userId,
			resourceType: "CONTRACT",
			resourceId: contractId,
			commandId,
			effectAction: "CONTRACT_UPDATE",
			payload: { workId, contractId, input },
			expectedVersion: 1,
			idempotencyKey: commandId,
		});
		if (result.status === "PENDING") {
			return {
				status: "PENDING" as const,
				approvalRequest: {
					id: result.approvalRequestId,
					requiredApproverRole: result.requiredApproverRole ?? "GERENTE",
					organizationId: result.scope?.organizationId ?? "",
					costCenterId: result.scope?.costCenterId ?? null,
					createdAt: new Date().toISOString(),
				},
			};
		}
		return { status: "EXECUTED" as const, data: result.data };
	}

	async linkSupplier(
		ownerId: string,
		workId: string,
		contractId: string,
		supplierId: string,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		await this.resolveSupplier(ownerId, workId, { supplierId });
		const commandId = `contract-supplier-link-${contractId}-${crypto.randomUUID()}`;
		const { submitApproval } = await import("../governance/approval.service");
		const result = await submitApproval({
			actorId: ctx.userId,
			resourceType: "CONTRACT",
			resourceId: contractId,
			commandId,
			effectAction: "CONTRACT_SUPPLIER_LINK",
			payload: { workId, contractId, supplierId },
			expectedVersion: 1,
			idempotencyKey: commandId,
		});
		if (result.status === "PENDING") {
			return {
				status: "PENDING" as const,
				approvalRequest: {
					id: result.approvalRequestId,
					requiredApproverRole: result.requiredApproverRole ?? "GERENTE",
					organizationId: result.scope?.organizationId ?? "",
					costCenterId: result.scope?.costCenterId ?? null,
					createdAt: new Date().toISOString(),
				},
			};
		}
		return { status: "EXECUTED" as const, data: result.data };
	}

	async deleteContract(
		ownerId: string,
		workId: string,
		contractId: string,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		const existing = await contractRepository.getContractById(
			ownerId,
			workId,
			contractId,
		);
		if (!existing) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		const { submitApproval } = await import("../governance/approval.service");
		const commandId = `contract-delete-${contractId}-${crypto.randomUUID()}`;
		const result = await submitApproval({
			actorId: ctx.userId,
			resourceType: "CONTRACT",
			resourceId: contractId,
			commandId,
			effectAction: "CONTRACT_DELETE",
			payload: { workId, contractId },
			expectedVersion: 1,
			idempotencyKey: commandId,
		});
		if (result.status === "PENDING") {
			return {
				status: "PENDING" as const,
				approvalRequest: {
					id: result.approvalRequestId,
					requiredApproverRole: result.requiredApproverRole ?? "GERENTE",
					organizationId: result.scope?.organizationId ?? "",
					costCenterId: result.scope?.costCenterId ?? null,
					createdAt: new Date().toISOString(),
				},
			};
		}
		return { status: "EXECUTED" as const, data: result.data };
	}

	async getContractsSummary(ownerId: string, workId: string) {
		await getWorkOrThrow(ownerId, workId);
		return contractRepository.getContractsSummary(ownerId, workId);
	}

	async listCrossContractMeasurements(ownerId: string, workId: string) {
		await getWorkOrThrow(ownerId, workId);
		return contractRepository.listCrossContractMeasurements(ownerId, workId);
	}

	async listServices(ownerId: string, workId: string, contractId: string) {
		await getWorkOrThrow(ownerId, workId);
		const services = await contractRepository.listContractServices(
			ownerId,
			contractId,
		);
		if (services === null) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return services;
	}

	async getService(
		ownerId: string,
		workId: string,
		contractId: string,
		serviceId: string,
	) {
		await getWorkOrThrow(ownerId, workId);
		const services = await contractRepository.listContractServices(
			ownerId,
			contractId,
		);
		if (services === null) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		const found = services.find((s) => s.id === serviceId);
		if (!found) {
			throw new ConstructionError("NOT_FOUND", "Servico nao encontrado", 404);
		}
		return found;
	}

	// Previa financeira nao persistente: mostra o impacto de vincular um item
	// de orcamento como servico antes de confirmar. Reusa budget-control e a
	// mesma guarda de cobertura da criacao, sem criar servico, evento de
	// ledger ou impacto de orcamento.
	async previewService(
		ownerId: string,
		workId: string,
		contractId: string,
		input: ContractServicePreviewInput,
	): Promise<ContractServicePreviewResult> {
		await getWorkOrThrow(ownerId, workId);
		const budgetItem = await contractRepository.getContractServiceBudgetItem(
			ownerId,
			contractId,
			input.budgetItemId,
		);
		if (!budgetItem) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		await this.assertServiceBudgetCoverage(ownerId, workId, input.budgetItemId);

		const projectedValue =
			contractRepository.deriveServiceTotalCost(input) ?? 0;
		const preview = await budgetControlService.preview(ownerId, workId, {
			allocations: [
				{ budgetItemId: input.budgetItemId, value: projectedValue },
			],
		});
		const item = preview.items[0];
		if (!item) {
			throw new ConstructionError(
				"BUDGET_VERSION_NOT_AVAILABLE",
				"Saldo indisponivel para o item de orcamento",
				422,
			);
		}

		const warnings: string[] = [];
		if (projectedValue > 0 && item.projectedBalance < 0) {
			warnings.push(
				"O valor projetado excede o saldo disponivel do item de orcamento e dependera de aprovacao",
			);
		}

		return {
			budgetItem: {
				id: budgetItem.id,
				description: budgetItem.description,
				index: budgetItem.index,
			},
			availableBefore: item.availableBalance,
			projectedValue,
			availableAfter: item.projectedBalance,
			warnings,
		};
	}

	async createService(
		ownerId: string,
		workId: string,
		contractId: string,
		input: CreateContractServiceInput,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		return withOverflowApproval({
			ownerId,
			actorId: ctx.userId,
			workId,
			sourceType: SERVICE_SOURCE_TYPE,
			commit: async (tx) => {
				const created = await contractRepository.createContractService(
					ownerId,
					contractId,
					input,
					tx,
				);
				if (!created) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Contrato nao encontrado",
						404,
					);
				}
				await writeAudit(tx, {
					userId: ctx.userId,
					ownerId,
					action: "CREATE",
					entityType: "CONTRACT_SERVICE",
					entityId: (created as { id?: string }).id ?? contractId,
					entityDescription: `Servico ${(created as { id?: string }).id ?? contractId} do contrato ${contractId}`,
					newState: {
						budgetItemId:
							(created as { budgetItemId?: string | null }).budgetItemId ??
							null,
						quantity: (created as { quantity?: unknown }).quantity ?? null,
						unitCost: (created as { unitCost?: unknown }).unitCost ?? null,
					},
				});

				let overflow: BudgetMutationResult | null = null;
				await this.assertServiceBudgetCoverage(
					ownerId,
					workId,
					input.budgetItemId,
				);
				overflow = await this.applyServiceCommitment(
					ownerId,
					workId,
					{
						budgetItemId: input.budgetItemId,
						sourceId: `${created.id}#1`,
						componentId: COMPONENT_BASE,
						amount: Number(created.totalCost ?? 0),
						occurredAt: new Date(),
					},
					{ userId: ownerId },
					tx,
				);

				return { value: created, sourceId: `${created.id}#1`, overflow };
			},
		});
	}

	async createServices(
		ownerId: string,
		workId: string,
		contractId: string,
		inputs: CreateContractServicesInput,
		ctx: { userId: string },
	) {
		if (inputs.length === 0) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Informe ao menos um servico",
				400,
			);
		}

		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		return withOverflowApproval({
			ownerId,
			actorId: ctx.userId,
			workId,
			sourceType: SERVICE_SOURCE_TYPE,
			commit: async (tx) => {
				const created = await contractRepository.createContractServices(
					ownerId,
					contractId,
					inputs,
					tx,
				);
				if (!created) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Contrato nao encontrado",
						404,
					);
				}
				for (const service of created) {
					await writeAudit(tx, {
						userId: ctx.userId,
						ownerId,
						action: "CREATE",
						entityType: "CONTRACT_SERVICE",
						entityId: (service as { id?: string }).id ?? contractId,
						entityDescription: `Servico ${(service as { id?: string }).id ?? contractId} do contrato ${contractId}`,
						newState: {
							budgetItemId:
								(service as { budgetItemId?: string | null }).budgetItemId ??
								null,
							quantity: (service as { quantity?: unknown }).quantity ?? null,
							unitCost: (service as { unitCost?: unknown }).unitCost ?? null,
						},
					});
				}

				const overflows: BudgetMutationResult[] = [];
				for (const [index, service] of created.entries()) {
					const input = inputs[index];
					await this.assertServiceBudgetCoverage(
						ownerId,
						workId,
						input.budgetItemId,
					);

					const overflow = await this.applyServiceCommitment(
						ownerId,
						workId,
						{
							budgetItemId: input.budgetItemId,
							sourceId: `${service.id}#1`,
							componentId: COMPONENT_BASE,
							amount: Number(service.totalCost ?? 0),
							occurredAt: new Date(),
						},
						{ userId: ownerId },
						tx,
					);
					overflows.push(overflow);
				}

				const pending = overflows.filter((item) => item.requiresApproval);
				const overflow = pending.length
					? {
							status: "PENDING_APPROVAL" as const,
							requiresApproval: true,
							availableBalance: Math.min(
								...pending.map((item) => item.availableBalance),
							),
							projectedBalance: Math.min(
								...pending.map((item) => item.projectedBalance),
							),
							allocations: pending.flatMap((item) => item.allocations),
						}
					: null;

				return {
					value: created,
					sourceId: `batch:${contractId}:${created.map((item) => item.id).join(",")}`,
					overflow,
				};
			},
		});
	}

	async updateService(
		ownerId: string,
		workId: string,
		contractId: string,
		serviceId: string,
		input: UpdateContractServiceInput,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		return withOverflowApproval({
			ownerId,
			actorId: ctx.userId,
			workId,
			sourceType: SERVICE_SOURCE_TYPE,
			commit: async (tx) => {
				const existing = await contractRepository.getContractServiceById(
					tx,
					ownerId,
					contractId,
					serviceId,
				);
				if (!existing) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Servico nao encontrado",
						404,
					);
				}

				const commitments = await findLedgerEventsBySourcePrefix(tx, {
					sourceType: SERVICE_SOURCE_TYPE,
					sourceIdPrefix: `${serviceId}#`,
				});
				const committedCount = commitments.filter(
					(event) => event.eventType === "COMMITMENT_INCREASE",
				).length;

				const newBudgetItemId =
					input.budgetItemId !== undefined
						? input.budgetItemId
						: existing.budgetItemId;
				const newTotalCost =
					input.quantity !== undefined || input.unitCost !== undefined
						? Number(input.quantity ?? 0) * Number(input.unitCost ?? 0)
						: existing.totalCost;
				const financialChanged =
					newTotalCost !== existing.totalCost ||
					(input.budgetItemId !== undefined &&
						input.budgetItemId !== existing.budgetItemId);

				const updated = await contractRepository.updateContractService(
					ownerId,
					contractId,
					serviceId,
					input,
					tx,
				);
				if (!updated) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Servico nao encontrado",
						404,
					);
				}
				await writeAudit(tx, {
					userId: ctx.userId,
					ownerId,
					action: "UPDATE",
					entityType: "CONTRACT_SERVICE",
					entityId: serviceId,
					entityDescription: `Servico ${serviceId} do contrato ${contractId}`,
					previousState: {
						budgetItemId:
							(existing as { budgetItemId?: string | null }).budgetItemId ??
							null,
						quantity: (existing as { quantity?: unknown }).quantity ?? null,
						unitCost: (existing as { unitCost?: unknown }).unitCost ?? null,
					},
					newState: {
						budgetItemId:
							(updated as { budgetItemId?: string | null }).budgetItemId ??
							null,
						quantity: (updated as { quantity?: unknown }).quantity ?? null,
						unitCost: (updated as { unitCost?: unknown }).unitCost ?? null,
					},
				});

				let overflow: BudgetMutationResult | null = null;
				if (committedCount === 0 && newBudgetItemId) {
					await this.assertServiceBudgetCoverage(
						ownerId,
						workId,
						newBudgetItemId,
					);
					overflow = await this.applyServiceCommitment(
						ownerId,
						workId,
						{
							budgetItemId: newBudgetItemId,
							sourceId: `${serviceId}#1`,
							componentId: COMPONENT_BASE,
							amount: newTotalCost,
							occurredAt: new Date(),
						},
						{ userId: ownerId },
						tx,
					);
				} else if (committedCount > 0 && financialChanged) {
					await this.reverseSourceCommitments(
						ownerId,
						workId,
						SERVICE_SOURCE_TYPE,
						`${serviceId}#`,
						{ userId: ownerId },
						tx,
					);
					if (newBudgetItemId) {
						await this.assertServiceBudgetCoverage(
							ownerId,
							workId,
							newBudgetItemId,
						);
						overflow = await this.applyServiceCommitment(
							ownerId,
							workId,
							{
								budgetItemId: newBudgetItemId,
								sourceId: `${serviceId}#${committedCount + 1}`,
								componentId: COMPONENT_BASE,
								amount: newTotalCost,
								occurredAt: new Date(),
							},
							{ userId: ownerId },
							tx,
						);
					}
				}

				return {
					value: updated,
					sourceId: `${serviceId}#${committedCount + 1}`,
					overflow,
				};
			},
		});
	}

	async deleteService(
		ownerId: string,
		workId: string,
		contractId: string,
		serviceId: string,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		const result = await withSerializableRetry(async (tx) => {
			const existing = await contractRepository.getContractServiceById(
				tx,
				ownerId,
				contractId,
				serviceId,
			);
			const deleted = await contractRepository.deleteContractService(
				ownerId,
				contractId,
				serviceId,
				tx,
			);
			if (!deleted) {
				throw new ConstructionError("NOT_FOUND", "Servico nao encontrado", 404);
			}
			await this.reverseSourceCommitments(
				ownerId,
				workId,
				SERVICE_SOURCE_TYPE,
				`${serviceId}#`,
				{ userId: ownerId },
				tx,
			);
			if (existing) {
				await writeAudit(tx, {
					userId: ctx.userId,
					ownerId,
					action: "DELETE",
					entityType: "CONTRACT_SERVICE",
					entityId: serviceId,
					entityDescription: `Servico ${serviceId} do contrato ${contractId}`,
					previousState: {
						budgetItemId:
							(existing as { budgetItemId?: string | null }).budgetItemId ??
							null,
						quantity: (existing as { quantity?: unknown }).quantity ?? null,
						unitCost: (existing as { unitCost?: unknown }).unitCost ?? null,
					},
				});
			}
			return deleted;
		});
		return result;
	}

	async linkServicesToBudget(
		ownerId: string,
		workId: string,
		contractId: string,
		input: LinkBudgetInput,
		ctx?: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		return withOverflowApproval({
			ownerId,
			actorId: ctx?.userId ?? ownerId,
			workId,
			sourceType: SERVICE_SOURCE_TYPE,
			commit: async (tx) => {
				const refsByServiceId = new Map<
					string,
					Awaited<ReturnType<typeof resolveLedgerItemRef>>
				>();
				for (const link of input.links) {
					const ref = await resolveLedgerItemRef(
						ownerId,
						workId,
						link.budgetItemId,
						tx,
					);
					if (!ref) {
						throw new ConstructionError(
							"CONTRACT_BUDGET_COVERAGE_MISSING",
							"Sem cobertura orcamentaria vigente para o servico do contrato",
							422,
						);
					}
					refsByServiceId.set(link.serviceId, ref);
				}

				const linked = await contractRepository.linkServicesToBudget(
					ownerId,
					contractId,
					input,
					tx,
				);
				if (!linked) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Contrato nao encontrado",
						404,
					);
				}

				let overflow: BudgetMutationResult | null = null;
				let overflowSourceId = "";
				for (const link of input.links) {
					const committed = await findLedgerEventsBySourcePrefix(tx, {
						sourceType: SERVICE_SOURCE_TYPE,
						sourceIdPrefix: `${link.serviceId}#`,
					});
					if (committed.some((e) => e.eventType === "COMMITMENT_INCREASE")) {
						continue;
					}
					const ref = refsByServiceId.get(link.serviceId);
					if (!ref) continue;
					const service = await contractRepository.getContractServiceById(
						tx,
						ownerId,
						contractId,
						link.serviceId,
					);
					const candidate = await this.applyServiceCommitment(
						ownerId,
						workId,
						{
							budgetItemId: link.budgetItemId,
							sourceId: `${link.serviceId}#1`,
							componentId: COMPONENT_BASE,
							amount: Number(service?.totalCost ?? 0),
							occurredAt: new Date(),
						},
						{ userId: ownerId },
						tx,
					);
					if (candidate?.requiresApproval) {
						overflow = candidate;
						overflowSourceId = `${link.serviceId}#1`;
					}
				}
				return { value: linked, sourceId: overflowSourceId, overflow };
			},
		});
	}

	async listAmendments(ownerId: string, workId: string, contractId: string) {
		await getWorkOrThrow(ownerId, workId);
		const amendments = await contractRepository.listAmendments(
			ownerId,
			contractId,
		);
		if (amendments === null) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return amendments;
	}

	async createAmendment(
		ownerId: string,
		workId: string,
		contractId: string,
		input: CreateContractAmendmentInput,
		ctx: { userId: string; role: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		if (input.value <= 0) {
			throw new ConstructionError(
				"INVALID_AMENDMENT_VALUE",
				"Valor do aditivo deve ser maior que zero",
				422,
			);
		}
		let amendment = await contractRepository.createAmendment(
			ownerId,
			contractId,
			{ ...input, createdBy: ctx.userId },
		);
		if (!amendment)
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		if (ctx.role === "ADMIN" || ctx.role === "GERENTE") {
			const approved = await this.approveAmendment(
				ownerId,
				workId,
				contractId,
				amendment,
				ctx.userId,
			);
			amendment = { ...approved, measurementIds: amendment.measurementIds };
		} else {
			await this.notifyAmendmentApprovers(
				ownerId,
				workId,
				contractId,
				amendment.id,
				"GESTOR",
			);
		}
		await auditService.log({
			userId: ctx.userId,
			ownerId,
			action: "CREATE",
			entityType: "CONTRACT_AMENDMENT",
			entityId: amendment.id,
			entityDescription: `Aditivo ${amendment.kind} - ${amendment.reason}`,
			newState: {
				approvalStatus: amendment.approvalStatus,
				value: Number(amendment.value),
			},
		});
		return amendment;
	}

	async decideAmendment(
		ownerId: string,
		workId: string,
		contractId: string,
		amendmentId: string,
		decision: "APPROVE" | "REJECT",
		ctx: { userId: string; role: string; reason?: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		const amendment = await prisma.constructionContractAmendment.findFirst({
			where: { id: amendmentId, ownerId, contractId },
		});
		if (!amendment)
			throw new ConstructionError("NOT_FOUND", "Aditivo nao encontrado", 404);
		if (decision === "REJECT") {
			const validStage =
				(ctx.role === "GESTOR" &&
					amendment.approvalStatus === "PENDING_GESTOR") ||
				(ctx.role === "GERENTE" &&
					amendment.approvalStatus === "PENDING_GERENTE");
			if (!validStage)
				throw new ConstructionError(
					"AMENDMENT_APPROVAL_INVALID",
					"Aditivo fora da etapa de revisao do usuario",
					422,
				);
			if (!ctx.reason?.trim())
				throw new ConstructionError(
					"APPROVAL_REASON_REQUIRED",
					"Motivo obrigatorio para rejeitar",
					422,
				);
			const rejected = await prisma.constructionContractAmendment.update({
				where: { id: amendmentId, ownerId },
				data: {
					approvalStatus: "REJECTED",
					...(ctx.role === "GESTOR"
						? { gestorReviewedBy: ctx.userId, gestorReviewedAt: new Date() }
						: { gerenteReviewedBy: ctx.userId, gerenteReviewedAt: new Date() }),
				},
			});
			await auditService.log({
				userId: ctx.userId,
				ownerId,
				action: "REJECT",
				entityType: "CONTRACT_AMENDMENT",
				entityId: amendmentId,
				entityDescription: `Aditivo ${amendment.kind} - ${amendment.reason}`,
				newState: { approvalStatus: "REJECTED", reason: ctx.reason },
			});
			return rejected;
		}
		if (
			ctx.role === "GESTOR" &&
			amendment.approvalStatus === "PENDING_GESTOR"
		) {
			const progressed = await prisma.constructionContractAmendment.update({
				where: { id: amendmentId, ownerId },
				data: {
					approvalStatus: "PENDING_GERENTE",
					gestorReviewedBy: ctx.userId,
					gestorReviewedAt: new Date(),
				},
			});
			await this.notifyAmendmentApprovers(
				ownerId,
				workId,
				contractId,
				amendmentId,
				"GERENTE",
			);
			return progressed;
		}
		if (
			ctx.role !== "GERENTE" ||
			amendment.approvalStatus !== "PENDING_GERENTE"
		) {
			throw new ConstructionError(
				"AMENDMENT_APPROVAL_INVALID",
				"Aditivo fora da etapa de revisao do usuario",
				422,
			);
		}
		return this.approveAmendment(
			ownerId,
			workId,
			contractId,
			amendment,
			ctx.userId,
		);
	}

	async updateAmendment(
		ownerId: string,
		workId: string,
		contractId: string,
		amendmentId: string,
		input: UpdateContractAmendmentInput,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		if (input.value !== undefined && input.value <= 0) {
			throw new ConstructionError(
				"INVALID_AMENDMENT_VALUE",
				"Valor do aditivo deve ser maior que zero",
				422,
			);
		}
		if (input.kind !== undefined || input.value !== undefined) {
			const ledgered = await findLedgerEventsBySourcePrefix(prisma, {
				sourceType: AMENDMENT_SOURCE_TYPE,
				sourceIdPrefix: `${amendmentId}#`,
			});
			if (ledgered.length > 0) {
				throw new ConstructionError(
					"AMENDMENT_LEDGERED",
					"Aditivo ja registrado no razao financeiro: remova e recrie para alterar",
					422,
				);
			}
		}
		const result = await contractRepository.updateAmendment(
			ownerId,
			contractId,
			amendmentId,
			input,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Aditivo nao encontrado", 404);
		}
		const { previous, updated } = result;
		await auditService.log({
			userId: ctx.userId,
			ownerId,
			action: "UPDATE",
			entityType: "CONTRACT_AMENDMENT",
			entityId: amendmentId,
			entityDescription: `Aditivo ${updated.kind} - ${updated.reason}`,
			previousState: {
				kind: previous.kind,
				value: Number(previous.value),
				reason: previous.reason,
				date: previous.date.toISOString(),
			},
			newState: {
				kind: updated.kind,
				value: Number(updated.value),
				reason: updated.reason,
				date: updated.date.toISOString(),
			},
		});
		return updated;
	}

	async removeAmendment(
		ownerId: string,
		workId: string,
		contractId: string,
		amendmentId: string,
		ctx: { userId: string },
	) {
		await getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, contractId);
		const result = await withSerializableRetry(async (tx) => {
			await findLedgerEventsBySourcePrefix(tx, {
				sourceType: AMENDMENT_SOURCE_TYPE,
				sourceIdPrefix: `${amendmentId}#`,
			});
			const deleted = await contractRepository.deleteAmendment(
				ownerId,
				contractId,
				amendmentId,
				tx,
			);
			if (!deleted) {
				throw new ConstructionError("NOT_FOUND", "Aditivo nao encontrado", 404);
			}
			await this.reverseSourceCommitments(
				ownerId,
				workId,
				AMENDMENT_SOURCE_TYPE,
				`${amendmentId}#`,
				{ userId: ownerId },
				tx,
			);
			return deleted;
		});
		await auditService.log({
			userId: ctx.userId,
			ownerId,
			action: "DELETE",
			entityType: "CONTRACT_AMENDMENT",
			entityId: amendmentId,
			entityDescription: `Aditivo ${result.kind} - ${result.reason}`,
			previousState: {
				kind: result.kind,
				value: Number(result.value),
				reason: result.reason,
			},
		});
		return result;
	}

	// REL-004 (DEC-001/012): gera o instrumento contratual registrando versao
	// e actor. Exige que a empresa vinculada a obra possua modelo contratual
	// (PDF/DOCX) e calcula a multa de 20% sobre o valor da empreitada.
	async generateInstrument(
		ownerId: string,
		workId: string,
		contractId: string,
		ctx: { userId: string },
	) {
		return generateContractInstrumentArtifact(ownerId, workId, contractId, ctx);
	}
}

export const contractService = new ContractService();
