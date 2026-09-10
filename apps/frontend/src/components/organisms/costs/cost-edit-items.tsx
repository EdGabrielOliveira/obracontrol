import { useMemo } from "react";
import type { CostItem, UpdateActualCostInput } from "@/api/costs";
import {
	BudgetItemSelector,
	type BudgetItemSelectorFilter,
} from "@/components/organisms/budget/budget-item-selector";
import { CostEditItemRow } from "@/components/organisms/costs/cost-edit-item-row";
import { costItemsToBudgetTree } from "@/components/organisms/costs/cost-item-groups";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import type { WorkSupplier } from "@/types/suppliers";
import {
	CATEGORY_LABEL,
	COST_TYPE_LABEL,
	formatCurrency,
	PAYMENT_STATUS_LABEL,
} from "@/utils/format";

export function CostEditItems({
	items,
	budgetItems,
	suppliers,
	savingItemId,
	disabled = false,
	onItemPatch,
}: {
	items: CostItem[];
	budgetItems: CostBudgetItemSelectorResponse["items"];
	suppliers: WorkSupplier[];
	savingItemId?: string;
	disabled?: boolean;
	onItemPatch: (itemId: string, patch: UpdateActualCostInput) => void;
}) {
	const itemById = useMemo(
		() => new Map(items.map((item) => [item.id, item])),
		[items],
	);
	const budgetItemById = useMemo(
		() => new Map(budgetItems.map((item) => [item.id, item])),
		[budgetItems],
	);
	const budgetTree = useMemo(() => costItemsToBudgetTree(items), [items]);
	const itemSearchText = (item: {
		id: string;
		index: string;
		description: string;
	}) => {
		const cost = itemById.get(item.id);
		return [
			item.index,
			item.description,
			cost?.category,
			cost && CATEGORY_LABEL[cost.category],
			cost?.categoryDetail,
			cost?.description,
			cost?.supplier?.name,
			cost?.supplierName,
			cost && COST_TYPE_LABEL[cost.costType],
			cost && PAYMENT_STATUS_LABEL[cost.paymentStatus],
		]
			.filter(Boolean)
			.join(" ");
	};
	const filters: BudgetItemSelectorFilter[] = [
		{
			id: "open",
			label: "Em aberto",
			predicate: (row) => itemById.get(row.id)?.paymentStatus === "OPEN",
		},
		{
			id: "paid",
			label: "Pagos",
			predicate: (row) => itemById.get(row.id)?.paymentStatus === "PAID",
		},
		{
			id: "future",
			label: "Futuros",
			predicate: (row) => itemById.get(row.id)?.costType === "FUTURE",
		},
		{
			id: "supplier",
			label: "Com fornecedor",
			predicate: (row) =>
				Boolean(
					itemById.get(row.id)?.supplier?.name ??
						itemById.get(row.id)?.supplierName,
				),
		},
	];

	return (
		<BudgetItemSelector
			budgetItems={budgetTree}
			selectedItems={[]}
			onChange={() => undefined}
			selectionMode="browse"
			title={`Itens de custo (${items.length})`}
			description="Pesquise, filtre por status e abra um lançamento para editar seus campos. As alterações são salvas automaticamente."
			itemSearchText={itemSearchText}
			filters={filters}
			disabled={disabled}
			renderItem={({ item }) => {
				const cost = itemById.get(item.id);
				if (!cost) return null;
				return (
					<CostEditItemRow
						item={cost}
						budgetItem={
							cost.budgetVersionItem?.id
								? budgetItemById.get(cost.budgetVersionItem.id)
								: undefined
						}
						suppliers={suppliers}
						saving={savingItemId === cost.id}
						disabled={disabled}
						onPatch={(patch) => onItemPatch(cost.id, patch)}
					/>
				);
			}}
			renderFooter={({ filteredItems }) => {
				const filteredTotal = filteredItems.reduce(
					(sum, item) => sum + Number(itemById.get(item.id)?.amount ?? 0),
					0,
				);
				return (
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-3 text-sm sm:px-4">
						<span className="text-xs font-medium text-muted-foreground">
							{filteredItems.length} item(ns) filtrado(s)
						</span>
						<span className="font-bold text-primary">
							{formatCurrency(filteredTotal)}
						</span>
					</div>
				);
			}}
		/>
	);
}
