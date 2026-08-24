import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { writeAudit } from "../../lib/audit-writer";
import { ConstructionError } from "../../lib/errors";
import { toFiniteNumber } from "../../lib/number-utils";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import { withSerializableRetry } from "../../lib/transaction-retry";
import { auditService } from "../audit/audit.service";
import type { MeasurementActorRole } from "../governance/governance.service";
import { findActiveImpactsBySource } from "./budget-control/budget-control.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import type { BudgetMutationResult } from "./budget-control/budget-control.types";
import { withOverflowApproval } from "./budget-control/overflow-approval";
import {
	type ContractGovernanceScope,
	contractGovernanceScope,
} from "./contract-governance-scope";
import type {
	ContractMeasurementItemPayload,
	ContractServiceTotalsExport,
} from "./contract-measurement.repository";
import * as cmRepository from "./contract-measurement.repository";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "./governance-guard";
import {
	assertDuePartsDoNotExceedIncurred,
	buildMeasurementEvents,
	buildPaymentCreateEvent,
	COMPONENT_SUPPLIER,
	competenceOf,
	MEASUREMENT_SOURCE_TYPE,
	PAYMENT_SOURCE_TYPE,
	resolveLedgerItemRef,
	reverseLedgerEvents,
	splitMeasurementValue,
} from "./ledger/ledger.integration";
import {
	countLedgerEventsBySource,
	findLedgerEventsBySource,
	findLedgerEventsBySourcePrefix,
} from "./ledger/ledger.repository";
import { appendLedgerEvent, appendLedgerEvents } from "./ledger/ledger.service";
import {
	buildMeasurementDateWarning,
	type MeasurementWarning,
} from "./measurement-common";
import { measurementCoverageService } from "./measurement-coverage.service";
import type {
	CreateContractMeasurementInput,
	CreateContractPaymentInput,
	UpdateContractMeasurementInput,
	UpdateContractPaymentInput,
} from "./schemas/contract.schema";

type ExceedingItem = {
	serviceId: string;
	accumulatedValue: number;
	totalCost: number;
};

type MeasurementCoverageRef = Map<
	string,
	{
		budgetItemId: string;
		identityId: string;
		versionItemId: string;
	}
>;

export class ContractMeasurementService {
	constructor(
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
		private readonly scope: ContractGovernanceScope = contractGovernanceScope,
	) {}

	private async assertWritable(ownerId: string, contractId: string) {
		const workId = await this.scope.getWorkId(ownerId, contractId);
		if (workId) {
			await this.governance.assertWritable(ownerId, "CONTRACT", workId);
		}
	}

	private async findExceedingItems(
		ownerId: string,
		contractId: string,
		items: Array<{ serviceId: string; accumulatedValue?: number | null }>,
	): Promise<ExceedingItem[]> {
		if (items.length === 0) return [];
		const serviceIds = [...new Set(items.map((i) => i.serviceId))];
		const [totals, servicesById] = await Promise.all([
			cmRepository.getServiceTotals(ownerId, contractId, serviceIds),
			cmRepository.getContractServicesById(
				prisma,
				ownerId,
				contractId,
				serviceIds,
			),
		]);
		const exceeding: ExceedingItem[] = [];
		for (const item of items) {
			const totalCost = totals[item.serviceId];
			if (totalCost === undefined) continue;
			const hydrated = cmRepository.buildMeasurementItemData(
				item,
				servicesById.get(item.serviceId),
			);
			const accumulatedValue = toFiniteNumber(
				hydrated.accumulatedValue ?? hydrated.measuredValue,
			);
			if (accumulatedValue > totalCost) {
				exceeding.push({
					serviceId: item.serviceId,
					accumulatedValue,
					totalCost,
				});
			}
		}
		return exceeding;
	}

	private assertItemsHaveMeasuredValue(
		items: ContractMeasurementItemPayload[],
		servicesById: Map<string, ContractServiceTotalsExport>,
	) {
		const valueless = items.filter((item) => {
			const hydrated = cmRepository.buildMeasurementItemData(
				item,
				servicesById.get(item.serviceId),
			);
			return (
				hydrated.accumulatedValue == null && hydrated.measuredValue == null
			);
		});
		if (valueless.length > 0) {
			throw new ConstructionError(
				"INVALID_MEASUREMENT_ITEM",
				`Item de medicao sem valor (servicos: ${valueless.map((item) => item.serviceId).join(", ")})`,
				422,
			);
		}
	}

	private async resolveMeasurementCoverage(
		ownerId: string,
		workId: string,
		contractId: string,
		items: Array<{ serviceId: string }>,
		db: Prisma.TransactionClient | typeof prisma,
	): Promise<MeasurementCoverageRef> {
		const serviceBudget = await cmRepository.getServiceBudgetItems(
			db,
			ownerId,
			contractId,
			items.map((item) => item.serviceId),
		);
		const byService: MeasurementCoverageRef = new Map();
		const uncovered: string[] = [];
		for (const item of items) {
			const budgetItemId = serviceBudget.get(item.serviceId)?.budgetItemId;
			if (!budgetItemId) {
				uncovered.push(item.serviceId);
				continue;
			}
			const reference = await resolveLedgerItemRef(
				ownerId,
				workId,
				budgetItemId,
			);
			if (!reference) {
				uncovered.push(item.serviceId);
				continue;
			}
			byService.set(item.serviceId, {
				budgetItemId,
				identityId: reference.identityId,
				versionItemId: reference.versionItemId,
			});
		}
		if (uncovered.length > 0) {
			throw new ConstructionError(
				"CONTRACT_BUDGET_COVERAGE_MISSING",
				`Sem cobertura orcamentaria vigente para a medicao do contrato (servicos: ${uncovered.join(", ")})`,
				422,
			);
		}
		return byService;
	}

	private assertPaymentOverrideAllowed(
		role: MeasurementActorRole,
		reason: string | null | undefined,
	) {
		if (role !== "ADMIN") {
			throw new ConstructionError(
				"GOVERNANCE_OVERRIDE_REQUIRED",
				"Somente ADMIN pode executar override administrativo",
				403,
			);
		}
		if (!reason?.trim()) {
			throw new ConstructionError(
				"OVERRIDE_REASON_REQUIRED",
				"Motivo do override e obrigatorio",
				422,
			);
		}
	}

	async listMeasurements(
		ownerId: string,
		contractId: string,
		filters?: { q?: string; page?: number; limit?: number },
	) {
		return cmRepository.listMeasurements(ownerId, contractId, filters);
	}

	async getMeasurement(
		ownerId: string,
		contractId: string,
		measurementId: string,
	) {
		const measurement = await cmRepository.getMeasurementDetail(
			ownerId,
			contractId,
			measurementId,
		);
		if (!measurement) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}
		return measurement;
	}

	async createMeasurement(
		ownerId: string,
		contractId: string,
		input: CreateContractMeasurementInput,
		ctx: { userId: string; role: MeasurementActorRole },
	) {
		await this.assertWritable(ownerId, contractId);
		const contract = await cmRepository.getContractPeriod(ownerId, contractId);
		if (!contract) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}

		const warnings: MeasurementWarning[] = [];
		const periodWarning = buildMeasurementDateWarning(
			{ start: contract.startDate, end: contract.endDate },
			input.date,
		);
		if (periodWarning) warnings.push(periodWarning);

		const ledgerContext = await cmRepository.getContractLedgerContext(
			ownerId,
			contractId,
		);
		if (!ledgerContext) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		const scope = await resolveResourceScope(ownerId, {
			workId: ledgerContext.workId,
		});

		const servicesById = await cmRepository.getContractServicesById(
			prisma,
			ownerId,
			contractId,
			input.items.map((item) => item.serviceId),
		);
		this.assertItemsHaveMeasuredValue(input.items, servicesById);
		const parts = splitMeasurementValue(
			input.items.map((item) =>
				cmRepository.buildMeasurementItemData(
					item,
					servicesById.get(item.serviceId),
				),
			),
			input,
		);
		assertDuePartsDoNotExceedIncurred(parts);

		const occurredAt = new Date(input.date);

		let overflowResult: BudgetMutationResult | null = null;
		const created = await withOverflowApproval({
			ownerId,
			actorId: ctx.userId,
			workId: ledgerContext.workId,
			sourceType: MEASUREMENT_SOURCE_TYPE,
			commit: async (tx) => {
				const coverage = await this.resolveMeasurementCoverage(
					ownerId,
					ledgerContext.workId,
					contractId,
					input.items,
					tx,
				);
				const primary = coverage.get(input.items[0].serviceId);
				if (!primary) {
					throw new ConstructionError(
						"CONTRACT_BUDGET_COVERAGE_MISSING",
						"Sem cobertura orcamentaria vigente para a medicao do contrato",
						422,
					);
				}
				const exceedingItems = await this.findExceedingItems(
					ownerId,
					contractId,
					input.items,
				);
				if (exceedingItems.length > 0) {
					throw new ConstructionError(
						"MEASUREMENT_EXCEEDS_BALANCE",
						"Medicao acima do saldo do servico do contrato; ajuste os valores ou crie uma nova medicao",
						422,
					);
					/*
						code: "MEASUREMENT_EXCEEDS_BALANCE",
						severity: "warning",
						message:
							ctx.role === "SUPERVISOR"
								? "Medição acima do saldo do serviço do contrato — enviada para aprovação"
								: "Medição acima do saldo do serviço do contrato — concluída com aviso",
					}); */
				}

				const created = await cmRepository.createMeasurement(
					ownerId,
					contractId,
					{ ...input, createdBy: ctx.userId },
					tx,
				);
				if (!created) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Medicao nao encontrada",
						404,
					);
				}

				const events = buildMeasurementEvents(
					{
						scope,
						workId: ledgerContext.workId,
						budgetItemIdentityId: primary.identityId,
						budgetVersionItemId: primary.versionItemId,
						sourceType: MEASUREMENT_SOURCE_TYPE,
						sourceId: created.id,
						competence: competenceOf(occurredAt),
						occurredAt,
						approvalDecisionId: null,
					},
					parts,
				);
				let overflow: BudgetMutationResult | null = null;
				const incurredEvent = events.find(
					(e) => e.eventType === "INCURRED_CREATE",
				);
				if (incurredEvent) {
					overflow = await budgetControlService.apply(
						ownerId,
						ledgerContext.workId,
						{
							workId: ledgerContext.workId,
							allocations: [
								{
									budgetItemId: primary.budgetItemId,
									value: Number(incurredEvent.amount),
								},
							],
							amount: Number(incurredEvent.amount),
							impactType: "CONSUMPTION",
							sourceType: MEASUREMENT_SOURCE_TYPE,
							sourceId: created.id,
							componentId: COMPONENT_SUPPLIER,
							competence: competenceOf(occurredAt),
							occurredAt,
						},
						{ userId: ownerId },
						tx,
					);
				}
				const nonIncurredEvents = events.filter(
					(e) => e.eventType !== "INCURRED_CREATE",
				);
				if (nonIncurredEvents.length > 0) {
					await appendLedgerEvents(nonIncurredEvents, tx);
				}

				if (overflow && (ctx.role === "ADMIN" || ctx.role === "GERENTE")) {
					for (const allocation of overflow.allocations) {
						if (
							allocation.status === "PENDING_APPROVAL" &&
							allocation.impactId
						) {
							await budgetControlService.approve(
								ownerId,
								allocation.impactId,
								{ userId: ctx.userId },
								tx,
							);
						}
					}
					overflow = { ...overflow, requiresApproval: false };
				}
				overflowResult = overflow;

				const coverageLinks = input.items.flatMap((item) => {
					const createdItem = created.items.find(
						(createdItem) => createdItem.serviceId === item.serviceId,
					);
					if (!createdItem) return [];
					return (item.coverages ?? []).map((coverage) => ({
						workMeasurementItemId: coverage.workMeasurementItemId,
						contractMeasurementItemId: createdItem.id,
						quantity: coverage.quantity,
					}));
				});
				if (coverageLinks.length > 0) {
					await measurementCoverageService.linkBatch(
						ownerId,
						ledgerContext.workId,
						coverageLinks,
						{ userId: ctx.userId },
						tx,
					);
				}

				if (exceedingItems.length > 0) {
					await writeAudit(tx, {
						userId: ctx.userId,
						ownerId,
						action: "CREATE",
						entityType: "CONTRACT_MEASUREMENT",
						entityId: created.id,
						entityDescription: `Medicao #${created.number} - ${created.title}`,
						newState: {
							warnings,
							exceedingItems,
						},
					});
				}

				return { value: created, sourceId: created.id, overflow };
			},
		});

		const requiresOverflowApproval =
			(overflowResult as BudgetMutationResult | null)?.requiresApproval ??
			false;
		const approvalStatus: "APPROVED" | "PENDING_APPROVAL" =
			requiresOverflowApproval && ctx.role === "SUPERVISOR"
				? "PENDING_APPROVAL"
				: "APPROVED";
		const approvalRequestId =
			approvalStatus === "PENDING_APPROVAL"
				? await this.findOverflowApprovalRequestId(ownerId, created.id)
				: null;

		return { ...created, approvalStatus, approvalRequestId, warnings };
	}

	private async findOverflowApprovalRequestId(
		ownerId: string,
		sourceId: string,
	): Promise<string | null> {
		const request = await prisma.approvalRequest.findFirst({
			where: {
				ownerId,
				effectAction: "BUDGET_IMPACT_APPROVE",
				idempotencyKey: `budget-impact:${MEASUREMENT_SOURCE_TYPE}:${sourceId}`,
			},
			orderBy: { createdAt: "desc" },
			select: { id: true },
		});
		return request?.id ?? null;
	}

	async updateMeasurement(
		ownerId: string,
		contractId: string,
		measurementId: string,
		input: UpdateContractMeasurementInput,
		ctx: { userId: string; role: MeasurementActorRole },
	) {
		await this.assertWritable(ownerId, contractId);

		const financialFieldsChanged =
			input.items !== undefined ||
			input.discountValue !== undefined ||
			input.retentionValue !== undefined ||
			input.taxValue !== undefined;
		if (financialFieldsChanged) {
			const ledgered = await countLedgerEventsBySource(prisma, {
				sourceType: MEASUREMENT_SOURCE_TYPE,
				sourceId: measurementId,
			});
			if (ledgered > 0) {
				throw new ConstructionError(
					"MEASUREMENT_LEDGERED",
					"Medicao ja contabilizada no razao financeiro: estorne e recrie para alterar valores",
					422,
				);
			}
		}

		const contract = await cmRepository.getContractPeriod(ownerId, contractId);
		if (!contract) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}

		const warnings: MeasurementWarning[] = [];
		if (input.date !== undefined) {
			const periodWarning = buildMeasurementDateWarning(
				{ start: contract.startDate, end: contract.endDate },
				input.date,
			);
			if (periodWarning) warnings.push(periodWarning);
		}

		const previous = input.items
			? await cmRepository.getMeasurementById(
					ownerId,
					contractId,
					measurementId,
				)
			: null;

		if (input.items) {
			const servicesById = await cmRepository.getContractServicesById(
				prisma,
				ownerId,
				contractId,
				input.items.map((item) => item.serviceId),
			);
			this.assertItemsHaveMeasuredValue(input.items, servicesById);
			const ledgerContext = await cmRepository.getContractLedgerContext(
				ownerId,
				contractId,
			);
			if (ledgerContext) {
				await this.resolveMeasurementCoverage(
					ownerId,
					ledgerContext.workId,
					contractId,
					input.items,
					prisma,
				);
			}
			const exceedingItems = await this.findExceedingItems(
				ownerId,
				contractId,
				input.items,
			);
			if (exceedingItems.length > 0) {
				if (ctx.role === "SUPERVISOR") {
					throw new ConstructionError(
						"MEASUREMENT_EXCEEDS_BALANCE",
						"Medicao acima do saldo do servico do contrato — ajuste os valores ou crie uma nova medicao",
						422,
					);
				}
				warnings.push({
					code: "MEASUREMENT_EXCEEDS_BALANCE",
					severity: "warning",
					message:
						"Medição acima do saldo do serviço do contrato — concluída com aviso",
				});
			}
		}

		const result = await cmRepository.updateMeasurement(
			ownerId,
			contractId,
			measurementId,
			input,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}

		if (input.items) {
			await measurementCoverageService.reconcileContractMeasurement(
				ownerId,
				measurementId,
			);
		}

		if (input.items && previous) {
			await auditService.log({
				userId: ctx.userId,
				ownerId,
				action: "UPDATE",
				entityType: "CONTRACT_MEASUREMENT",
				entityId: measurementId,
				entityDescription: `Medicao #${result.number} - ${result.title}`,
				previousState: {
					...previous,
					items: previous.items,
				},
				newState: {
					...result,
					items: result.items,
				},
			});
		}

		return {
			...result,
			approvalStatus: "APPROVED",
			approvalRequestId: null,
			warnings,
		};
	}

	async deleteMeasurement(
		ownerId: string,
		contractId: string,
		measurementId: string,
	) {
		await this.assertWritable(ownerId, contractId);
		const ledgerContext = await cmRepository.getContractLedgerContext(
			ownerId,
			contractId,
		);
		if (!ledgerContext) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		const scope = await resolveResourceScope(ownerId, {
			workId: ledgerContext.workId,
		});

		const result = await withSerializableRetry(async (tx) => {
			const paidPayments = await cmRepository.countPaidPaymentsForMeasurement(
				tx,
				ownerId,
				measurementId,
			);
			if (paidPayments > 0) {
				throw new ConstructionError(
					"MEASUREMENT_PAID_REQUIRES_PAYMENT_REVERSAL",
					"Medicao com pagamento registrado: estorne o pagamento antes de reverter",
					422,
				);
			}

			const events = await findLedgerEventsBySource(tx, {
				sourceType: MEASUREMENT_SOURCE_TYPE,
				sourceId: measurementId,
			});
			for (const reversal of reverseLedgerEvents(events)) {
				if (reversal.eventType === "INCURRED_REVERSAL") continue;
				await appendLedgerEvent(
					{
						scope,
						workId: ledgerContext.workId,
						budgetItemIdentityId: reversal.budgetItemIdentityId,
						budgetVersionItemId: reversal.budgetVersionItemId,
						eventType: reversal.eventType as never,
						sourceType: MEASUREMENT_SOURCE_TYPE,
						sourceId: measurementId,
						componentId: reversal.componentId,
						amount: reversal.amount,
						competence: competenceOf(new Date()),
						occurredAt: new Date(),
						approvalDecisionId: null,
					},
					tx,
				);
			}

			const impacts = await findActiveImpactsBySource(
				tx,
				ownerId,
				ledgerContext.workId,
				MEASUREMENT_SOURCE_TYPE,
				measurementId,
			);
			for (const impact of impacts.filter(
				(candidate) => candidate.impactType === "CONSUMPTION",
			)) {
				if (impact.status === "APPROVED") {
					await budgetControlService.reverse(
						ownerId,
						impact.id,
						{ userId: ownerId },
						tx,
					);
				} else if (impact.status === "PENDING") {
					await budgetControlService.reject(
						ownerId,
						impact.id,
						{ userId: ownerId },
						tx,
					);
				}
			}

			const deleted = await cmRepository.deleteMeasurement(
				ownerId,
				contractId,
				measurementId,
				tx,
			);
			if (!deleted) {
				throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
			}
			return deleted;
		});

		return result;
	}

	async getContractAggregate(ownerId: string, contractId: string) {
		const result = await cmRepository.getContractAggregate(ownerId, contractId);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return result;
	}

	async getMeasurementMap(ownerId: string, contractId: string) {
		return cmRepository.getMeasurementMap(ownerId, contractId);
	}

	async listPayments(
		ownerId: string,
		contractId: string,
		filters?: { page?: number; limit?: number },
	) {
		return cmRepository.listPayments(ownerId, contractId, filters);
	}

	async getPayment(ownerId: string, contractId: string, paymentId: string) {
		const result = await cmRepository.getPaymentById(
			ownerId,
			contractId,
			paymentId,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Pagamento nao encontrado", 404);
		}
		return result;
	}

	async createPayment(
		ownerId: string,
		contractId: string,
		input: CreateContractPaymentInput,
		ctx: { userId: string; role: MeasurementActorRole },
	) {
		await this.assertWritable(ownerId, contractId);

		const effectiveStatus = input.status ?? "EM_ABERTO";
		const ledgerContext = await cmRepository.getContractLedgerContext(
			ownerId,
			contractId,
		);
		let paymentEventPlan: {
			scope: Awaited<ReturnType<typeof resolveResourceScope>>;
			workId: string;
			ref: { identityId: string; versionItemId: string };
		} | null = null;
		if (ledgerContext && effectiveStatus === "PAGO" && input.paidValue > 0) {
			const ref = await this.paymentBudgetRef(
				ownerId,
				ledgerContext.workId,
				contractId,
			);
			if (ref) {
				paymentEventPlan = {
					scope: await resolveResourceScope(ownerId, {
						workId: ledgerContext.workId,
					}),
					workId: ledgerContext.workId,
					ref,
				};
			}
		}

		const created = await withSerializableRetry(async (tx) => {
			const balance = await cmRepository.getPaymentBalance(
				ownerId,
				contractId,
				{
					tx,
				},
			);
			if (!balance) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Contrato nao encontrado",
					404,
				);
			}

			const exceeds =
				effectiveStatus === "PAGO" &&
				input.paidValue > balance.derivedTotal - balance.totalPaid;
			if (exceeds) {
				if (input.balanceOverride) {
					this.assertPaymentOverrideAllowed(ctx.role, input.reason);
				} else {
					throw new ConstructionError(
						"PAYMENT_EXCEEDS_BALANCE",
						"Pagamento acima do saldo do contrato",
						422,
					);
				}
			}

			const created = await cmRepository.createPayment(
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

			if (paymentEventPlan) {
				await appendLedgerEvent(
					buildPaymentCreateEvent(
						{
							scope: paymentEventPlan.scope,
							workId: paymentEventPlan.workId,
							budgetItemIdentityId: paymentEventPlan.ref.identityId,
							budgetVersionItemId: paymentEventPlan.ref.versionItemId,
							sourceType: PAYMENT_SOURCE_TYPE,
							sourceId: created.id,
							competence: competenceOf(created.date),
							occurredAt: created.date,
							approvalDecisionId: null,
						},
						new Decimal(input.paidValue),
					),
					tx,
				);
			}

			if (exceeds && input.balanceOverride) {
				await writeAudit(tx, {
					userId: ctx.userId,
					ownerId,
					action: "CREATE",
					entityType: "CONTRACT_PAYMENT",
					entityId: created.id,
					entityDescription:
						created.description ?? `Pagamento - ${created.date}`,
					newState: {
						balanceOverride: true,
						reason: input.reason ?? null,
						paidValue: input.paidValue,
						availableBalance: balance.derivedTotal - balance.totalPaid,
					},
				});
			}
			return created;
		});

		return created;
	}

	async updatePayment(
		ownerId: string,
		contractId: string,
		paymentId: string,
		input: UpdateContractPaymentInput,
		ctx: { userId: string; role: MeasurementActorRole },
	) {
		await this.assertWritable(ownerId, contractId);
		const existing = await cmRepository.getPaymentById(
			ownerId,
			contractId,
			paymentId,
		);
		if (!existing) {
			throw new ConstructionError("NOT_FOUND", "Pagamento nao encontrado", 404);
		}

		const balance = await cmRepository.getPaymentBalance(ownerId, contractId, {
			excludePaymentId: paymentId,
		});
		if (!balance) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}

		const effectiveStatus = input.status ?? existing.status;
		const effectivePaidValue =
			input.paidValue ?? toFiniteNumber(existing.paidValue);
		const availableBalance = balance.derivedTotal - balance.totalPaid;
		const exceeds =
			effectiveStatus === "PAGO" && effectivePaidValue > availableBalance;
		if (exceeds) {
			if (input.balanceOverride) {
				this.assertPaymentOverrideAllowed(ctx.role, input.reason);
			} else {
				throw new ConstructionError(
					"PAYMENT_EXCEEDS_BALANCE",
					"Pagamento acima do saldo do contrato",
					422,
				);
			}
		}

		const result = await cmRepository.updatePayment(
			ownerId,
			contractId,
			paymentId,
			input,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Pagamento nao encontrado", 404);
		}

		if (exceeds && input.balanceOverride) {
			await auditService.log({
				userId: ctx.userId,
				ownerId,
				action: "UPDATE",
				entityType: "CONTRACT_PAYMENT",
				entityId: paymentId,
				entityDescription:
					existing.description ?? `Pagamento - ${existing.date}`,
				previousState: {
					paidValue: toFiniteNumber(existing.paidValue),
					status: existing.status,
				},
				newState: {
					balanceOverride: true,
					reason: input.reason ?? null,
					paidValue: effectivePaidValue,
					status: effectiveStatus,
					availableBalance,
				},
			});
		}

		return result;
	}

	async deletePayment(ownerId: string, contractId: string, paymentId: string) {
		await this.assertWritable(ownerId, contractId);
		const ledgerContext = await cmRepository.getContractLedgerContext(
			ownerId,
			contractId,
		);
		const reversalPlan = ledgerContext
			? {
					scope: await resolveResourceScope(ownerId, {
						workId: ledgerContext.workId,
					}),
					workId: ledgerContext.workId,
				}
			: null;
		const result = await withSerializableRetry(async (tx) => {
			if (reversalPlan) {
				const events = await findLedgerEventsBySourcePrefix(tx, {
					sourceType: PAYMENT_SOURCE_TYPE,
					sourceIdPrefix: paymentId,
				});
				for (const event of events) {
					if (event.eventType !== "PAYMENT_CREATE") continue;
					await appendLedgerEvent(
						{
							scope: reversalPlan.scope,
							workId: reversalPlan.workId,
							budgetItemIdentityId: event.budgetItemIdentityId,
							budgetVersionItemId: event.budgetVersionItemId,
							eventType: "PAYMENT_REVERSAL",
							sourceType: PAYMENT_SOURCE_TYPE,
							sourceId: event.sourceId ?? paymentId,
							componentId: event.componentId,
							amount: event.amount,
							competence: competenceOf(new Date()),
							occurredAt: new Date(),
							approvalDecisionId: null,
						},
						tx,
					);
				}
			}
			const deleted = await cmRepository.deletePayment(
				ownerId,
				contractId,
				paymentId,
			);
			if (!deleted) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Pagamento nao encontrado",
					404,
				);
			}
			return deleted;
		});
		return result;
	}

	async getPaymentsSummary(ownerId: string, contractId: string) {
		const result = await cmRepository.getPaymentsSummary(ownerId, contractId);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return result;
	}

	private async paymentBudgetRef(
		ownerId: string,
		workId: string,
		contractId: string,
	) {
		const service = await prisma.contractService.findFirst({
			where: {
				contractId,
				contract: { ownerId },
				budgetItemId: { not: null },
			},
			orderBy: { sortOrder: "asc" },
			select: { budgetItemId: true },
		});
		if (!service?.budgetItemId) return null;
		return resolveLedgerItemRef(ownerId, workId, service.budgetItemId);
	}
}

export const contractMeasurementService = new ContractMeasurementService();
