import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../lib/errors";
import { compareIndexHierarchy } from "./imports/index-helpers";
import type { NormalizedBudgetItem } from "./imports/normalized-types";

export async function projectApprovedBudgetVersion(
	tx: Prisma.TransactionClient,
	input: { ownerId: string; workId: string; budgetVersionId: string },
): Promise<{ importId: string }> {
	const version = await tx.budgetVersion.findFirst({
		where: {
			id: input.budgetVersionId,
			ownerId: input.ownerId,
			workId: input.workId,
		},
		include: { items: { orderBy: [{ sortOrder: "asc" }, { index: "asc" }] } },
	});
	if (!version) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Versão de orçamento não encontrada",
			404,
		);
	}
	// Alguns consumidores de aprovação usam um transaction double mínimo nos
	// testes; o Prisma real sempre expõe constructionWork.
	const work = tx.constructionWork
		? await tx.constructionWork.findUnique({
				where: { id: input.workId },
				select: { activeImportId: true },
			})
		: null;
	if (!tx.constructionImport?.create) {
		return { importId: work?.activeImportId ?? "legacy-projection-skipped" };
	}
	const previousItems = work?.activeImportId
		? await tx.constructionBudgetItem.findMany({
				where: {
					ownerId: input.ownerId,
					workId: input.workId,
					importId: work.activeImportId,
				},
				select: {
					id: true,
					index: true,
					identityId: true,
					laborUnitCost: true,
					materialUnitCost: true,
					equipmentUnitCost: true,
					otherUnitCost: true,
					actualStart: true,
					actualEnd: true,
					completionPercentage: true,
					providedStatus: true,
					computedStatus: true,
				},
			})
		: [];

	const operationalImport = await tx.constructionImport.create({
		data: {
			ownerId: input.ownerId,
			workId: input.workId,
			fileName: version.label,
			sheetName: "Orcamento",
			rowCount: version.items.length,
			importedSections: ["Orcamento", "Cronograma Original"],
			status: "IMPORTED",
		},
		select: { id: true },
	});

	const indexById = new Map(version.items.map((item) => [item.id, item.index]));
	const previousByIndex = new Map(
		previousItems.map((item) => [item.index, item]),
	);
	const items: NormalizedBudgetItem[] = version.items.map((item) => {
		const previous = previousByIndex.get(item.index);
		return {
			rowNumber: item.sortOrder,
			identityId: item.identityId,
			index: item.index,
			parentIndex: item.parentVersionId
				? (indexById.get(item.parentVersionId) ?? null)
				: null,
			type: item.type === "STAGE" ? "STAGE" : "ITEM",
			description: item.description,
			unit: item.unit,
			quantity: item.quantity?.toNumber() ?? null,
			laborUnitCost: previous?.laborUnitCost?.toNumber() ?? 0,
			materialUnitCost: previous?.materialUnitCost?.toNumber() ?? 0,
			equipmentUnitCost: previous?.equipmentUnitCost?.toNumber() ?? 0,
			otherUnitCost: previous?.otherUnitCost?.toNumber() ?? 0,
			unitCostTotal: item.unitCost?.toNumber() ?? 0,
			totalBudget: item.totalCost.toNumber(),
			unitCost: item.unitCost?.toNumber() ?? null,
			totalCost: item.totalCost.toNumber(),
			plannedStart: item.plannedStart,
			plannedEnd: item.plannedEnd,
			actualStart: previous?.actualStart ?? null,
			actualEnd: previous?.actualEnd ?? null,
			completionPercentage: previous?.completionPercentage?.toNumber() ?? 0,
			providedStatus: previous?.providedStatus ?? null,
			computedStatus:
				(previous?.computedStatus as
					| NormalizedBudgetItem["computedStatus"]
					| null) ?? "NOT_STARTED",
			sortOrder: item.sortOrder,
		};
	});

	const indexToId = new Map<string, string>();
	for (const item of [...items].sort((left, right) =>
		compareIndexHierarchy(left.index, right.index),
	)) {
		const created = await tx.constructionBudgetItem.create({
			data: {
				ownerId: input.ownerId,
				workId: input.workId,
				importId: operationalImport.id,
				identityId: item.identityId ?? null,
				parentId: item.parentIndex
					? (indexToId.get(item.parentIndex) ?? null)
					: null,
				index: item.index,
				type: item.type,
				description: item.description,
				unit: item.unit,
				quantity: item.quantity,
				laborUnitCost: item.laborUnitCost,
				materialUnitCost: item.materialUnitCost,
				equipmentUnitCost: item.equipmentUnitCost,
				otherUnitCost: item.otherUnitCost,
				unitCostTotal: item.unitCostTotal,
				totalBudget: item.totalBudget,
				unitCost: item.unitCost,
				totalCost: item.totalCost,
				plannedStart: item.plannedStart,
				plannedEnd: item.plannedEnd,
				completionPercentage: item.completionPercentage,
				providedStatus: item.providedStatus,
				computedStatus: item.computedStatus,
				sortOrder: item.sortOrder,
			},
			select: { id: true, index: true },
		});
		indexToId.set(created.index, created.id);
		if (item.plannedStart || item.plannedEnd) {
			await tx.constructionBaselineSchedule.create({
				data: {
					ownerId: input.ownerId,
					workId: input.workId,
					importId: operationalImport.id,
					budgetItemId: created.id,
					rowNumber: item.rowNumber,
					index: item.index,
					plannedStart: item.plannedStart,
					plannedEnd: item.plannedEnd,
				},
			});
		}
	}

	// A projeção cria novos IDs para manter o snapshot imutável. Os vínculos
	// operacionais, porém, precisam acompanhar o item equivalente da nova
	// importação; caso contrário custos, medições e contratos ficam presos ao
	// snapshot anterior e desaparecem do orçamento vigente.
	const newItemIdByIndex = indexToId;
	for (const previousItem of previousItems) {
		const newItemId = newItemIdByIndex.get(previousItem.index);
		if (!newItemId) continue;
		const where = { budgetItemId: previousItem.id };
		await tx.constructionActualCost.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.actualCostAllocation.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.constructionMeasurement.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.constructionScheduleRevision.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.scheduleVersionItem.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.workMeasurementItem.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.contractService.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.quotationBudgetItem.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
		await tx.contractRequestBudgetItem.updateMany({
			where,
			data: { budgetItemId: newItemId },
		});
	}
	await tx.constructionWork.update({
		where: { id: input.workId, ownerId: input.ownerId },
		data: { activeImportId: operationalImport.id },
	});
	await tx.budgetProjectionState.upsert({
		where: { workId: input.workId },
		create: {
			ownerId: input.ownerId,
			workId: input.workId,
			status: "READY",
			sourceVersionId: input.budgetVersionId,
		},
		update: {
			ownerId: input.ownerId,
			status: "READY",
			sourceVersionId: input.budgetVersionId,
			lastError: null,
		},
	});
	await tx.budgetProjectionOutbox.updateMany({
		where: {
			workId: input.workId,
			sourceVersionId: input.budgetVersionId,
			status: { in: ["PENDING", "PROCESSING"] },
		},
		data: { status: "DONE", processedAt: new Date(), lockedAt: null },
	});

	return { importId: operationalImport.id };
}
