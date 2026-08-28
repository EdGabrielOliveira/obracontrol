import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { toFiniteNumber } from "../../lib/number-utils";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import { withSerializableRetry } from "../../lib/transaction-retry";
import { auditService } from "../audit/audit.service";
import type { MeasurementActorRole } from "../governance/governance.service";
import { findActiveImpactsBySource } from "./budget-control/budget-control.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import {
	type ContractGovernanceScope,
	contractGovernanceScope,
} from "./contract-governance-scope";
import type {
	ContractMeasurementItemPayload,
	ContractServiceTotalsExport,
} from "./contract-measurement.repository";
import * as cmRepository from "./contract-measurement.repository";
import { setContractMeasurementStatus } from "./contract-measurement-status.service";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "./governance-guard";
import {
	buildPaymentCreateEvent,
	competenceOf,
	MEASUREMENT_SOURCE_TYPE,
	PAYMENT_SOURCE_TYPE,
	resolveLedgerItemRef,
	reverseLedgerEvents,
} from "./ledger/ledger.integration";
import {
	findLedgerEventsBySource,
	findLedgerEventsBySourcePrefix,
} from "./ledger/ledger.repository";
import { appendLedgerEvent } from "./ledger/ledger.service";
import {
	buildMeasurementDateWarning,
	type MeasurementWarning,
} from "./measurement-common";
import type {
	CreateContractMeasurementInput,
	CreateContractPaymentInput,
	UpdateContractMeasurementInput,
	UpdateContractPaymentInput,
} from "./schemas/contract.schema";
import { normalizeWorkOperationalStatus } from "./works/work-operational-status";

type ExceedingItem = {
	serviceId: string;
	accumulatedValue: number;
	totalCost: number;
};

export class ContractMeasurementService {
	constructor(
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
		private readonly scope: ContractGovernanceScope = contractGovernanceScope,
	) {}

	private async assertWritable(ownerId: string, contractId: string) {
		const workId = await this.scope.getWorkId(ownerId, contractId);
		if (workId) {
			await this.governance.assertWritable(ownerId, "CONTRACT", workId);
			await this.governance.assertWritable(
				ownerId,
				"CONTRACT_STATUS",
				contractId,
			);
		}
	}

	private async findExceedingItems(
		ownerId: string,
		contractId: string,
		items: Array<{
			serviceId: string;
			measuredQuantity?: number | null;
			accumulatedQuantity?: number | null;
		}>,
		excludeMeasurementId?: string,
		db: Prisma.TransactionClient | typeof prisma = prisma,
	): Promise<ExceedingItem[]> {
		if (items.length === 0) return [];
		const serviceIds = [...new Set(items.map((i) => i.serviceId))];
		const [servicesById, previousMeasurements] = await Promise.all([
			cmRepository.getContractServicesById(db, ownerId, contractId, serviceIds),
			db.contractMeasurement.findMany({
				where: {
					ownerId,
					contractId,
					status: { notIn: ["RECUSADO", "ARQUIVADO"] },
					...(excludeMeasurementId
						? { id: { not: excludeMeasurementId } }
						: {}),
				},
				select: {
					items: {
						select: {
							serviceId: true,
							measuredQuantity: true,
							accumulatedQuantity: true,
						},
					},
				},
			}),
		]);
		const previousQuantityByService = new Map<string, number>();
		for (const measurement of previousMeasurements) {
			for (const item of measurement.items) {
				const quantity = toFiniteNumber(
					item.measuredQuantity ?? item.accumulatedQuantity,
				);
				previousQuantityByService.set(
					item.serviceId,
					(previousQuantityByService.get(item.serviceId) ?? 0) + quantity,
				);
			}
		}
		const currentQuantityByService = new Map<string, number>();
		for (const item of items) {
			currentQuantityByService.set(
				item.serviceId,
				(currentQuantityByService.get(item.serviceId) ?? 0) +
					toFiniteNumber(item.measuredQuantity ?? item.accumulatedQuantity),
			);
		}
		const exceeding: ExceedingItem[] = [];
		for (const [serviceId, currentQuantity] of currentQuantityByService) {
			const service = servicesById.get(serviceId);
			if (!service) continue;
			const accumulatedQuantity =
				(previousQuantityByService.get(serviceId) ?? 0) + currentQuantity;
			if (accumulatedQuantity > service.quantity) {
				exceeding.push({
					serviceId,
					accumulatedValue: accumulatedQuantity * service.unitCost,
					totalCost: service.quantity * service.unitCost,
				});
			}
		}
		return exceeding;
	}

	private assertItemsHaveMeasuredQuantity(
		items: ContractMeasurementItemPayload[],
		servicesById: Map<string, ContractServiceTotalsExport>,
	) {
		const invalid = items.filter((item) => {
			const service = servicesById.get(item.serviceId);
			return (
				item.measuredQuantity == null ||
				toFiniteNumber(item.measuredQuantity) <= 0 ||
				!service ||
				service.quantity <= 0
			);
		});
		if (invalid.length > 0) {
			throw new ConstructionError(
				"INVALID_MEASUREMENT_ITEM",
				`Item de medicao sem quantidade contratada ou quantidade medida valida (servicos: ${invalid.map((item) => item.serviceId).join(", ")})`,
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
		const pendingApproval = await prisma.approvalRequest.findFirst({
			where: {
				ownerId,
				resourceId: measurementId,
				effectAction: "CONTRACT_MEASUREMENT_APPROVE",
				status: "PENDING",
			},
			select: { id: true },
		});
		if (!pendingApproval) return measurement;
		return {
			...measurement,
			measurement: {
				...measurement.measurement,
				approvalStatus: "PENDING_APPROVAL" as const,
				approvalRequestId: pendingApproval.id,
			},
		};
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
		const linkedWork = await cmRepository.getContractLedgerContext(
			ownerId,
			contractId,
		);
		if (linkedWork) {
			const work = await prisma.constructionWork.findFirst({
				where: { id: linkedWork.workId, ownerId },
				select: { operationalStatus: true },
			});
			const status = normalizeWorkOperationalStatus(work?.operationalStatus);
			if (status === "SUSPENDED" || status === "DONE" || status === "IGNORED") {
				throw new ConstructionError(
					"WORK_NOT_ACCEPTING_ENTRIES",
					"A obra suspensa, concluida ou arquivada nao aceita novas medicoes",
					422,
				);
			}
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
		const servicesById = await cmRepository.getContractServicesById(
			prisma,
			ownerId,
			contractId,
			input.items.map((item) => item.serviceId),
		);
		this.assertItemsHaveMeasuredQuantity(input.items, servicesById);

		const created = await withSerializableRetry(async (tx) => {
			const exceedingItems = await this.findExceedingItems(
				ownerId,
				contractId,
				input.items,
				undefined,
				tx,
			);
			if (exceedingItems.length > 0) {
				throw new ConstructionError(
					"MEASUREMENT_EXCEEDS_BALANCE",
					"Medicao acima do saldo do servico do contrato; ajuste os valores ou crie uma nova medicao",
					422,
				);
			}

			const created = await cmRepository.createMeasurement(
				ownerId,
				contractId,
				{
					...input,
					createdBy: ctx.userId,
					status: "RASCUNHO",
				} as CreateContractMeasurementInput & {
					createdBy: string;
					status: string;
				},
				tx,
			);
			if (!created) {
				throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
			}

			return created;
		});

		let approvalStatus: "APPROVED" | "PENDING_APPROVAL" | undefined;
		let approvalRequestId: string | null = null;
		if (ctx.role === "SUPERVISOR") {
			const { submitApproval } = await import("../governance/approval.service");
			const request = await submitApproval({
				actorId: ctx.userId,
				resourceType: "CONTRACT_MEASUREMENT",
				resourceId: created.id,
				effectAction: "CONTRACT_MEASUREMENT_APPROVE",
				payload: {
					workId: ledgerContext.workId,
					contractId,
					measurementId: created.id,
				},
				expectedVersion: 1,
				idempotencyKey: `cm-create-${created.id}`,
			});
			approvalStatus =
				request.status === "PENDING" ? "PENDING_APPROVAL" : "APPROVED";
			approvalRequestId = request.approvalRequestId;
		}

		return { ...created, approvalStatus, approvalRequestId, warnings };
	}

	async updateMeasurement(
		ownerId: string,
		contractId: string,
		measurementId: string,
		input: UpdateContractMeasurementInput,
		ctx: { userId: string; role: MeasurementActorRole },
	) {
		await this.assertWritable(ownerId, contractId);

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
			this.assertItemsHaveMeasuredQuantity(input.items, servicesById);
			const exceedingItems = await this.findExceedingItems(
				ownerId,
				contractId,
				input.items,
				measurementId,
			);
			if (exceedingItems.length > 0) {
				throw new ConstructionError(
					"MEASUREMENT_EXCEEDS_BALANCE",
					"Medicao acima do saldo do servico do contrato — ajuste os valores ou crie uma nova medicao",
					422,
				);
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

	async setMeasurementStatus(
		ownerId: string,
		contractId: string,
		measurementId: string,
		status: "RASCUNHO" | "ACEITO" | "RECUSADO" | "ARQUIVADO",
		reason: string | null | undefined,
		role: MeasurementActorRole,
		actorId: string,
	) {
		return setContractMeasurementStatus({
			ownerId,
			contractId,
			measurementId,
			status,
			reason,
			role,
			actorId,
			assertWritable: () => this.assertWritable(ownerId, contractId),
			getMeasurement: () =>
				this.getMeasurement(ownerId, contractId, measurementId),
		});
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
		filters?: { q?: string; page?: number; limit?: number },
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
				throw new ConstructionError(
					"PAYMENT_EXCEEDS_BALANCE",
					"Pagamento acima do saldo do contrato",
					422,
				);
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

			return created;
		});

		return created;
	}

	async updatePayment(
		ownerId: string,
		contractId: string,
		paymentId: string,
		input: UpdateContractPaymentInput,
		ctx: { userId: string },
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
			throw new ConstructionError(
				"PAYMENT_EXCEEDS_BALANCE",
				"Pagamento acima do saldo do contrato",
				422,
			);
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

		if (existing.status !== result.status) {
			await auditService.log({
				userId: ctx.userId,
				ownerId,
				action: "STATUS_CHANGED",
				entityType: "CONTRACT_PAYMENT",
				entityId: paymentId,
				entityDescription:
					existing.description ?? `Pagamento - ${existing.date}`,
				previousState: { status: existing.status },
				newState: { status: result.status },
				metadata: {
					statusField: "status",
					fromStatus: existing.status,
					toStatus: result.status,
					contractId,
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
