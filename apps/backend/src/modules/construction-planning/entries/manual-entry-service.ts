import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { resolveResourceScope } from "../../../lib/resource-scope";
import { withSerializableRetry } from "../../../lib/transaction-retry";
import { normalizeCostAllocations } from "../budget-control/budget-control.calculator";
import { findActiveImpactsBySource } from "../budget-control/budget-control.repository";
import { budgetControlService } from "../budget-control/budget-control.service";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "../governance-guard";
import {
	buildGeneralCostEvents,
	competenceOf,
	GENERAL_COST_SOURCE_TYPE,
	resolveLedgerItemRef,
} from "../ledger/ledger.integration";
import { appendLedgerEvent } from "../ledger/ledger.service";
import type * as constructionRepository from "../repository";
import * as constructionRepositoryModule from "../repository";
import type {
	CreateActualCostInput,
	CreateMeasurementInput,
	ImportActualCostRow,
	UpdateActualCostInput,
} from "../schema";

function assertFutureCostPaymentStatus(
	costType: string | undefined,
	paymentStatus: string | undefined,
) {
	if (costType === "FUTURE" && paymentStatus !== "OPEN") {
		throw new ConstructionError(
			"INVALID_INPUT",
			"Custos futuros devem permanecer com pagamento em aberto",
			422,
		);
	}
}

function assertOtherCategoryDetail(
	category: string | undefined,
	categoryDetail: string | undefined,
) {
	if (category === "OUTROS" && !categoryDetail?.trim()) {
		throw new ConstructionError(
			"INVALID_INPUT",
			"Informe a categoria personalizada",
			422,
		);
	}
}

import { supplierService } from "../suppliers/supplier.service";

type ManualEntryRepository = Pick<
	typeof constructionRepository,
	| "getWorkById"
	| "createMeasurement"
	| "importMeasurements"
	| "listMeasurements"
	| "deleteMeasurement"
	| "createActualCost"
	| "importActualCosts"
	| "listActualCosts"
	| "getActualCostById"
	| "updateActualCost"
	| "deleteActualCost"
>;

export class ConstructionManualEntryService {
	constructor(
		private readonly repository: ManualEntryRepository = constructionRepositoryModule,
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
		private readonly budgetControl: Pick<
			typeof budgetControlService,
			"apply" | "reverse" | "reject"
		> = budgetControlService,
		private readonly supplierScope: Pick<
			typeof supplierService,
			"assertLinkedToWork"
		> = supplierService,
	) {}

	private assertWritable(ownerId: string, workId: string, entityType: string) {
		return this.governance.assertWritable(ownerId, entityType, workId);
	}

	private async getWorkOrThrow(ownerId: string, workId: string) {
		const work = await this.repository.getWorkById(ownerId, workId);
		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return work;
	}

	private async normalizeCostItem(
		ownerId: string,
		workId: string,
		input: CreateActualCostInput,
	): Promise<
		CreateActualCostInput & {
			allocations: NonNullable<CreateActualCostInput["allocations"]>;
		}
	> {
		if (input.allocations?.length)
			return input as CreateActualCostInput & {
				allocations: NonNullable<CreateActualCostInput["allocations"]>;
			};
		if (!input.budgetVersionItemId) {
			throw new ConstructionError(
				"BUDGET_ITEM_REQUIRED",
				"Informe o item da versao vigente",
				422,
			);
		}
		const versionItem = await prisma.budgetVersionItem.findFirst({
			where: {
				id: input.budgetVersionItemId,
				version: { ownerId, workId, isActive: true },
				children: { none: {} },
			},
			select: { identityId: true, index: true, unitCost: true },
		});
		if (!versionItem || versionItem.unitCost == null) {
			throw new ConstructionError(
				"BUDGET_VERSION_NOT_AVAILABLE",
				"Item da versao vigente invalido ou sem custo unitario",
				422,
			);
		}
		const work = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		const operational = await prisma.constructionBudgetItem.findFirst({
			where: {
				ownerId,
				workId,
				OR: [
					{ identityId: versionItem.identityId },
					{ index: versionItem.index },
				],
				...(work?.activeImportId ? { importId: work.activeImportId } : {}),
			},
			select: { id: true },
		});
		return {
			...input,
			allocations: [
				{
					budgetItemId: operational?.id ?? input.budgetVersionItemId,
					percentage: 100,
				},
			],
		};
	}

	async createMeasurement(
		ownerId: string,
		workId: string,
		input: CreateMeasurementInput,
	) {
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_MEASUREMENTS");
		return this.repository.createMeasurement(ownerId, workId, null, input);
	}

	async importMeasurements(
		ownerId: string,
		workId: string,
		rows: CreateMeasurementInput[],
	) {
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_MEASUREMENTS");
		return this.repository.importMeasurements(ownerId, workId, rows);
	}

	listMeasurements(ownerId: string, workId: string) {
		return this.repository.listMeasurements(ownerId, workId);
	}

	async deleteMeasurement(
		ownerId: string,
		workId: string,
		measurementId: string,
	) {
		await this.assertWritable(ownerId, workId, "WORK_MEASUREMENTS");
		await this.governance.assertWritable(
			ownerId,
			"WORK_MEASUREMENT_STATUS",
			measurementId,
		);
		const result = await this.repository.deleteMeasurement(
			ownerId,
			workId,
			measurementId,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}
		return result;
	}

	async createActualCost(
		ownerId: string,
		workId: string,
		input: CreateActualCostInput,
		ctx?: { userId: string },
	) {
		assertFutureCostPaymentStatus(input.costType, input.paymentStatus);
		assertOtherCategoryDetail(input.category, input.categoryDetail);
		if (!input.description?.trim()) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Descricao do custo obrigatoria",
				422,
			);
		}
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		const effectiveInput = await this.normalizeCostItem(ownerId, workId, input);
		if (effectiveInput.supplierId) {
			await this.supplierScope.assertLinkedToWork(
				ownerId,
				workId,
				effectiveInput.supplierId,
			);
		}
		const normalized = normalizeCostAllocations(
			new Decimal(effectiveInput.amount),
			effectiveInput.allocations,
		);
		const created = await withSerializableRetry(async (tx) => {
			if (effectiveInput.sourceDocument) {
				await this.assertSourceDocumentUnique(
					ownerId,
					workId,
					effectiveInput.sourceDocument,
					tx,
				);
			}
			const created = await this.repository.createActualCost(
				ownerId,
				workId,
				null,
				effectiveInput,
				tx,
				normalized,
			);
			await this.applyGeneralCostImpact(
				ownerId,
				workId,
				created.id,
				effectiveInput,
				normalized,
				tx,
			);
			await this.emitGeneralCostEvents(
				ownerId,
				workId,
				created,
				tx,
				effectiveInput.allocations?.[0]?.budgetItemId ?? null,
			);
			return created;
		});

		if (ctx) {
			const { submitApproval } = await import(
				"../../governance/approval.service"
			);
			await submitApproval({
				actorId: ctx.userId,
				resourceType: "ACTUAL_COST",
				resourceId: created.id,
				effectAction: "COST_APPROVE",
				payload: {
					workId,
					actualCostId: created.id,
					description: created.description ?? null,
				},
				expectedVersion: 1,
				idempotencyKey: `actual-cost-create-${created.id}`,
			});
		}

		return created;
	}

	private async applyGeneralCostImpact(
		ownerId: string,
		workId: string,
		sourceId: string,
		input: {
			amount: number;
			costDate: string;
			allocations: CreateActualCostInput["allocations"];
		},
		normalized: ReturnType<typeof normalizeCostAllocations>,
		tx: Prisma.TransactionClient,
	) {
		const occurredAt = new Date(input.costDate);
		await this.budgetControl.apply(
			ownerId,
			workId,
			{
				workId,
				allocations: normalized.map((row) => ({
					budgetItemId: row.budgetItemId,
					amount: Number(row.value),
				})),
				impactType: "CONSUMPTION",
				sourceType: GENERAL_COST_SOURCE_TYPE,
				sourceId,
				competence: competenceOf(occurredAt),
				occurredAt,
			},
			{ userId: ownerId },
			tx,
		);
	}

	private async assertSourceDocumentUnique(
		ownerId: string,
		workId: string,
		sourceDocument: string,
		tx: Prisma.TransactionClient,
	) {
		const [dupCost, dupPayment] = await Promise.all([
			tx.constructionActualCost.findFirst({
				where: { ownerId, workId, sourceDocument },
				select: { id: true },
			}),
			tx.contractPayment.findFirst({
				where: {
					description: sourceDocument,
					contract: { ownerId, workId },
				},
				select: { id: true },
			}),
		]);
		if (dupCost || dupPayment) {
			throw new ConstructionError(
				"DUPLICATE_CONTRACT_ORIGIN",
				"Ja existe custo manual ou pagamento de contrato com este documento de origem",
				422,
			);
		}
	}

	private async emitGeneralCostEvents(
		ownerId: string,
		workId: string,
		created: {
			id: string;
			costDate: Date | null;
			amount: Prisma.Decimal;
			paymentStatus: string;
		},
		tx: Prisma.TransactionClient,
		firstAllocationBudgetItemId: string | null,
	) {
		const occurredAt = created.costDate ?? new Date();
		const ref = firstAllocationBudgetItemId
			? await resolveLedgerItemRef(ownerId, workId, firstAllocationBudgetItemId)
			: null;
		if (!ref) return;
		const base = {
			scope: await resolveResourceScope(ownerId, { workId }),
			workId,
			budgetItemIdentityId: ref.identityId,
			budgetVersionItemId: ref.versionItemId,
			sourceType: GENERAL_COST_SOURCE_TYPE,
			sourceId: created.id,
			competence: competenceOf(occurredAt),
			occurredAt,
			approvalDecisionId: null,
		};
		for (const event of buildGeneralCostEvents(
			base,
			new Decimal(created.amount),
			created.paymentStatus === "PAID",
		)) {
			if (event.eventType === "INCURRED_CREATE") continue;
			await appendLedgerEvent(event, tx);
		}
	}

	async importActualCosts(
		ownerId: string,
		workId: string,
		rows: ImportActualCostRow[],
	) {
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		return this.repository.importActualCosts(ownerId, workId, rows);
	}

	listActualCosts(
		ownerId: string,
		workId: string,
		filters: Partial<import("../schema").ActualCostFilter> = {},
	) {
		return this.repository.listActualCosts(ownerId, workId, filters);
	}

	async getActualCost(ownerId: string, workId: string, costId: string) {
		const result = await this.repository.getActualCostById(
			ownerId,
			workId,
			costId,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
		}
		return result;
	}

	async updateActualCost(
		ownerId: string,
		workId: string,
		costId: string,
		input: UpdateActualCostInput,
	) {
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		await this.governance.assertWritable(ownerId, "COST_STATUS", costId);
		if (input.supplierId) {
			await this.supplierScope.assertLinkedToWork(
				ownerId,
				workId,
				input.supplierId,
			);
		}
		if (input.allocations !== undefined && input.allocations.length === 0) {
			throw new ConstructionError(
				"BUDGET_ITEM_REQUIRED",
				"Informe ao menos uma alocação de item de orçamento",
				422,
			);
		}
		const financialChange =
			input.amount !== undefined ||
			input.allocations !== undefined ||
			input.budgetIndex !== undefined;
		return withSerializableRetry(async (tx) => {
			const existing = await this.repository.getActualCostById(
				ownerId,
				workId,
				costId,
				tx,
			);
			if (!existing) {
				throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
			}
			assertFutureCostPaymentStatus(
				input.costType ?? existing.costType,
				input.paymentStatus ?? existing.paymentStatus,
			);
			assertOtherCategoryDetail(
				input.category ?? existing.category,
				input.categoryDetail ?? existing.categoryDetail ?? undefined,
			);
			const finalAmount = new Decimal(input.amount ?? Number(existing.amount));
			const normalized = this.normalizeUpdateAllocations(
				finalAmount,
				input,
				existing,
			);
			if (financialChange) {
				await this.revokeGeneralCostImpacts(ownerId, workId, costId, tx);
			}
			const updated = await this.repository.updateActualCost(
				ownerId,
				workId,
				costId,
				input,
				tx,
				normalized,
			);
			if (!updated) {
				throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
			}
			if (financialChange) {
				await this.replanGeneralCost(
					ownerId,
					workId,
					costId,
					updated,
					normalized,
					tx,
				);
			}
			return updated;
		});
	}

	private normalizeUpdateAllocations(
		finalAmount: Decimal,
		input: UpdateActualCostInput,
		existing: Awaited<
			ReturnType<typeof constructionRepositoryModule.getActualCostById>
		>,
	): ReturnType<typeof normalizeCostAllocations> | undefined {
		if (input.allocations !== undefined && input.allocations.length > 0) {
			return normalizeCostAllocations(finalAmount, input.allocations);
		}
		if (
			input.amount !== undefined &&
			(existing?.allocations ?? []).length > 0
		) {
			const oldAmount = Number(existing?.amount ?? 1);
			const scaled = existing?.allocations?.map((allocation) =>
				allocation.percentage !== null
					? {
							budgetItemId: allocation.budgetItemId,
							percentage: Number(allocation.percentage),
						}
					: {
							budgetItemId: allocation.budgetItemId,
							percentage: Math.round(
								((Number(allocation.value ?? 0) /
									(oldAmount > 0 ? oldAmount : 1)) *
									100 *
									100) /
									100,
							),
						},
			);
			if (scaled && scaled.length > 0) {
				return normalizeCostAllocations(finalAmount, scaled);
			}
		}
		return undefined;
	}

	private async revokeGeneralCostImpacts(
		ownerId: string,
		workId: string,
		costId: string,
		tx: Prisma.TransactionClient,
	) {
		const impacts = await findActiveImpactsBySource(
			tx,
			ownerId,
			workId,
			GENERAL_COST_SOURCE_TYPE,
			costId,
		);
		for (const impact of impacts) {
			if (impact.status === "APPROVED") {
				await this.budgetControl.reverse(
					ownerId,
					impact.id,
					{ userId: ownerId },
					tx,
				);
			} else {
				await this.budgetControl.reject(
					ownerId,
					impact.id,
					{ userId: ownerId },
					tx,
				);
			}
		}
	}

	private async replanGeneralCost(
		ownerId: string,
		workId: string,
		costId: string,
		updated: Awaited<
			ReturnType<typeof constructionRepositoryModule.updateActualCost>
		>,
		normalized: ReturnType<typeof normalizeCostAllocations> | undefined,
		tx: Prisma.TransactionClient,
	) {
		if (!updated || !normalized) return;
		const occurredAt = new Date(updated.costDate ?? new Date());
		await this.budgetControl.apply(
			ownerId,
			workId,
			{
				workId,
				allocations: normalized.map((row) => ({
					budgetItemId: row.budgetItemId,
					amount: Number(row.value),
				})),
				impactType: "CONSUMPTION",
				sourceType: GENERAL_COST_SOURCE_TYPE,
				sourceId: costId,
				competence: competenceOf(occurredAt),
				occurredAt,
			},
			{ userId: ownerId },
			tx,
		);
	}

	async deleteActualCost(ownerId: string, workId: string, costId: string) {
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		await this.governance.assertWritable(ownerId, "COST_STATUS", costId);
		return withSerializableRetry(async (tx) => {
			const existing = await this.repository.getActualCostById(
				ownerId,
				workId,
				costId,
				tx,
			);
			if (!existing) {
				throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
			}
			await this.revokeGeneralCostImpacts(ownerId, workId, costId, tx);
			const result = await this.repository.deleteActualCost(
				ownerId,
				workId,
				costId,
				tx,
			);
			return result;
		});
	}
}

export const constructionManualEntryService =
	new ConstructionManualEntryService();
