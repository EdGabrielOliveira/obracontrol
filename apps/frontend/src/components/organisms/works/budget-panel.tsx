import { createColumnHelper } from "@tanstack/react-table";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { VersionChangeInfo } from "@/lib/budget-version-diff";
import type { BudgetTreeItem } from "@/types/budget";
import {
	BUDGET_TYPE_LABEL,
	formatCurrency,
	naturalSortIndex,
} from "@/utils/format";

interface BudgetPanelProps {
	items: BudgetTreeItem[];
	onEdit: (item: BudgetTreeItem) => void;
	onDelete: (id: string) => void;
	onAddChild: (parent: BudgetTreeItem) => void;

	versionChanges?: ReadonlyMap<string, VersionChangeInfo>;

	disabled?: boolean;
}

function VersionChangeBadge({ change }: { change: VersionChangeInfo }) {
	if (change.kind === "NEW") {
		return (
			<Badge
				variant="outline"
				className="ml-2 shrink-0 border-primary/40 bg-primary/10 text-primary"
				title="Item novo no aditivo vigente"
			>
				Novo
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="status-warning ml-2 shrink-0"
			title={`${formatCurrency(change.previousTotal ?? 0)} → ${formatCurrency(change.currentTotal)}`}
		>
			Alterado
		</Badge>
	);
}

function countTreeItems(items: BudgetTreeItem[]): {
	stages: number;
	items: number;
} {
	let stages = 0;
	let itemCount = 0;

	const visit = (nodes: BudgetTreeItem[]) => {
		for (const node of nodes) {
			itemCount += 1;
			if (node.parentId === null) stages += 1;
			visit(node.children);
		}
	};

	visit(items);
	return { stages, items: itemCount };
}

export function BudgetPanel({
	items,
	onEdit,
	onDelete,
	onAddChild,
	versionChanges,
	disabled = false,
}: BudgetPanelProps) {
	const budgetColumnHelper = createColumnHelper<BudgetTreeItem>();

	const { stages, items: itemCount } = countTreeItems(items);
	const resultCountLabel = (filteredCount: number, isSearching: boolean) =>
		isSearching
			? `${filteredCount} resultado${filteredCount === 1 ? "" : "s"}`
			: `${stages} etapa${stages === 1 ? "" : "s"} / ${itemCount} ${itemCount === 1 ? "item" : "itens"}`;

	const budgetColumns = [
		budgetColumnHelper.accessor("index", {
			header: "Índice",
			cell: (info) => info.getValue(),
			meta: { className: "font-mono text-xs", mobileLabel: "Índice" },
		}),
		budgetColumnHelper.accessor("type", {
			header: "Tipo",
			cell: (info) => BUDGET_TYPE_LABEL[info.getValue()] ?? info.getValue(),
			meta: { mobileLabel: "Tipo" },
		}),
		budgetColumnHelper.accessor("description", {
			header: "Descrição",
			cell: (info) => {
				const change = versionChanges?.get(info.row.original.index);
				return (
					<div className="flex items-center">
						<span className="truncate">{info.getValue()}</span>
						{change && <VersionChangeBadge change={change} />}
					</div>
				);
			},
			meta: { mobileLabel: "Descrição" },
		}),
		budgetColumnHelper.accessor("unit", {
			header: "Unidade",
			cell: (info) => info.getValue() ?? "-",
			meta: { mobileLabel: "Unidade" },
		}),
		budgetColumnHelper.accessor("quantity", {
			header: "Quantidade",
			cell: (info) =>
				info.getValue() != null
					? info.getValue()?.toLocaleString("pt-BR")
					: "-",
			meta: { className: "text-right", mobileLabel: "Quantidade" },
		}),
		budgetColumnHelper.accessor("totalCost", {
			header: "Total",
			cell: (info) => formatCurrency(info.getValue() ?? 0),
			meta: { className: "text-right font-medium", mobileLabel: "Total" },
		}),
		budgetColumnHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const item = info.row.original;
				return (
					<div className="flex justify-end gap-1" data-no-row-click>
						<Button
							variant="ghost"
							size="icon"
							disabled={disabled}
							onClick={() => onEdit(item)}
						>
							<Pencil className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							disabled={disabled}
							onClick={() => onDelete(item.id)}
						>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
						{item.type === "STAGE" && (
							<Button
								type="button"
								size="sm"
								disabled={disabled}
								onClick={() => onAddChild(item)}
							>
								<Plus className="h-4 w-4" />
							</Button>
						)}
					</div>
				);
			},
			meta: { className: "text-right" },
		}),
	];

	return (
		<Card>
			<CardHeaderWithIcon
				icon={Layers}
				title="Itens do Orçamento"
				description="Lista de itens de orçamento da obra."
			/>
			{disabled ? (
				<p className="status-warning mx-6 mb-2 rounded-md px-3 py-2 text-sm">
					Orçamento sob governança (aceito ou travado): ações de edição estão
					desabilitadas até reabertura.
				</p>
			) : null}
			<CardContent>
				<DataTable
					columns={budgetColumns}
					data={[...items].sort((a, b) => naturalSortIndex(a.index, b.index))}
					getSubRows={(item) =>
						item.children.length > 0 ? item.children : undefined
					}
					searchPlaceholder="Buscar itens..."
					pageSize={50}
					resultCountLabel={resultCountLabel}
				/>
			</CardContent>
		</Card>
	);
}
