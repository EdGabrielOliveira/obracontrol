import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { writeAudit } from "../../lib/audit-writer";
import { ConstructionError } from "../../lib/errors";
import type { GovernanceRole } from "../../lib/status-machine";
import { withSerializableRetry } from "../../lib/transaction-retry";
import { auditService } from "../audit/audit.service";
import { getBudgetItemReferences } from "./budget-control/budget-control.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import type { BudgetMutationResult } from "./budget-control/budget-control.types";
import { deriveWorkMeasurementItem } from "./calculators/work-measurement-calculator";
import {
	assertNoPendingEffect,
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "./governance-guard";
import { measurementCoverageService } from "./measurement-coverage.service";
import { getWorkOrThrow } from "./repository";
import type {
	CreateWorkMeasurementInput,
	UpdateWorkMeasurementInput,
	WorkMeasurementItemInput,
} from "./schemas/work-measurement.schema";
import * as wmRepository from "./work-measurement.repository";

type WorkPeriod = {
	plannedStart?: Date | string | null;
	plannedEnd?: Date | string | null;
};

function toDayUtc(value: Date): number {
	return Date.UTC(
		value.getUTCFullYear(),
		value.getUTCMonth(),
		value.getUTCDate(),
	);
}

type PersistedMeasurementItem = {
	budgetItemId: string;
	measuredQuantity: number;
	measuredValue: number;
	measuredPercentage: number;
	accumulatedQuantity: number;
	accumulatedValue: number;
	accumulatedPercentage: number;
};

type PreparedMeasurement = {
	items: PersistedMeasurementItem[];
	availableQuantityByBudgetItemId: Record<string, number>;
};

function assertMeasurementDateInPeriod(work: WorkPeriod, date: string) {
	const plannedStart = work.plannedStart ? new Date(work.plannedStart) : null;
	const plannedEnd = work.plannedEnd ? new Date(work.plannedEnd) : null;
	if (!plannedStart || !plannedEnd) return;
	const measurementDay = toDayUtc(new Date(date));
	if (
		measurementDay < toDayUtc(plannedStart) ||
		measurementDay > toDayUtc(plannedEnd)
	) {
		const allowed = `${plannedStart.toISOString().slice(0, 10)} a ${plannedEnd.toISOString().slice(0, 10)}`;
		throw new ConstructionError(
			"MEASUREMENT_DATE_OUT_OF_PERIOD",
			`Data da medicao fora do periodo da obra (permitido: ${allowed})`,
			422,
		);
	}
}

export class WorkMeasurementService {
	constructor(
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
	) {}

	async list(
		ownerId: string,
		workId: string,
		filters?: { q?: string; page?: number; limit?: number },
	) {
		await getWorkOrThrow(ownerId, workId);
		return wmRepository.listWorkMeasurements(ownerId, workId, filters);
	}

	async get(ownerId: string, workId: string, measurementId: string) {
		await getWorkOrThrow(ownerId, workId);
		const measurement = await wmRepository.getWorkMeasurementDetail(
			ownerId,
			workId,
			measurementId,
		);
		if (!measurement) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}
		return measurement;
	}

	private assertOverrideAllowed(
		role: GovernanceRole,
		evidenceNote: string | null | undefined,
	) {
		if (role !== "ADMIN") {
			throw new ConstructionError(
				"GOVERNANCE_OVERRIDE_REQUIRED",
				"Somente ADMIN pode executar override administrativo",
				403,
			);
		}
		if (!evidenceNote?.trim()) {
			throw new ConstructionError(
				"OVERRIDE_REASON_REQUIRED",
				"Nota de evidencia obrigatoria para override",
				422,
			);
		}
	}

	private async prepareItems(
		ownerId: string,
		workId: string,
		items: WorkMeasurementItemInput[],
		tx: Prisma.TransactionClient,
		options: { allowExceedingBalance: boolean; excludeMeasurementId?: string },
	): Promise<PreparedMeasurement> {
		if (items.length === 0) {
			throw new ConstructionError(
				"BUDGET_ITEM_REQUIRED",
				"Informe ao menos um item de orcamento",
				422,
			);
		}
		const budgetItemIds = items.map((item) => item.budgetItemId);
		if (new Set(budgetItemIds).size !== budgetItemIds.length) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Nao repita o mesmo item de orcamento na medicao",
				422,
			);
		}

		const references = await getBudgetItemReferences(
			ownerId,
			workId,
			budgetItemIds,
			tx,
		);
		if (references.missing.length > 0) {
			throw new ConstructionError(
				"BUDGET_ITEM_WRONG_WORK",
				"Item de orcamento nao pertence a obra informada",
				422,
			);
		}
		if (references.found.length !== budgetItemIds.length) {
			throw new ConstructionError(
				"BUDGET_VERSION_NOT_AVAILABLE",
				"Nenhuma versao de orcamento ativa com itens para a obra",
				422,
			);
		}

		const previousQuantities =
			await wmRepository.getLatestWorkMeasurementQuantities(
				ownerId,
				workId,
				budgetItemIds,
				tx,
				options.excludeMeasurementId,
			);
		const referenceById = new Map(
			references.found.map((reference) => [reference.budgetItemId, reference]),
		);
		const persistedItems: PersistedMeasurementItem[] = [];
		const availableQuantityByBudgetItemId: Record<string, number> = {};

		for (const item of items) {
			if (
				!Number.isFinite(item.measuredQuantity) ||
				item.measuredQuantity <= 0
			) {
				throw new ConstructionError(
					"INVALID_INPUT",
					"Quantidade medida deve ser maior que zero",
					422,
				);
			}
			const reference = referenceById.get(item.budgetItemId);
			if (
				!reference ||
				!reference.operationalBudgetItemId ||
				reference.quantity == null ||
				reference.unitCost == null
			) {
				throw new ConstructionError(
					"BUDGET_ITEM_NOT_PROJECTED",
					"Item do orçamento ainda não foi projetado para uso operacional",
					422,
				);
			}
			const operationalBudgetItemId = reference.operationalBudgetItemId;

			let derived: ReturnType<typeof deriveWorkMeasurementItem>;
			try {
				derived = deriveWorkMeasurementItem({
					measuredQuantity: new Decimal(item.measuredQuantity),
					previousAccumulatedQuantity:
						previousQuantities[item.budgetItemId] ?? new Decimal(0),
					plannedQuantity: reference.quantity,
					unitCost: reference.unitCost,
					allowExceedingBalance: options.allowExceedingBalance,
				});
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("available quantity")
				) {
					throw new ConstructionError(
						"MEASUREMENT_EXCEEDS_BALANCE",
						"Medicao acima do saldo de quantidade do item de orcamento",
						422,
					);
				}
				throw new ConstructionError(
					"INVALID_INPUT",
					"Quantidade da medicao invalida",
					422,
				);
			}

			availableQuantityByBudgetItemId[operationalBudgetItemId] =
				derived.availableQuantity.toNumber();
			persistedItems.push({
				budgetItemId: operationalBudgetItemId,
				measuredQuantity: derived.measuredQuantity.toNumber(),
				measuredValue: derived.measuredValue.toNumber(),
				measuredPercentage: derived.measuredPercentage.toNumber(),
				accumulatedQuantity: derived.accumulatedQuantity.toNumber(),
				accumulatedValue: derived.accumulatedValue.toNumber(),
				accumulatedPercentage: derived.accumulatedPercentage.toNumber(),
			});
		}

		return {
			items: persistedItems,
			availableQuantityByBudgetItemId,
		};
	}

	private formatMutationResult(
		measurement: {
			items: Array<Record<string, unknown>>;
			[key: string]: unknown;
		},
		prepared: PreparedMeasurement,
		budgetResult: {
			allocations: Array<{ budgetItemId: string; status: string }>;
		},
	) {
		const allocationByItem = new Map(
			budgetResult.allocations.map((allocation) => [
				allocation.budgetItemId,
				allocation.status,
			]),
		);
		return {
			...measurement,
			items: measurement.items.map((item) => ({
				...item,
				measuredQuantity: Number(item.measuredQuantity ?? 0),
				measuredValue: Number(item.measuredValue ?? 0),
				measuredPercentage: Number(item.measuredPercentage ?? 0),
				accumulatedQuantity: Number(item.accumulatedQuantity ?? 0),
				accumulatedValue: Number(item.accumulatedValue ?? 0),
				accumulatedPercentage: Number(item.accumulatedPercentage ?? 0),
				availableQuantity:
					prepared.availableQuantityByBudgetItemId[String(item.budgetItemId)] ??
					0,
				impactStatus:
					allocationByItem.get(String(item.budgetItemId)) ?? "APPROVED",
			})),
		};
	}

	async create(
		ownerId: string,
		workId: string,
		input: CreateWorkMeasurementInput,
		ctx: { userId: string; role: GovernanceRole },
	) {
		if (!input.title?.trim()) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Descricao da medicao obrigatoria",
				422,
			);
		}
		const work = await getWorkOrThrow(ownerId, workId);
		await this.governance.assertWritable(ownerId, "WORK_MEASUREMENTS", workId);
		await assertNoPendingEffect(
			ownerId,
			"WORK",
			workId,
			"WORK_MEASUREMENT_APPROVE",
		);
		assertMeasurementDateInPeriod(work, input.date);
		if (input.balanceOverride) {
			this.assertOverrideAllowed(ctx.role, input.evidenceNote);
		}

		let createdMeasurementId: string | null = null;
		type CreateOperation = {
			measurement: NonNullable<
				Awaited<ReturnType<typeof wmRepository.createWorkMeasurement>>
			>;
			prepared: PreparedMeasurement;
			budgetResult: BudgetMutationResult;
		};
		let operation: CreateOperation;
		try {
			operation = await withSerializableRetry<CreateOperation>(async (tx) => {
				const prepared = await this.prepareItems(
					ownerId,
					workId,
					input.items,
					tx,
					{ allowExceedingBalance: input.balanceOverride === true },
				);
				const created = await wmRepository.createWorkMeasurement(
					ownerId,
					workId,
					{ ...input, items: prepared.items, createdBy: ctx.userId },
					tx,
				);
				if (!created) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Medicao nao encontrada",
						404,
					);
				}
				createdMeasurementId = created.id;

				let budgetResult: BudgetMutationResult;
				try {
					budgetResult = await budgetControlService.apply(
						ownerId,
						workId,
						{
							workId,
							allocations: prepared.items.map((item) => ({
								budgetItemId: item.budgetItemId,
								quantity: item.measuredQuantity,
							})),
							impactType: "CONSUMPTION",
							sourceType: "WORK_MEASUREMENT",
							sourceId: created.id,
							allowPending: input.balanceOverride === true,
							occurredAt: new Date(input.date),
						},
						{ userId: ctx.userId },
						tx,
					);
				} catch (error) {
					if (
						error instanceof ConstructionError &&
						error.code === "BUDGET_BALANCE_EXCEEDED"
					) {
						throw new ConstructionError(
							"MEASUREMENT_EXCEEDS_BALANCE",
							"Medicao acima do saldo do item de orcamento",
							422,
						);
					}
					throw error;
				}

				if (input.balanceOverride) {
					await writeAudit(tx, {
						userId: ctx.userId,
						ownerId,
						action: "CREATE",
						entityType: "WORK_MEASUREMENT",
						entityId: created.id,
						entityDescription: `Medicao ${created.id}`,
						newState: {
							balanceOverride: true,
							evidenceNote: input.evidenceNote ?? null,
						},
					});
				}

				return { measurement: created, prepared, budgetResult };
			});
		} catch (error) {
			if (createdMeasurementId) {
				await wmRepository.rollbackWorkMeasurementCreation(
					ownerId,
					workId,
					createdMeasurementId,
				);
			}
			throw error;
		}

		await this.submitMeasurementApproval(workId, operation.measurement, ctx);

		return this.formatMutationResult(
			operation.measurement as {
				items: Array<Record<string, unknown>>;
				[key: string]: unknown;
			},
			operation.prepared,
			operation.budgetResult,
		);
	}

	private async submitMeasurementApproval(
		workId: string,
		measurement: { id: string; title?: string | null },
		ctx: { userId: string; role: GovernanceRole },
	): Promise<void> {
		const { submitApproval } = await import("../governance/approval.service");
		await submitApproval({
			actorId: ctx.userId,
			resourceType: "WORK_MEASUREMENT",
			resourceId: measurement.id,
			effectAction: "WORK_MEASUREMENT_APPROVE",
			payload: {
				workId,
				measurementId: measurement.id,
				description: measurement.title ?? null,
			},
			expectedVersion: 1,
			idempotencyKey: `wm-create-${measurement.id}`,
		});
	}
	async update(
		ownerId: string,
		workId: string,
		measurementId: string,
		input: UpdateWorkMeasurementInput,
		ctx: { userId: string; role: GovernanceRole },
	) {
		const work = await getWorkOrThrow(ownerId, workId);
		await this.governance.assertWritable(ownerId, "WORK_MEASUREMENTS", workId);

		if (
			input.items === undefined &&
			(input.balanceOverride || input.evidenceNote != null)
		) {
			throw new ConstructionError(
				"INVALID_MEASUREMENT_OVERRIDE",
				"Override de medicao exige itens",
				422,
			);
		}

		if (input.date !== undefined) {
			assertMeasurementDateInPeriod(work, input.date);
		}
		if (!input.items) {
			const metadata = {
				title: input.title,
				date: input.date,
				balanceOverride: input.balanceOverride,
				evidenceNote: input.evidenceNote,
			};
			const result = await wmRepository.updateWorkMeasurement(
				ownerId,
				workId,
				measurementId,
				metadata,
			);
			if (!result) {
				throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
			}
			return result;
		}

		if (input.balanceOverride) {
			this.assertOverrideAllowed(ctx.role, input.evidenceNote);
		}
		const operation = await withSerializableRetry(async (tx) => {
			const hasCoverages =
				await measurementCoverageService.hasCoveragesForWorkMeasurement(
					ownerId,
					measurementId,
				);
			if (hasCoverages) {
				throw new ConstructionError(
					"BUDGET_MEASUREMENT_ALREADY_COVERED",
					"Remova as coberturas contratuais antes de alterar a medicao de obra",
					422,
				);
			}
			const prepared = await this.prepareItems(
				ownerId,
				workId,
				input.items ?? [],
				tx,
				{
					allowExceedingBalance: input.balanceOverride === true,
					excludeMeasurementId: measurementId,
				},
			);
			const result = await wmRepository.updateWorkMeasurement(
				ownerId,
				workId,
				measurementId,
				{ ...input, items: prepared.items },
				tx,
			);
			if (!result) {
				throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
			}

			let budgetResult: BudgetMutationResult;
			try {
				budgetResult = await budgetControlService.replaceSourceImpact(
					ownerId,
					workId,
					{
						workId,
						allocations: prepared.items.map((item) => ({
							budgetItemId: item.budgetItemId,
							quantity: item.measuredQuantity,
						})),
						impactType: "CONSUMPTION",
						sourceType: "WORK_MEASUREMENT",
						sourceId: measurementId,
						allowPending: input.balanceOverride === true,
						occurredAt: input.date ? new Date(input.date) : new Date(),
					},
					{ userId: ctx.userId },
					tx,
				);
			} catch (error) {
				if (
					error instanceof ConstructionError &&
					error.code === "BUDGET_BALANCE_EXCEEDED"
				) {
					throw new ConstructionError(
						"MEASUREMENT_EXCEEDS_BALANCE",
						"Medicao acima do saldo do item de orcamento",
						422,
					);
				}
				throw error;
			}
			return { result, prepared, budgetResult };
		});

		if (operation.result) {
			await auditService.log({
				userId: ctx.userId,
				ownerId,
				action: "UPDATE",
				entityType: "WORK_MEASUREMENT",
				entityId: measurementId,
				entityDescription: `Medicao #${operation.result.number} - ${operation.result.title}`,
				previousState: { measurementId },
				newState: {
					...operation.result,
					items: operation.result.items,
				},
			});
		}

		return this.formatMutationResult(
			operation.result as {
				items: Array<Record<string, unknown>>;
				[key: string]: unknown;
			},
			operation.prepared,
			operation.budgetResult,
		);
	}

	async delete(ownerId: string, workId: string, measurementId: string) {
		await getWorkOrThrow(ownerId, workId);
		await this.governance.assertWritable(ownerId, "WORK_MEASUREMENTS", workId);
		const result = await wmRepository.deleteWorkMeasurement(
			ownerId,
			workId,
			measurementId,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}
		return result;
	}

	async getMap(ownerId: string, workId: string) {
		await getWorkOrThrow(ownerId, workId);
		return wmRepository.getWorkMeasurementMapDetail(ownerId, workId);
	}

	async getReports(ownerId: string, workId: string) {
		await getWorkOrThrow(ownerId, workId);
		return wmRepository.getWorkMeasurementReports(ownerId, workId);
	}

	async getReport(ownerId: string, workId: string, measurementId: string) {
		await getWorkOrThrow(ownerId, workId);
		const result = await wmRepository.getWorkMeasurementReportById(
			ownerId,
			workId,
			measurementId,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}
		return result;
	}

	async getSummary(ownerId: string, workId: string) {
		await getWorkOrThrow(ownerId, workId);
		return wmRepository.getWorkMeasurementSummary(ownerId, workId);
	}
}

export const workMeasurementService = new WorkMeasurementService();
