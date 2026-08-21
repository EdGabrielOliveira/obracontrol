import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { withSerializableRetry } from "../../lib/transaction-retry";
import {
	findActiveImpactsBySource,
	getBudgetItemReferences,
} from "./budget-control/budget-control.repository";
import { budgetControlService } from "./budget-control/budget-control.service";
import * as coverageRepository from "./measurement-coverage.repository";

const WORK_MEASUREMENT_SOURCE_TYPE = "WORK_MEASUREMENT";
const STATUS_APPROVED = "APPROVED";
const STATUS_PENDING = "PENDING";

export type CoverageLinkInput = {
	workMeasurementItemId: string;
	contractMeasurementItemId: string;
	quantity: number;
};

type CoverageBatchInput = CoverageLinkInput;

export class MeasurementCoverageService {
	constructor(
		private readonly repository = coverageRepository,
		private readonly budgetControl = budgetControlService,
	) {}

	async link(
		ownerId: string,
		workId: string,
		input: CoverageLinkInput,
		ctx: { userId: string },
		tx?: Prisma.TransactionClient,
	) {
		if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
			throw new ConstructionError(
				"INVALID_COVERAGE_QUANTITY",
				"Quantidade coberta deve ser maior que zero",
				400,
			);
		}

		const execute = async (t: Prisma.TransactionClient) => {
			const workItem = await this.repository.getWorkMeasurementItem(
				ownerId,
				workId,
				input.workMeasurementItemId,
				t,
			);
			if (!workItem) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Item de medicao de obra nao encontrado",
					404,
				);
			}
			const contractItem = await this.repository.getContractMeasurementItem(
				ownerId,
				workId,
				input.contractMeasurementItemId,
				t,
			);
			if (!contractItem) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Item de medicao contratual nao encontrado",
					404,
				);
			}
			if (
				workItem.measurement.workId !== contractItem.measurement.contract.workId
			) {
				throw new ConstructionError(
					"COVERAGE_WRONG_WORK",
					"Itens de medicao pertencem a obras diferentes",
					422,
				);
			}

			const contractBudgetItemId =
				await this.repository.getContractServiceBudgetItem(
					t,
					contractItem.serviceId,
					contractItem.measurement.contractId,
				);
			if (!contractBudgetItemId) {
				throw new ConstructionError(
					"BUDGET_ITEM_REQUIRED",
					"Servico do contrato sem item de orcamento vinculado",
					422,
				);
			}
			if (contractBudgetItemId !== workItem.budgetItemId) {
				throw new ConstructionError(
					"COVERAGE_BUDGET_MISMATCH",
					"Medicoes cobertas referenciam itens de orcamento diferentes",
					422,
				);
			}

			const quantity = new Decimal(input.quantity);
			const workMeasured = new Decimal(workItem.measuredQuantity ?? 0);
			const contractMeasured = new Decimal(contractItem.measuredQuantity ?? 0);
			if (
				quantity.greaterThan(workMeasured) ||
				quantity.greaterThan(contractMeasured)
			) {
				throw new ConstructionError(
					"COVERAGE_EXCEEDS_MEASURED_QUANTITY",
					"Cobertura nao pode exceder a quantidade medida de nenhuma medicao",
					422,
				);
			}

			const [workSum, contractSum, existing] = await Promise.all([
				this.repository.sumCoveragesByWorkItem(t, workItem.id),
				this.repository.sumCoveragesByContractItem(t, contractItem.id),
				this.repository.findCoverageByPair(t, workItem.id, contractItem.id),
			]);
			if (existing) {
				throw new ConstructionError(
					"COVERAGE_ALREADY_EXISTS",
					"Par de medicoes ja coberto",
					409,
				);
			}
			if (workSum.plus(quantity).greaterThan(workMeasured)) {
				throw new ConstructionError(
					"COVERAGE_EXCEEDS_MEASURED_QUANTITY",
					"Cobertura acumulada excede a quantidade medida da medicao de obra",
					422,
				);
			}
			if (contractSum.plus(quantity).greaterThan(contractMeasured)) {
				throw new ConstructionError(
					"COVERAGE_EXCEEDS_MEASURED_QUANTITY",
					"Cobertura acumulada excede a quantidade medida da medicao contratual",
					422,
				);
			}

			const refs = await getBudgetItemReferences(
				ownerId,
				workId,
				[workItem.budgetItemId],
				t,
			);
			const ref = refs.found[0];
			if (!ref || ref.unitCost == null) {
				throw new ConstructionError(
					"BUDGET_VERSION_NOT_AVAILABLE",
					"Item de orcamento sem versao vigente",
					422,
				);
			}
			const amount = quantity.mul(ref.unitCost);

			const created = await this.repository.createCoverage(t, {
				ownerId,
				workMeasurementItemId: workItem.id,
				contractMeasurementItemId: contractItem.id,
				quantity,
				amount,
			});

			await this.reclassifyWorkMeasurement(
				ownerId,
				workId,
				workItem.measurementId,
				workItem.id,
				quantity,
				t,
				ctx,
				new Map([[workItem.id, workSum.plus(quantity)]]),
			);

			return created;
		};

		if (tx) return execute(tx);
		return withSerializableRetry(execute);
	}

	async linkBatch(
		ownerId: string,
		workId: string,
		inputs: CoverageBatchInput[],
		ctx: { userId: string },
		tx?: Prisma.TransactionClient,
	) {
		if (inputs.length === 0) return [];
		for (const input of inputs) {
			if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
				throw new ConstructionError(
					"INVALID_COVERAGE_QUANTITY",
					"Quantidade coberta deve ser maior que zero",
					400,
				);
			}
		}

		const execute = async (t: Prisma.TransactionClient) => {
			const workIds = [
				...new Set(inputs.map((input) => input.workMeasurementItemId)),
			];
			const contractIds = [
				...new Set(inputs.map((input) => input.contractMeasurementItemId)),
			];
			const [workItems, contractItems] = await Promise.all([
				this.repository.getWorkMeasurementItemsByIds(
					ownerId,
					workId,
					workIds,
					t,
				),
				this.repository.getContractMeasurementItemsByIds(
					ownerId,
					workId,
					contractIds,
					t,
				),
			]);
			const workById = new Map(workItems.map((item) => [item.id, item]));
			const contractById = new Map(
				contractItems.map((item) => [item.id, item]),
			);
			if (workItems.length !== workIds.length) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Item de medicao de obra nao encontrado",
					404,
				);
			}
			if (contractItems.length !== contractIds.length) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Item de medicao contratual nao encontrado",
					404,
				);
			}

			const contractServiceIds = [
				...new Set(contractItems.map((item) => item.serviceId)),
			];
			const budgetByService =
				await this.repository.getContractServiceBudgetItems(
					t,
					contractItems[0].measurement.contractId,
					contractServiceIds,
				);
			const pairKeys = new Set<string>();
			for (const input of inputs) {
				const workItem = workById.get(input.workMeasurementItemId);
				const contractItem = contractById.get(input.contractMeasurementItemId);
				if (!workItem || !contractItem) continue;
				if (
					workItem.measurement.workId !==
					contractItem.measurement.contract.workId
				) {
					throw new ConstructionError(
						"COVERAGE_WRONG_WORK",
						"Itens de medicao pertencem a obras diferentes",
						422,
					);
				}
				const key = `${workItem.id}:${contractItem.id}`;
				if (pairKeys.has(key)) {
					throw new ConstructionError(
						"COVERAGE_ALREADY_EXISTS",
						"Par de medicoes ja coberto",
						409,
					);
				}
				pairKeys.add(key);
				const budgetItemId =
					budgetByService.get(contractItem.serviceId) ?? null;
				if (!budgetItemId) {
					throw new ConstructionError(
						"BUDGET_ITEM_REQUIRED",
						"Servico do contrato sem item de orcamento vinculado",
						422,
					);
				}
				if (budgetItemId !== workItem.budgetItemId) {
					throw new ConstructionError(
						"COVERAGE_BUDGET_MISMATCH",
						"Medicoes cobertas referenciam itens de orcamento diferentes",
						422,
					);
				}
			}

			const pairs = inputs.map((input) => ({
				workMeasurementItemId: input.workMeasurementItemId,
				contractMeasurementItemId: input.contractMeasurementItemId,
			}));
			const [existing, workTotals, contractTotals] = await Promise.all([
				this.repository.findCoveragesByPairs(t, pairs),
				this.repository.sumCoveragesByWorkItems(t, workIds),
				this.repository.sumCoveragesByContractItems(t, contractIds),
			]);
			if (existing.length > 0) {
				throw new ConstructionError(
					"COVERAGE_ALREADY_EXISTS",
					"Par de medicoes ja coberto",
					409,
				);
			}

			const budgetIds = [
				...new Set(
					inputs.map(
						(input) => workById.get(input.workMeasurementItemId)?.budgetItemId,
					),
				),
			].filter((id): id is string => Boolean(id));
			const refs = await getBudgetItemReferences(ownerId, workId, budgetIds, t);
			const refByBudgetId = new Map(
				refs.found.map((ref) => [ref.budgetItemId, ref]),
			);
			const workAdds = new Map<string, Decimal>();
			const contractAdds = new Map<string, Decimal>();
			const data = inputs.map((input) => {
				const workItem = workById.get(input.workMeasurementItemId);
				const contractItem = contractById.get(input.contractMeasurementItemId);
				if (!workItem || !contractItem)
					throw new Error("coverage item map incomplete");
				const quantity = new Decimal(input.quantity);
				const workMeasured = new Decimal(workItem.measuredQuantity ?? 0);
				const contractMeasured = new Decimal(
					contractItem.measuredQuantity ?? 0,
				);
				const nextWork = (workTotals.get(workItem.id) ?? new Decimal(0))
					.plus(workAdds.get(workItem.id) ?? 0)
					.plus(quantity);
				const nextContract = (
					contractTotals.get(contractItem.id) ?? new Decimal(0)
				)
					.plus(contractAdds.get(contractItem.id) ?? 0)
					.plus(quantity);
				if (
					nextWork.greaterThan(workMeasured) ||
					nextContract.greaterThan(contractMeasured)
				) {
					throw new ConstructionError(
						"COVERAGE_EXCEEDS_MEASURED_QUANTITY",
						"Cobertura acumulada excede a quantidade medida",
						422,
					);
				}
				const ref = refByBudgetId.get(workItem.budgetItemId);
				if (!ref || ref.unitCost == null) {
					throw new ConstructionError(
						"BUDGET_VERSION_NOT_AVAILABLE",
						"Item de orcamento sem versao vigente",
						422,
					);
				}
				workAdds.set(
					workItem.id,
					(workAdds.get(workItem.id) ?? new Decimal(0)).plus(quantity),
				);
				contractAdds.set(
					contractItem.id,
					(contractAdds.get(contractItem.id) ?? new Decimal(0)).plus(quantity),
				);
				return {
					ownerId,
					workMeasurementItemId: workItem.id,
					contractMeasurementItemId: contractItem.id,
					quantity,
					amount: quantity.mul(ref.unitCost),
				};
			});

			const created = await this.repository.createCoverages(t, data);
			const measurementIds = [
				...new Set(workItems.map((item) => item.measurementId)),
			];
			for (const measurementId of measurementIds) {
				await this.reclassifyWorkMeasurement(
					ownerId,
					workId,
					measurementId,
					undefined,
					new Decimal(0),
					t,
					ctx,
				);
			}
			return created;
		};

		if (tx) return execute(tx);
		return withSerializableRetry(execute);
	}

	async unlink(
		ownerId: string,
		workId: string,
		coverageId: string,
		ctx: { userId: string },
		tx?: Prisma.TransactionClient,
	) {
		const execute = async (t: Prisma.TransactionClient) => {
			const coverage = await this.repository.getCoverage(
				ownerId,
				coverageId,
				t,
			);
			if (!coverage) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Cobertura nao encontrada",
					404,
				);
			}
			const workItem = await this.repository.getWorkMeasurementItem(
				ownerId,
				workId,
				coverage.workMeasurementItemId,
				t,
			);
			if (!workItem) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Item de medicao de obra nao encontrado",
					404,
				);
			}

			await this.repository.deleteCoverage(t, coverage.id);

			const items = await this.repository.getWorkMeasurementItems(
				ownerId,
				workItem.measurementId,
				t,
			);
			await this.restoreWorkMeasurement(
				ownerId,
				workId,
				workItem.measurementId,
				items,
				t,
				ctx,
			);
			return coverage;
		};

		if (tx) return execute(tx);
		return withSerializableRetry(execute);
	}

	async hasCoveragesForWorkMeasurement(ownerId: string, measurementId: string) {
		const count = await this.repository.countCoveragesByWorkMeasurement(
			ownerId,
			measurementId,
		);
		return count > 0;
	}

	async list(ownerId: string, workId: string) {
		return this.repository.listCoverages(ownerId, workId);
	}

	async reconcileContractMeasurement(
		ownerId: string,
		contractMeasurementId: string,
	) {
		const items =
			await this.repository.findContractMeasurementItemsWithCoverageSums(
				ownerId,
				contractMeasurementId,
			);
		for (const item of items) {
			const measured = new Decimal(item.measuredQuantity ?? 0);
			if (item.coveredQuantity.greaterThan(measured)) {
				throw new ConstructionError(
					"COVERAGE_EXCEEDS_MEASURED_QUANTITY",
					"Cobertura acumulada excede a quantidade medida da medicao contratual",
					422,
				);
			}
		}
	}

	private async reclassifyWorkMeasurement(
		ownerId: string,
		workId: string,
		measurementId: string,
		coveredItemId: string | undefined,
		coveredQuantity: Decimal,
		t: Prisma.TransactionClient,
		ctx: { userId: string },
		coveredTotals: Map<string, Decimal> = new Map(),
	) {
		const items = await this.repository.getWorkMeasurementItems(
			ownerId,
			measurementId,
			t,
		);
		const coveredByItem = new Map(
			await Promise.all(
				items.map(
					async (item) =>
						[
							item.id,
							coveredTotals.has(item.id)
								? (coveredTotals.get(item.id) ?? new Decimal(0))
								: await this.repository.sumCoveragesByWorkItem(t, item.id),
						] as const,
				),
			),
		);
		const allocations: Array<{ budgetItemId: string; quantity: number }> = [];
		for (const item of items) {
			const measured = new Decimal(item.measuredQuantity ?? 0);
			const covered =
				coveredByItem.get(item.id) ??
				(item.id === coveredItemId ? coveredQuantity : new Decimal(0));
			const remaining = measured.minus(covered);
			if (remaining.greaterThan(0)) {
				allocations.push({
					budgetItemId: item.budgetItemId,
					quantity: remaining.toNumber(),
				});
			}
		}

		if (allocations.length === 0) {
			const active = await findActiveImpactsBySource(
				t,
				ownerId,
				workId,
				WORK_MEASUREMENT_SOURCE_TYPE,
				measurementId,
			);
			for (const impact of active.filter(
				(candidate) => candidate.impactType === "CONSUMPTION",
			)) {
				if (impact.status === STATUS_APPROVED) {
					await this.budgetControl.reverse(ownerId, impact.id, ctx, t);
				} else if (impact.status === STATUS_PENDING) {
					await this.budgetControl.reject(ownerId, impact.id, ctx, t);
				}
			}
			return;
		}

		await this.budgetControl.replaceSourceImpact(
			ownerId,
			workId,
			{
				workId,
				allocations,
				impactType: "CONSUMPTION",
				sourceType: WORK_MEASUREMENT_SOURCE_TYPE,
				sourceId: measurementId,
				allowPending: true,
			},
			ctx,
			t,
		);
	}

	private async restoreWorkMeasurement(
		ownerId: string,
		workId: string,
		measurementId: string,
		items: coverageRepository.WorkMeasurementItemForReclassify[],
		t: Prisma.TransactionClient,
		ctx: { userId: string },
	) {
		const allocations = items
			.filter((item) => (item.measuredQuantity ?? null) !== null)
			.map((item) => ({
				budgetItemId: item.budgetItemId,
				quantity: new Decimal(item.measuredQuantity ?? 0).toNumber(),
			}));
		if (allocations.length === 0) return;
		await this.budgetControl.replaceSourceImpact(
			ownerId,
			workId,
			{
				workId,
				allocations,
				impactType: "CONSUMPTION",
				sourceType: WORK_MEASUREMENT_SOURCE_TYPE,
				sourceId: measurementId,
				allowPending: true,
			},
			ctx,
			t,
		);
	}
}

export const measurementCoverageService = new MeasurementCoverageService();
