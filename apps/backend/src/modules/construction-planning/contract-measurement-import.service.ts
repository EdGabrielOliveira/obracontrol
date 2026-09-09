import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import type { ValidationResult } from "./imports/normalized-types";
import { nextMeasurementNumber } from "./measurement-common";
import type { ImportValidationError } from "./types";

export type ContractMeasurementImportResult = {
	imported: number;
	paymentsImported: number;
	contractsImported: number;
	warnings: ImportValidationError[];
};

export async function importContractMeasurementWorkbook(
	ownerId: string,
	workId: string,
	contractId: string,
	validation: ValidationResult,
): Promise<ContractMeasurementImportResult> {
	const warnings: ImportValidationError[] = [...validation.warnings];

	return prisma.$transaction(async (tx) => {
		let contractsImported = 0;
		const existingContractCodes = await tx.contract.findMany({
			where: {
				ownerId,
				workId,
				code: { in: validation.contracts.map((contract) => contract.code) },
			},
			select: { code: true },
		});
		if (existingContractCodes.length > 0) {
			throw new ConstructionError(
				"CONFLICT",
				"Ja existe um contrato com este codigo nesta obra.",
				409,
			);
		}
		for (const contract of validation.contracts) {
			await tx.contract.create({
				data: {
					ownerId,
					workId,
					code: contract.code,
					supplierName: contract.supplierName,
					contractValue: contract.contractValue,
					serviceType: contract.serviceType ?? null,
					title: contract.title ?? null,
					startDate: contract.startDate,
					endDate: contract.endDate,
					status: contract.status,
					notes: contract.notes ?? null,
				},
			});
			contractsImported += 1;
		}

		const serviceIds: string[] = [];
		const contract = await tx.contract.findFirst({
			where: { id: contractId, ownerId, workId },
			select: { workId: true },
		});
		if (!contract) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		for (const service of validation.contractServices) {
			const budgetItem = await tx.constructionBudgetItem.findFirst({
				where: { ownerId, workId: contract.workId, index: service.index },
				select: { id: true, type: true, description: true, unit: true },
			});
			if (!budgetItem) {
				throw new ConstructionError(
					"INVALID_BUDGET_ITEM",
					`Item de orcamento ${service.index} nao encontrado para o servico da linha ${service.rowNumber}`,
					422,
				);
			}
			const created = await tx.contractService.create({
				data: {
					contractId,
					type: budgetItem.type,
					description: budgetItem.description,
					unit: budgetItem.unit,
					quantity: service.quantity,
					unitCost: service.unitCost,
					totalCost:
						service.totalCost ??
						(service.quantity != null && service.unitCost != null
							? service.quantity * service.unitCost
							: null),
					budgetItemId: budgetItem.id,
					sortOrder: 0,
				},
			});
			serviceIds.push(created.id);
		}

		let imported = 0;
		for (const measurement of validation.contractMeasurements) {
			if (serviceIds.length === 0) {
				warnings.push({
					sheet: "Medicoes Contrato",
					row: measurement.rowNumber,
					field: "Servicos",
					code: "SKIPPED_NO_SERVICES",
					message: "Medicao sem servicos ignorada",
				});
				continue;
			}
			const number = await nextMeasurementNumber(tx, "contractMeasurement", {
				ownerId,
				contractId,
			});
			const created = await tx.contractMeasurement.create({
				data: {
					ownerId,
					contractId,
					number,
					date: measurement.date,
					title: measurement.title ?? null,
					discountValue: measurement.discountValue,
					retentionValue: measurement.retentionValue,
					taxValue: measurement.taxValue,
					notes: measurement.notes ?? null,
					status: "ACEITO",
					statusReason: "Importado e validado",
					statusChangedAt: new Date(),
				},
			});
			await tx.contractMeasurementItem.createMany({
				data: serviceIds.map((serviceId) => ({
					measurementId: created.id,
					serviceId,
					measuredQuantity: null,
					measuredValue: null,
					measuredPercentage: null,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				})),
			});
			imported += 1;
		}

		let paymentsImported = 0;
		for (const payment of validation.contractPayments) {
			await tx.contractPayment.create({
				data: {
					ownerId,
					contractId,
					date: payment.date,
					value: payment.value,
					paidValue: payment.paidValue,
					description: payment.description ?? null,
					retentionValue: payment.retentionValue ?? null,
					discountValue: payment.discountValue ?? null,
					status: payment.status,
				},
			});
			paymentsImported += 1;
		}

		return { imported, paymentsImported, contractsImported, warnings };
	});
}
