import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { withSerializableRetry } from "../../../lib/transaction-retry";
import { normalizeCostAllocations } from "../budget-control/budget-control.calculator";
import { budgetControlService } from "../budget-control/budget-control.service";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "../governance-guard";
import type * as constructionRepository from "../repository";
import * as constructionRepositoryModule from "../repository";
import type {
	CreateActualCostInput,
	CreateCostInput,
	CreateMeasurementInput,
	ImportActualCostRow,
	UpdateActualCostInput,
	UpdateCostInput,
} from "../schema";
import { normalizeWorkOperationalStatus } from "../works/work-operational-status";
import {
	applyGeneralCostImpact,
	assertSourceDocumentUnique,
	emitGeneralCostEvents,
	revokeGeneralCostImpacts,
} from "./cost-effects";

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
	| "createCost"
	| "importActualCosts"
	| "listActualCosts"
	| "listCosts"
	| "getActualCostById"
	| "getCostById"
	| "updateCostTitle"
	| "updateActualCost"
	| "deleteActualCost"
	| "deleteCost"
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

	private async normalizeCostItems(
		ownerId: string,
		workId: string,
		items: CreateCostInput["items"],
	) {
		return Promise.all(
			items.map(async (item) => {
				assertFutureCostPaymentStatus(item.costType, item.paymentStatus);
				assertOtherCategoryDetail(item.category, item.categoryDetail);
				if (!item.description?.trim()) {
					throw new ConstructionError(
						"INVALID_INPUT",
						"Descricao do item de custo obrigatoria",
						422,
					);
				}
				const effective = await this.normalizeCostItem(ownerId, workId, item);
				if (effective.supplierId) {
					await this.supplierScope.assertLinkedToWork(
						ownerId,
						workId,
						effective.supplierId,
					);
				}
				return {
					input: effective,
					normalized: normalizeCostAllocations(
						new Decimal(effective.amount),
						effective.allocations,
					),
				};
			}),
		);
	}

	private async persistCostItems(
		ownerId: string,
		workId: string,
		importId: string | null,
		costId: string,
		normalizedItems: Awaited<ReturnType<typeof this.normalizeCostItems>>,
		tx: Prisma.TransactionClient,
	) {
		for (const item of normalizedItems) {
			if (item.input.sourceDocument) {
				await assertSourceDocumentUnique(
					ownerId,
					workId,
					item.input.sourceDocument,
					tx,
				);
			}
			const createdItem = await this.repository.createActualCost(
				ownerId,
				workId,
				importId,
				item.input,
				tx,
				item.normalized,
				costId,
			);
			await applyGeneralCostImpact(
				this.budgetControl,
				ownerId,
				workId,
				createdItem.id,
				item.input,
				item.normalized,
				tx,
			);
			await emitGeneralCostEvents(
				ownerId,
				workId,
				createdItem,
				tx,
				createdItem.id,
				item.normalized,
			);
		}
	}

	async createMeasurement(
		ownerId: string,
		workId: string,
		input: CreateMeasurementInput,
	) {
		const work = await this.getWorkOrThrow(ownerId, workId);
		const workStatus = normalizeWorkOperationalStatus(work.operationalStatus);
		if (
			workStatus === "SUSPENDED" ||
			workStatus === "DONE" ||
			workStatus === "IGNORED"
		) {
			throw new ConstructionError(
				"WORK_NOT_ACCEPTING_ENTRIES",
				"A obra suspensa, concluida ou arquivada nao aceita novos custos",
				422,
			);
		}
		await this.assertWritable(ownerId, workId, "WORK_MEASUREMENTS");
		return this.repository.createMeasurement(ownerId, workId, null, input);
	}

	async importMeasurements(
		ownerId: string,
		workId: string,
		rows: CreateMeasurementInput[],
	) {
		const work = await this.getWorkOrThrow(ownerId, workId);
		const workStatus = normalizeWorkOperationalStatus(work.operationalStatus);
		if (
			workStatus === "SUSPENDED" ||
			workStatus === "DONE" ||
			workStatus === "IGNORED"
		) {
			throw new ConstructionError(
				"WORK_NOT_ACCEPTING_ENTRIES",
				"A obra suspensa, concluida ou arquivada nao aceita novas medicoes",
				422,
			);
		}
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
				await assertSourceDocumentUnique(
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
			await applyGeneralCostImpact(
				this.budgetControl,
				ownerId,
				workId,
				created.id,
				effectiveInput,
				normalized,
				tx,
			);
			await emitGeneralCostEvents(
				ownerId,
				workId,
				created,
				tx,
				created.id,
				normalized,
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

	async importActualCosts(
		ownerId: string,
		workId: string,
		rows: ImportActualCostRow[],
		title?: string,
	) {
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		return this.repository.importActualCosts(ownerId, workId, rows, title);
	}

	async createCost(
		ownerId: string,
		workId: string,
		input: CreateCostInput,
		ctx?: { userId: string },
	) {
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		const normalizedItems = await this.normalizeCostItems(
			ownerId,
			workId,
			input.items,
		);

		const created = await withSerializableRetry(async (tx) => {
			const cost = await this.repository.createCost(
				ownerId,
				workId,
				input.title,
				null,
				tx,
			);
			await this.persistCostItems(
				ownerId,
				workId,
				null,
				cost.id,
				normalizedItems,
				tx,
			);
			return this.repository.getCostById(ownerId, workId, cost.id, tx);
		});
		if (!created) {
			throw new ConstructionError("INTERNAL_ERROR", "Custo nao criado", 500);
		}

		if (ctx) {
			const { submitApproval } = await import(
				"../../governance/approval.service"
			);
			for (const item of created.items) {
				await submitApproval({
					actorId: ctx.userId,
					resourceType: "ACTUAL_COST",
					resourceId: item.id,
					effectAction: "COST_APPROVE",
					payload: {
						workId,
						actualCostId: item.id,
						description: item.description ?? null,
					},
					expectedVersion: 1,
					idempotencyKey: `actual-cost-create-${item.id}`,
				});
			}
		}
		return created;
	}

	async updateCost(
		ownerId: string,
		workId: string,
		costId: string,
		input: UpdateCostInput,
		ctx?: { userId: string },
	) {
		await this.getWorkOrThrow(ownerId, workId);
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		const current = await this.getCost(ownerId, workId, costId);
		for (const item of current.items) {
			await this.governance.assertWritable(ownerId, "COST_STATUS", item.id);
		}
		const normalizedItems = await this.normalizeCostItems(
			ownerId,
			workId,
			input.items,
		);
		const previousItemsByVersionId = new Map(
			current.items
				.filter((item) => item.budgetVersionItem?.id)
				.map((item) => [item.budgetVersionItem?.id, item]),
		);
		for (const item of normalizedItems) {
			const previous = previousItemsByVersionId.get(
				item.input.budgetVersionItemId,
			);
			if (!previous) continue;
			item.input.sourceDocument ??= previous.sourceDocument ?? undefined;
			item.input.costGroup ??= previous.costGroup ?? undefined;
			if (item.input.supplierId === previous.supplierId) {
				item.input.supplierName ??= previous.supplierName ?? undefined;
			}
		}

		const updated = await withSerializableRetry(async (tx) => {
			for (const item of current.items) {
				await revokeGeneralCostImpacts(
					this.budgetControl,
					ownerId,
					workId,
					item.id,
					tx,
				);
				await this.repository.deleteActualCost(ownerId, workId, item.id, tx);
			}
			const cost = await this.repository.updateCostTitle(
				ownerId,
				workId,
				costId,
				input.title,
				tx,
			);
			if (!cost) {
				throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
			}
			await this.persistCostItems(
				ownerId,
				workId,
				current.importId,
				costId,
				normalizedItems,
				tx,
			);
			return this.repository.getCostById(ownerId, workId, costId, tx);
		});
		if (!updated) {
			throw new ConstructionError(
				"INTERNAL_ERROR",
				"Custo nao atualizado",
				500,
			);
		}

		if (ctx) {
			const { submitApproval } = await import(
				"../../governance/approval.service"
			);
			for (const item of updated.items) {
				await submitApproval({
					actorId: ctx.userId,
					resourceType: "ACTUAL_COST",
					resourceId: item.id,
					effectAction: "COST_APPROVE",
					payload: {
						workId,
						actualCostId: item.id,
						description: item.description ?? null,
					},
					expectedVersion: 1,
					idempotencyKey: `actual-cost-revision-${item.id}`,
				});
			}
		}
		return updated;
	}

	listCosts(
		ownerId: string,
		workId: string,
		filters: Partial<import("../schema").ActualCostFilter> = {},
	) {
		return this.repository.listCosts(ownerId, workId, filters);
	}

	async getCost(ownerId: string, workId: string, costId: string) {
		const result = await this.repository.getCostById(ownerId, workId, costId);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
		}
		return result;
	}

	async deleteCost(ownerId: string, workId: string, costId: string) {
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		const cost = await this.getCost(ownerId, workId, costId);
		for (const item of cost.items) {
			await this.governance.assertWritable(ownerId, "COST_STATUS", item.id);
		}
		return withSerializableRetry(async (tx) => {
			for (const item of cost.items) {
				await revokeGeneralCostImpacts(
					this.budgetControl,
					ownerId,
					workId,
					item.id,
					tx,
				);
			}
			const deleted = await this.repository.deleteCost(
				ownerId,
				workId,
				costId,
				tx,
			);
			if (!deleted) {
				throw new ConstructionError("NOT_FOUND", "Custo nao encontrado", 404);
			}
			return cost;
		});
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
		ctx?: { userId: string },
	) {
		await this.assertWritable(ownerId, workId, "WORK_COSTS");
		await this.governance.assertWritable(ownerId, "COST_STATUS", costId);
		const rejectedApproval = ctx
			? await prisma.approvalRequest.findFirst({
					where: {
						ownerId,
						resourceType: "ACTUAL_COST",
						resourceId: costId,
						effectAction: "COST_APPROVE",
						status: "REJECTED",
					},
					orderBy: { createdAt: "desc" },
					select: { id: true },
				})
			: null;
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
			input.budgetIndex !== undefined ||
			input.budgetVersionItemId !== undefined ||
			input.costDate !== undefined ||
			input.costType !== undefined ||
			input.paymentStatus !== undefined;
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
			if (
				input.budgetVersionItemId !== undefined &&
				input.budgetVersionItemId !== existing.budgetVersionItemId &&
				input.allocations === undefined
			) {
				throw new ConstructionError(
					"BUDGET_ITEM_REQUIRED",
					"Ao alterar o item do orçamento, informe a nova alocação",
					422,
				);
			}
			if (
				input.sourceDocument !== undefined &&
				input.sourceDocument !== existing.sourceDocument
			) {
				await assertSourceDocumentUnique(
					ownerId,
					workId,
					input.sourceDocument,
					tx,
					costId,
				);
			}
			const finalAmount = new Decimal(input.amount ?? Number(existing.amount));
			const normalized = this.normalizeUpdateAllocations(
				finalAmount,
				input,
				existing,
			);
			if (financialChange) {
				await revokeGeneralCostImpacts(
					this.budgetControl,
					ownerId,
					workId,
					costId,
					tx,
				);
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
			if (financialChange && normalized) {
				const effectSourceId = `${costId}#${crypto.randomUUID()}`;
				await applyGeneralCostImpact(
					this.budgetControl,
					ownerId,
					workId,
					effectSourceId,
					{
						amount: updated.amount,
						costDate: updated.costDate,
					},
					normalized,
					tx,
				);
				await emitGeneralCostEvents(
					ownerId,
					workId,
					updated,
					tx,
					effectSourceId,
					normalized,
				);
			}
			if (rejectedApproval && ctx) {
				const { submitApproval } = await import(
					"../../governance/approval.service"
				);
				await submitApproval({
					actorId: ctx.userId,
					resourceType: "ACTUAL_COST",
					resourceId: costId,
					effectAction: "COST_APPROVE",
					payload: {
						workId,
						actualCostId: costId,
						description: updated.description ?? null,
					},
					expectedVersion: 1,
					idempotencyKey: [
						"actual-cost-revision",
						costId,
						crypto.randomUUID(),
					].join("-"),
				});
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
		if ((existing?.allocations ?? []).length > 0) {
			const oldAmount = Number(existing?.amount ?? 1);
			const scaled = existing?.allocations?.map((allocation) =>
				allocation.percentage !== null
					? {
							budgetItemId: allocation.budgetItemId,
							percentage: Number(allocation.percentage),
						}
					: {
							budgetItemId: allocation.budgetItemId,
							percentage:
								Math.round(
									(Number(allocation.value ?? 0) /
										(oldAmount !== 0 ? oldAmount : 1)) *
										100 *
										100,
								) / 100,
						},
			);
			if (scaled && scaled.length > 0) {
				return normalizeCostAllocations(finalAmount, scaled);
			}
		}
		return undefined;
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
			await revokeGeneralCostImpacts(
				this.budgetControl,
				ownerId,
				workId,
				costId,
				tx,
			);
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
