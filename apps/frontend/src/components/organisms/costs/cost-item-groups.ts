import type { CostItem } from "@/api/costs";
import type { BudgetTreeItem } from "@/types/budget";
import {
	CATEGORY_LABEL,
	COST_TYPE_LABEL,
	naturalSortIndex,
	PAYMENT_STATUS_LABEL,
} from "@/utils/format";

export type CostGroup = {
	key: string;
	index: string | null;
	description: string;
	items: CostItem[];
	total: number;
};

/**
 * Adapts cost entries to the shared budget tree so the same hierarchy can be
 * used by cost creation, editing and read-only presentation.
 */
export function costItemsToBudgetTree(items: CostItem[]): BudgetTreeItem[] {
	return buildCostGroups(items).map((group, groupIndex) => {
		const stageId = `cost-stage-${group.key}`;
		return {
			id: stageId,
			parentId: null,
			index: group.index ?? "—",
			type: "STAGE",
			description: group.description || "Itens sem etapa vinculada",
			unit: null,
			quantity: null,
			unitCost: null,
			totalCost: group.total,
			plannedStart: null,
			plannedEnd: null,
			completionPercentage: null,
			sortOrder: groupIndex,
			children: group.items.map((item, itemIndex) => ({
				id: item.id,
				versionItemId: item.budgetVersionItem?.id,
				parentId: stageId,
				index: getBudgetIndex(item) ?? "—",
				type: "ITEM",
				description:
					item.description ??
					item.budgetVersionItem?.description ??
					item.budgetItem?.description ??
					"Sem descrição",
				unit: item.budgetVersionItem?.unit ?? item.budgetItem?.unit ?? null,
				quantity: null,
				unitCost: null,
				totalCost: Number(item.amount),
				plannedStart: null,
				plannedEnd: null,
				completionPercentage: null,
				sortOrder: itemIndex,
				children: [],
			})),
		};
	});
}

export function getBudgetIndex(item: CostItem): string | null {
	return (
		item.budgetVersionItem?.index ??
		item.budgetItem?.index ??
		item.budgetIndex ??
		null
	);
}

function getBudgetDescription(item: CostItem): string {
	return (
		item.budgetVersionItem?.description ?? item.budgetItem?.description ?? ""
	);
}

function getStageIndex(index: string | null): string | null {
	if (!index) return null;
	const parts = index.split(".");
	return parts.length > 1 ? parts.slice(0, 2).join(".") : index;
}

function getStageDescription(
	items: CostItem[],
	stageIndex: string | null,
): string {
	if (!stageIndex) return "";
	const stageItem = items.find((item) => getBudgetIndex(item) === stageIndex);
	if (stageItem) return getBudgetDescription(stageItem);

	const linkedStage = items.find((item) => {
		const parent =
			item.budgetVersionItem?.parentVersion ?? item.budgetItem?.parent;
		return parent?.index === stageIndex;
	});
	return linkedStage
		? (linkedStage.budgetVersionItem?.parentVersion?.description ??
				linkedStage.budgetItem?.parent?.description ??
				"")
		: "";
}

export function buildCostGroups(items: CostItem[]): CostGroup[] {
	const groups = new Map<string, CostGroup>();
	for (const item of items) {
		const index = getStageIndex(getBudgetIndex(item));
		const key = index ?? "unallocated";
		const group = groups.get(key);
		if (group) {
			group.items.push(item);
			group.total += Number(item.amount);
			continue;
		}
		groups.set(key, {
			key,
			index,
			description: "",
			items: [item],
			total: Number(item.amount),
		});
	}

	return [...groups.values()]
		.map((group) => ({
			...group,
			description: getStageDescription(group.items, group.index),
		}))
		.sort((a, b) => {
			if (a.index === null) return 1;
			if (b.index === null) return -1;
			return naturalSortIndex(a.index, b.index);
		});
}

export function matchesCostSearch(item: CostItem, query: string): boolean {
	const searchableText = [
		getBudgetIndex(item),
		getBudgetDescription(item),
		item.budgetVersionItem?.parentVersion?.index,
		item.budgetVersionItem?.parentVersion?.description,
		item.budgetItem?.parent?.index,
		item.budgetItem?.parent?.description,
		item.description,
		item.category,
		CATEGORY_LABEL[item.category],
		item.categoryDetail,
		item.supplier?.name,
		item.supplierName,
		COST_TYPE_LABEL[item.costType],
		PAYMENT_STATUS_LABEL[item.paymentStatus],
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return searchableText.includes(query);
}
