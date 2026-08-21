import { ConstructionError } from "../../lib/errors";
import { roundCurrency } from "../../lib/math-utils";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";

export type CostBudgetItemStage = {
	index: string;
	displayIndex: string;
	description: string;
};

export type CostBudgetItemOption = {
	id: string;
	/** ID operacional aceito pelos fluxos de custo, medição e contrato. */
	budgetItemId: string;
	identityId: string;
	index: string;
	displayIndex: string;
	description: string;
	unit: string | null;
	quantity: number | null;
	totalCost: number;
	unitCost: number | null;
	stage: CostBudgetItemStage | null;
};

export type CostBudgetItemSelectorResponse = {
	version: {
		id: string;
		number: number;
		label: string;
		displayIndex: string;
	};
	items: CostBudgetItemOption[];
};

const SELECTABLE_COST_ITEM_TYPES = new Set(["ITEM", "COMPOSITION", "INPUT"]);

export function displayBudgetIndex(index: string): string {
	return index;
}

export function isSelectableCostItem(
	type: string,
	hasChildren: boolean,
): boolean {
	return !hasChildren && SELECTABLE_COST_ITEM_TYPES.has(type);
}

export async function listCurrentCostBudgetItems(
	ownerId: string,
	workId: string,
): Promise<CostBudgetItemSelectorResponse> {
	await resolveResourceScope(ownerId, { workId });

	const version = await prisma.budgetVersion.findFirst({
		where: { ownerId, workId, isActive: true },
		select: {
			id: true,
			versionNumber: true,
			label: true,
			budgetImportId: true,
		},
	});
	if (!version) {
		throw new ConstructionError(
			"BUDGET_VERSION_NOT_AVAILABLE",
			"A obra ainda nao possui versao de orcamento aprovada e vigente",
			422,
		);
	}

	const items = await prisma.budgetVersionItem.findMany({
		where: { versionId: version.id },
		orderBy: [{ sortOrder: "asc" }, { index: "asc" }],
		select: {
			id: true,
			identityId: true,
			parentVersionId: true,
			index: true,
			type: true,
			description: true,
			unit: true,
			quantity: true,
			unitCost: true,
			totalCost: true,
		},
	});
	const operationalItems = prisma.constructionBudgetItem
		? await prisma.constructionBudgetItem.findMany({
				where: {
					ownerId,
					workId,
					...(version.budgetImportId
						? { importId: version.budgetImportId }
						: {}),
					OR: [
						{ identityId: { in: items.map((item) => item.identityId) } },
						{ index: { in: items.map((item) => item.index) } },
					],
				},
				select: { id: true, identityId: true, index: true },
			})
		: [];
	const operationalByIdentity = new Map(
		operationalItems.map((item) => [item.identityId, item.id]),
	);
	const operationalByIndex = new Map(
		operationalItems.map((item) => [item.index, item.id]),
	);

	const itemById = new Map(items.map((item) => [item.id, item]));
	const childrenCount = new Map<string, number>();
	for (const item of items) {
		if (item.parentVersionId) {
			childrenCount.set(
				item.parentVersionId,
				(childrenCount.get(item.parentVersionId) ?? 0) + 1,
			);
		}
	}

	const options: CostBudgetItemOption[] = [];
	for (const item of items) {
		const hasChildren = (childrenCount.get(item.id) ?? 0) > 0;
		if (!isSelectableCostItem(item.type, hasChildren)) continue;
		const parent = item.parentVersionId
			? itemById.get(item.parentVersionId)
			: undefined;
		options.push({
			id: item.id,
			budgetItemId:
				operationalByIdentity.get(item.identityId) ??
				operationalByIndex.get(item.index) ??
				item.id,
			identityId: item.identityId,
			index: item.index,
			displayIndex: displayBudgetIndex(item.index),
			description: item.description,
			unit: item.unit,
			quantity: item.quantity == null ? null : Number(item.quantity),
			totalCost: roundCurrency(Number(item.totalCost)),
			unitCost:
				item.unitCost == null ? null : roundCurrency(Number(item.unitCost)),
			stage: parent
				? {
						index: parent.index,
						displayIndex: displayBudgetIndex(parent.index),
						description: parent.description,
					}
				: null,
		});
	}

	return {
		version: {
			id: version.id,
			number: version.versionNumber,
			label: version.label,
			displayIndex: String(version.versionNumber),
		},
		items: options,
	};
}
