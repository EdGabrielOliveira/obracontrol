import type { CostItem } from "@/api/costs";
import {
	BudgetItemSelector,
	type BudgetItemSelectorColumn,
	type BudgetItemSelectorFilter,
} from "@/components/organisms/budget/budget-item-selector";
import { costItemsToBudgetTree } from "@/components/organisms/costs/cost-item-groups";
import {
	categoryTone,
	costTypeTone,
	paymentStatusTone,
} from "@/components/organisms/costs/cost-item-presentation";
import { Badge } from "@/components/ui/badge";
import {
	CATEGORY_LABEL,
	COST_TYPE_LABEL,
	formatCurrency,
	formatDate,
	PAYMENT_STATUS_LABEL,
} from "@/utils/format";

export function CostDetailItems({
	items,
	totalAmount,
}: {
	items: CostItem[];
	totalAmount: number;
}) {
	const itemById = new Map(items.map((item) => [item.id, item]));
	const budgetItems = costItemsToBudgetTree(items);
	const itemSearchText = (item: {
		id: string;
		index: string;
		description: string;
	}) => {
		const cost = itemById.get(item.id);
		if (!cost) return `${item.index} ${item.description}`;
		return [
			item.index,
			item.description,
			cost.category,
			CATEGORY_LABEL[cost.category],
			cost.categoryDetail,
			cost.description,
			cost.supplier?.name,
			cost.supplierName,
			COST_TYPE_LABEL[cost.costType],
			PAYMENT_STATUS_LABEL[cost.paymentStatus],
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
	const columns: BudgetItemSelectorColumn[] = [
		{
			key: "category",
			label: "Categoria",
			cellClassName: "hidden text-xs sm:block",
			headerClassName: "hidden sm:block",
			render: ({ item }) => {
				const cost = itemById.get(item.id);
				return cost ? (
					<Badge variant="outline" tone={categoryTone(cost.category)}>
						{CATEGORY_LABEL[cost.category] ?? cost.category}
					</Badge>
				) : (
					"-"
				);
			},
		},
		{
			key: "date",
			label: "Data e tipo",
			cellClassName: "hidden text-xs sm:block",
			headerClassName: "hidden sm:block",
			render: ({ item }) => {
				const cost = itemById.get(item.id);
				return cost ? (
					<>
						<span className="block font-medium">
							{formatDate(cost.costDate)}
						</span>
						<Badge variant="outline" tone={costTypeTone(cost.costType)}>
							{COST_TYPE_LABEL[cost.costType] ?? cost.costType}
						</Badge>
					</>
				) : (
					"-"
				);
			},
		},
		{
			key: "payment",
			label: "Pagamento",
			cellClassName: "hidden sm:block",
			headerClassName: "hidden sm:block",
			render: ({ item }) => {
				const cost = itemById.get(item.id);
				return cost ? (
					<Badge variant="outline" tone={paymentStatusTone(cost.paymentStatus)}>
						{PAYMENT_STATUS_LABEL[cost.paymentStatus] ?? cost.paymentStatus}
					</Badge>
				) : (
					"-"
				);
			},
		},
		{
			key: "amount",
			label: "Valor",
			cellClassName: "text-right text-sm font-bold",
			headerClassName: "text-right",
			render: ({ item }) => (
				<>{formatCurrency(Number(itemById.get(item.id)?.amount ?? 0))}</>
			),
		},
	];

	return (
		<BudgetItemSelector
			budgetItems={budgetItems}
			selectedItems={[]}
			onChange={() => undefined}
			selectionMode="browse"
			hideTitle
			className="rounded-none border-0 shadow-none"
			title={`Itens de custo (${items.length})`}
			description="Consulte os lançamentos agrupados por etapa e filtre pelos principais campos financeiros."
			itemSearchText={itemSearchText}
			filters={filters}
			columns={columns}
			columnsGridClassName="grid-cols-[1.5rem_minmax(0,1fr)_minmax(7rem,0.7fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)_8rem]"
			renderFooter={({ filteredItems }) => {
				const filteredTotal = filteredItems.reduce(
					(sum, item) => sum + Number(itemById.get(item.id)?.amount ?? 0),
					0,
				);
				return (
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-3 text-sm sm:px-4">
						<span className="text-xs font-medium text-muted-foreground">
							{filteredItems.length} de {items.length} item(ns)
						</span>
						<span className="font-bold text-primary">
							{formatCurrency(
								filteredItems.length === items.length
									? totalAmount
									: filteredTotal,
							)}
						</span>
					</div>
				);
			}}
		/>
	);
}
