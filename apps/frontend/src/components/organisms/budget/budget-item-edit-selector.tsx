import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { getCurrentCostBudgetItems } from "@/api/budget";
import { workKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import {
	effectiveItemsToTree,
	type FlatBudgetNode,
	filterBudgetSelectorItems,
	flattenBudgetSelectorItems,
} from "@/components/organisms/budget/budget-item-selector";
import { Input } from "@/components/ui/input";
import type { BudgetTreeItem } from "@/types/budget";

type BudgetItemEditSelectorProps = {
	workId: string;
	budgetItems?: BudgetTreeItem[];
	selectedItemId?: string | null;
	onSelect: (item: BudgetTreeItem) => void;
	renderItemDetails?: (item: BudgetTreeItem) => ReactNode;
	disabled?: boolean;
};

export function BudgetItemEditSelector({
	workId,
	budgetItems: injectedItems,
	selectedItemId,
	onSelect,
	renderItemDetails,
	disabled = false,
}: BudgetItemEditSelectorProps) {
	const [search, setSearch] = useState("");
	const [expandedIds, setExpandedIds] = useState<Set<string> | null>(new Set());
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
		enabled: injectedItems === undefined,
	});
	const items = injectedItems ?? effectiveItemsToTree(data);
	const rows = useMemo(() => flattenBudgetSelectorItems(items), [items]);
	const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
	const filteredRows = useMemo<FlatBudgetNode[]>(
		() =>
			normalizedSearch
				? filterBudgetSelectorItems(items, normalizedSearch)
				: rows,
		[items, normalizedSearch, rows],
	);
	const visibleRows = useMemo(
		() =>
			filteredRows.filter(
				(item) =>
					normalizedSearch.length > 0 ||
					item.depth === 0 ||
					expandedIds === null ||
					item.parentIds.every((parentId) => expandedIds.has(parentId)),
			),
		[expandedIds, filteredRows, normalizedSearch],
	);

	if (injectedItems === undefined && (isLoading || error || !data)) {
		if (isLoading) return <LoadingSpinner title="Carregando orçamento..." />;
		return <ErrorFeedback onRetry={() => void refetch()} />;
	}

	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-6 text-center">
				<p className="text-sm font-medium">
					Nenhum item disponível para edição.
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Adicione itens ao orçamento antes de editar.
				</p>
			</div>
		);
	}

	const toggleStage = (stageId: string) => {
		setExpandedIds((current) => {
			const next = new Set(
				current ?? rows.filter((row) => !row.leaf).map((row) => row.id),
			);
			if (next.has(stageId)) next.delete(stageId);
			else next.add(stageId);
			return next;
		});
	};

	return (
		<div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
			<div className="space-y-3 border-b border-border bg-muted/20 p-3">
				<div>
					<p className="text-sm font-semibold">Itens do orçamento</p>
					<p className="text-xs text-muted-foreground">
						Clique em um item para abrir a edição.
					</p>
				</div>
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por índice ou descrição..."
						className="h-9 bg-background pl-9 pr-9 text-sm"
						disabled={disabled}
					/>
					{search && (
						<button
							type="button"
							aria-label="Limpar busca"
							className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={() => setSearch("")}
						>
							<X className="size-4" />
						</button>
					)}
				</div>
			</div>

			<div className="min-w-0 max-h-[70vh] overflow-x-hidden overflow-y-auto">
				{visibleRows.length === 0 ? (
					<div className="p-8 text-center text-sm text-muted-foreground">
						Nenhum item encontrado para “{search}”.
					</div>
				) : (
					visibleRows.map((item) => {
						if (!item.leaf) {
							const expanded = expandedIds === null || expandedIds.has(item.id);
							return (
								<button
									type="button"
									key={item.id}
									className="flex w-full items-center gap-2 border-b border-border bg-muted/50 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted"
									style={{ paddingLeft: `${12 + item.depth * 20}px` }}
									onClick={() => toggleStage(item.id)}
									disabled={disabled}
								>
									{expanded ? (
										<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
									) : (
										<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
									)}
									<span className="text-muted-foreground">{item.index}</span>
									{item.description}
								</button>
							);
						}

						const selected = selectedItemId === item.id;
						return (
							<div
								key={item.id}
								className={`border-b border-border last:border-b-0 ${
									selected ? "bg-primary/[0.08]" : "hover:bg-muted/40"
								}`}
							>
								<button
									type="button"
									onClick={() => onSelect(item)}
									disabled={disabled}
									className="w-full px-3 py-2.5 text-left"
									style={{ paddingLeft: `${12 + item.depth * 20}px` }}
								>
									<span className="block truncate text-sm font-medium">
										<span className="mr-1.5 font-mono text-xs text-muted-foreground">
											{item.index}
										</span>
										{item.description}
									</span>
									<span className="mt-0.5 block text-xs text-muted-foreground">
										{item.unit ?? "Sem unidade"} · Quantidade:{" "}
										{item.quantity ?? "-"}
									</span>
								</button>
								{selected && renderItemDetails?.(item)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
