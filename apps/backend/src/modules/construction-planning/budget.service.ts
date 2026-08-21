import { ConstructionError } from "../../lib/errors";
import { roundCurrency } from "../../lib/math-utils";
import { prisma } from "../../lib/prisma";
import * as budgetRepository from "./budget.repository";
import { deriveBudgetItemTotalCost } from "./calculators/budget-calculator";
import {
	budgetGovernanceGuard,
	type GovernanceMutationGuard,
} from "./governance-guard";
import { replaceBudgetWithImport } from "./imports/import-repository";
import { rejectedRowCount } from "./imports/import-service";
import { parseWorkbookByKind } from "./imports/parser";
import { validateWorkbookByKind } from "./imports/validator";
import type {
	CreateBudgetItemInput,
	ReorderBudgetItemsInput,
	UpdateBdiInput,
	UpdateBudgetItemInput,
} from "./schemas/budget.schema";

type BudgetServiceRepository = Pick<
	typeof budgetRepository,
	| "getBudgetView"
	| "getBudgetItemDetail"
	| "createBudgetItem"
	| "updateBudgetItem"
	| "deleteBudgetItem"
	| "reorderBudgetItems"
	| "findByIndex"
	| "sumChildrenTotalCost"
>;

const HIERARCHY_MAP: Record<string, Set<string>> = {
	STAGE: new Set(["STAGE", "SUBSTAGE", "ITEM", "COMPOSITION", "INPUT"]),
	SUBSTAGE: new Set(["SUBSTAGE", "ITEM", "COMPOSITION", "INPUT"]),
	ITEM: new Set(["COMPOSITION", "INPUT"]),
	COMPOSITION: new Set(["INPUT"]),
	INPUT: new Set(),
};

const maxUploadBytes = 10 * 1024 * 1024;
const allowedUploadTypes = new Set([
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/octet-stream",
	"",
]);

export class BudgetService {
	constructor(
		private readonly repository: BudgetServiceRepository = budgetRepository,
		private readonly governance: GovernanceMutationGuard = budgetGovernanceGuard,
	) {}

	private assertBudgetWritable(ownerId: string, workId: string) {
		return this.governance.assertWritable(ownerId, "BUDGET", workId);
	}

	async getBudget(ownerId: string, workId: string) {
		const result = await this.repository.getBudgetView(ownerId, workId);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const record = await this.governance.isWritableBlocked(
			ownerId,
			"BUDGET",
			workId,
		);
		return { ...result, governed: record };
	}

	async getBudgetItem(ownerId: string, workId: string, itemId: string) {
		const result = await this.repository.getBudgetItemDetail(
			ownerId,
			workId,
			itemId,
		);
		if (!result) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Item de orcamento nao encontrado",
				404,
			);
		}
		return result;
	}

	private async validateItemDates(
		input: {
			parentId?: string | null;
			plannedStart?: string | null;
			plannedEnd?: string | null;
		},
		ownerId: string,
		workId: string,
	) {
		if (!input.parentId) return;
		if (!input.plannedStart && !input.plannedEnd) return;

		const parent = await prisma.constructionBudgetItem.findFirst({
			where: { id: input.parentId, ownerId, workId },
			select: { plannedStart: true, plannedEnd: true },
		});

		if (!parent?.plannedStart && !parent?.plannedEnd) return;

		const itemStart = input.plannedStart ? new Date(input.plannedStart) : null;
		const itemEnd = input.plannedEnd ? new Date(input.plannedEnd) : null;

		if (itemStart && parent.plannedStart && itemStart < parent.plannedStart) {
			throw new ConstructionError(
				"INVALID_ITEM_DATE",
				"A data de início do item deve ser igual ou posterior à data de início da etapa",
				400,
			);
		}

		if (itemEnd && parent.plannedEnd && itemEnd > parent.plannedEnd) {
			throw new ConstructionError(
				"INVALID_ITEM_DATE",
				"A data de fim do item deve ser igual ou anterior à data de fim da etapa",
				400,
			);
		}
	}

	private async validateBudgetItem(
		ownerId: string,
		workId: string,
		input: { parentId?: string | null; type?: string },
		itemId?: string,
	) {
		if (input.parentId) {
			const parent = await prisma.constructionBudgetItem.findFirst({
				where: { id: input.parentId, ownerId, workId },
				select: { id: true, type: true, index: true },
			});
			if (!parent) {
				throw new ConstructionError(
					"INVALID_PARENT",
					"Item pai nao encontrado ou pertence a outra obra",
					400,
				);
			}

			if (input.type && !HIERARCHY_MAP[parent.type]?.has(input.type)) {
				throw new ConstructionError(
					"INVALID_HIERARCHY",
					`Tipo "${input.type}" nao permitido como filho de "${parent.type}"`,
					400,
				);
			}

			if (itemId) {
				const descendants = await this.getDescendantIds(
					ownerId,
					workId,
					itemId,
				);
				if (descendants.has(input.parentId)) {
					throw new ConstructionError(
						"CYCLE_DETECTED",
						"Nao e permitido definir um descendente como pai (ciclo)",
						400,
					);
				}
			}
		}
	}

	private async getDescendantIds(
		ownerId: string,
		workId: string,
		itemId: string,
	): Promise<Set<string>> {
		const all = await prisma.constructionBudgetItem.findMany({
			where: { ownerId, workId },
			select: { id: true, parentId: true },
		});
		const childrenMap = new Map<string, string[]>();
		for (const item of all) {
			if (item.parentId) {
				const list = childrenMap.get(item.parentId) ?? [];
				list.push(item.id);
				childrenMap.set(item.parentId, list);
			}
		}
		const result = new Set<string>();
		const stack = childrenMap.get(itemId) ?? [];
		while (stack.length > 0) {
			const id = stack.pop() as string;
			if (result.has(id)) continue;
			result.add(id);
			const kids = childrenMap.get(id);
			if (kids) stack.push(...kids);
		}
		return result;
	}

	private assertParentChildTotal(parentTotalCost: number, expected: number) {
		if (roundCurrency(parentTotalCost) !== roundCurrency(expected)) {
			throw new ConstructionError(
				"BUDGET_ITEM_TOTAL_MISMATCH",
				"Total do item pai deve ser a soma dos itens filhos",
				422,
			);
		}
	}

	private async validateParentChildTotals(
		ownerId: string,
		workId: string,
		input: {
			parentId?: string | null;
			totalCost?: number | null;
			quantity?: number | null;
			unitCost?: number | null;
			laborUnitCost?: number | null;
			materialUnitCost?: number | null;
			equipmentUnitCost?: number | null;
			otherUnitCost?: number | null;
		},
		itemId?: string,
	) {
		const self = itemId
			? await this.repository.sumChildrenTotalCost(ownerId, workId, itemId)
			: null;

		const effectiveTotalCost = roundCurrency(
			self
				? (input.totalCost ?? self.parentTotalCost)
				: deriveBudgetItemTotalCost(input),
		);

		if (self && self.childrenCount > 0) {
			this.assertParentChildTotal(self.childrenTotalCost, effectiveTotalCost);
		}

		if (input.parentId) {
			const parent = await this.repository.sumChildrenTotalCost(
				ownerId,
				workId,
				input.parentId,
				itemId,
			);
			if (parent) {
				this.assertParentChildTotal(
					parent.parentTotalCost,
					parent.childrenTotalCost + effectiveTotalCost,
				);
			}
		}
	}

	async createItem(
		ownerId: string,
		workId: string,
		input: CreateBudgetItemInput,
	) {
		await this.assertBudgetWritable(ownerId, workId);
		const existingIndex = await this.repository.findByIndex(
			ownerId,
			workId,
			input.index,
		);
		if (existingIndex) {
			throw new ConstructionError(
				"DUPLICATE_BUDGET_INDEX",
				"Indice duplicado no orcamento",
				422,
			);
		}
		await this.validateBudgetItem(ownerId, workId, input);
		await this.validateItemDates(input, ownerId, workId);
		await this.validateParentChildTotals(ownerId, workId, input);
		return this.repository.createBudgetItem(ownerId, workId, input);
	}

	async updateItem(
		ownerId: string,
		workId: string,
		itemId: string,
		input: UpdateBudgetItemInput,
	) {
		await this.assertBudgetWritable(ownerId, workId);
		if (input.index) {
			const existingIndex = await this.repository.findByIndex(
				ownerId,
				workId,
				input.index,
				itemId,
			);
			if (existingIndex) {
				throw new ConstructionError(
					"DUPLICATE_BUDGET_INDEX",
					"Indice duplicado no orcamento",
					422,
				);
			}
		}
		if (input.parentId !== undefined || input.type !== undefined) {
			await this.validateBudgetItem(ownerId, workId, input, itemId);
		}
		await this.validateItemDates(input, ownerId, workId);
		await this.validateParentChildTotals(ownerId, workId, input, itemId);
		if (input.totalCost !== undefined && input.totalCost !== null) {
			await this.assertNoReductionBelowExposure(
				ownerId,
				workId,
				itemId,
				input.totalCost,
			);
		}
		return this.repository.updateBudgetItem(ownerId, workId, itemId, input);
	}

	private async assertNoReductionBelowExposure(
		ownerId: string,
		workId: string,
		itemId: string,
		newTotalCost: number,
	) {
		const item = await prisma.constructionBudgetItem.findFirst({
			where: { id: itemId, ownerId, workId },
			select: { totalCost: true },
		});
		if (!item) return;
		if (newTotalCost >= Number(item.totalCost)) return;

		const exposure = await this.currentItemExposure(ownerId, workId, itemId);
		if (newTotalCost < exposure) {
			throw new ConstructionError(
				"REDUCTION_BELOW_EXPOSURE",
				"Reducao abaixo do realizado/comprometido/incorrido do item",
				422,
			);
		}
	}

	private async currentItemExposure(
		_ownerId: string,
		_workId: string,
		itemId: string,
	): Promise<number> {
		const [
			measuredAggregate,
			contractAggregate,
			actualCostAggregate,
			allocatedAggregate,
		] = await Promise.all([
			prisma.workMeasurementItem.aggregate({
				where: { budgetItemId: itemId },
				_sum: { accumulatedValue: true },
			}),
			prisma.contractService.aggregate({
				where: { budgetItemId: itemId },
				_sum: { totalCost: true },
			}),
			prisma.constructionActualCost.aggregate({
				where: { budgetItemId: itemId },
				_sum: { amount: true },
			}),
			prisma.actualCostAllocation.aggregate({
				where: { budgetItemId: itemId },
				_sum: { value: true },
			}),
		]);
		const values = [
			measuredAggregate._sum.accumulatedValue,
			contractAggregate._sum.totalCost,
			actualCostAggregate._sum?.amount,
			allocatedAggregate._sum?.value,
		];
		return roundCurrency(
			Math.max(0, ...values.map((value) => Number(value ?? 0))),
		);
	}

	async deleteItem(ownerId: string, workId: string, itemId: string) {
		await this.assertBudgetWritable(ownerId, workId);
		const result = await this.repository.deleteBudgetItem(
			ownerId,
			workId,
			itemId,
		);
		if (!result) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Item de orcamento nao encontrado",
				404,
			);
		}
		return result;
	}

	reorderItems(
		ownerId: string,
		workId: string,
		items: ReorderBudgetItemsInput["items"],
	) {
		return this.assertBudgetWritable(ownerId, workId).then(() =>
			this.repository.reorderBudgetItems(ownerId, workId, items),
		);
	}

	async updateBdi(ownerId: string, workId: string, input: UpdateBdiInput) {
		await this.assertBudgetWritable(ownerId, workId);
		const work = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
		});
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		await prisma.constructionWork.update({
			where: { id: workId, ownerId },
			data: { bdiPercentage: input.bdiPercentage },
		});

		return this.getBudget(ownerId, workId);
	}

	async importBudget(
		ownerId: string,
		workId: string,
		input: { file: File; sheetName?: string },
	) {
		await this.assertBudgetWritable(ownerId, workId);
		if (!input.file) {
			throw new ConstructionError("MISSING_FILE", "Arquivo obrigatorio", 400);
		}
		if (!input.file.name.toLowerCase().endsWith(".xlsx")) {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Apenas arquivos .xlsx sao aceitos",
				400,
			);
		}
		if (!allowedUploadTypes.has(input.file.type)) {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Tipo de arquivo invalido",
				400,
			);
		}
		if (input.file.size > maxUploadBytes) {
			throw new ConstructionError(
				"FILE_TOO_LARGE",
				"Arquivo deve ter no maximo 10MB",
				413,
			);
		}

		const bytes = new Uint8Array(await input.file.arrayBuffer());
		const workbook = parseWorkbookByKind(bytes, input.file.name, "orcamento");
		const validation = validateWorkbookByKind(workbook, "orcamento");

		const structural = validation.errors.filter(
			(error) => error.row === undefined,
		);
		if (structural.length > 0) {
			throw new ConstructionError(
				"VALIDATION_FAILED",
				"Planilha invalida",
				422,
				structural,
			);
		}

		const importedCount = validation.normalizedRows.length;
		const imp = await replaceBudgetWithImport(
			ownerId,
			workId,
			validation.normalizedRows,
			{
				fileName: input.file.name,
				sheetName: input.sheetName ?? "Orcamento",
				rowCount: validation.normalizedRows.length,
			},
		);

		return {
			workId: imp.workId,
			importId: imp.importId,
			processedSheets: validation.processedSheets,
			importedCount,
			rejectedCount: rejectedRowCount(validation.errors),
			rowCount: importedCount,
			imported: importedCount,
			warningCount: validation.warnings.length,
			warnings: validation.warnings,
			errors: validation.errors,
			importedSections: validation.work.importedSections,
		};
	}
}

export const budgetService = new BudgetService();
