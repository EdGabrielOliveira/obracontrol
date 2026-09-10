import type { ReactNode } from "react";
import {
	type BudgetItemSelection,
	BudgetItemSelector,
} from "@/components/organisms/budget/budget-item-selector";
import type { BudgetTreeItem } from "@/types/budget";

type BudgetItemEditSelectorProps = {
	workId: string;
	budgetItems?: BudgetTreeItem[];
	selectedItemId?: string | null;
	onSelect: (item: BudgetTreeItem) => void;
	renderItemDetails?: (item: BudgetTreeItem) => ReactNode;
	disabled?: boolean;
};

/** Compatibility adapter for the budget editor backed by the shared selector. */
export function BudgetItemEditSelector({
	workId,
	budgetItems,
	selectedItemId,
	onSelect,
	renderItemDetails,
	disabled = false,
}: BudgetItemEditSelectorProps) {
	const selectedItems: BudgetItemSelection[] = selectedItemId
		? [{ budgetItemId: selectedItemId, quantity: 1 }]
		: [];

	return (
		<BudgetItemSelector
			workId={workId}
			budgetItems={budgetItems}
			selectedItems={selectedItems}
			onChange={() => undefined}
			selectionMode="single"
			showQuantity={false}
			showUnitPrice={false}
			disabled={disabled}
			title="Itens do orçamento"
			description="Pesquise e selecione um item para abrir sua edição."
			onItemClick={(item) => onSelect(item)}
			renderSelectedItemDetails={
				renderItemDetails ? ({ item }) => renderItemDetails(item) : undefined
			}
		/>
	);
}
