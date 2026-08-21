import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getCurrentCostBudgetItems } from "@/api/budget";
import { workKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { BudgetTreeItem } from "@/types/budget";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import { formatCurrency, formatQuantity } from "@/utils/format";

export type BudgetItemSelection = {
	budgetItemId: string;
	budgetVersionItemId?: string;
	quantity: number;
	unitPrice?: number;
};

export type FlatBudgetNode = BudgetTreeItem & {
	depth: number;
	leaf: boolean;
	parentIds: string[];
};

export interface BudgetItemSelectorProps {
	workId: string;
	selectedItems: BudgetItemSelection[];
	onChange: (items: BudgetItemSelection[]) => void;
	budgetItems?: BudgetTreeItem[];

	effectiveBudgetItems?: CostBudgetItemSelectorResponse;
	disabled?: boolean;
	availableQuantities?: Record<string, number>;
	showUnitPrice?: boolean;
	editableUnitPrice?: boolean;
	quantityLabel?: string;
}

export function effectiveItemsToTree(
	response: CostBudgetItemSelectorResponse | undefined,
): BudgetTreeItem[] {
	if (!response) return [];
	const stages = new Map<string, BudgetTreeItem>();
	const roots: BudgetTreeItem[] = [];
	for (const option of response.items) {
		const item: BudgetTreeItem = {
			id: option.budgetItemId,
			versionItemId: option.id,
			parentId: null,
			index: option.displayIndex,
			type: "ITEM",
			description: option.description,
			unit: option.unit,
			quantity: option.quantity,
			unitCost: option.unitCost,
			totalCost: option.totalCost,
			plannedStart: null,
			plannedEnd: null,
			completionPercentage: null,
			sortOrder: roots.length,
			children: [],
		};
		if (!option.stage) {
			roots.push(item);
			continue;
		}
		let stage = stages.get(option.stage.displayIndex);
		if (!stage) {
			stage = {
				id: `effective-stage-${option.stage.displayIndex}`,
				parentId: null,
				index: option.stage.displayIndex,
				type: "STAGE",
				description: option.stage.description,
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: null,
				plannedStart: null,
				plannedEnd: null,
				completionPercentage: null,
				sortOrder: roots.length,
				children: [],
			};
			stages.set(option.stage.displayIndex, stage);
			roots.push(stage);
		}
		item.sortOrder = stage.children.length;
		stage.children.push(item);
	}
	return roots;
}

export function isLeafBudgetItem(item: BudgetTreeItem): boolean {
	return item.children.length === 0;
}

export function flattenBudgetSelectorItems(
	items: BudgetTreeItem[],
	depth = 0,
	parentIds: string[] = [],
): FlatBudgetNode[] {
	return items.flatMap((item) => [
		{ ...item, depth, leaf: isLeafBudgetItem(item), parentIds },
		...flattenBudgetSelectorItems(item.children, depth + 1, [
			...parentIds,
			item.id,
		]),
	]);
}

export function filterBudgetSelectorItems(
	items: BudgetTreeItem[],
	query: string,
	depth = 0,
	parentIds: string[] = [],
): FlatBudgetNode[] {
	return items.flatMap((item) => {
		const matches = `${item.index} ${item.description}`
			.toLocaleLowerCase()
			.includes(query);
		if (matches) {
			return [
				{ ...item, depth, leaf: isLeafBudgetItem(item), parentIds },
				...flattenBudgetSelectorItems(item.children, depth + 1, [
					...parentIds,
					item.id,
				]),
			];
		}
		const childRows = filterBudgetSelectorItems(
			item.children,
			query,
			depth + 1,
			[...parentIds, item.id],
		);
		return childRows.length > 0
			? [{ ...item, depth, leaf: false, parentIds }, ...childRows]
			: [];
	});
}

export function toggleBudgetItemSelection(
	current: BudgetItemSelection[],
	item: BudgetTreeItem,
	defaultQuantity: number | null,
): BudgetItemSelection[] {
	if (!isLeafBudgetItem(item)) return current;
	if (current.some((entry) => entry.budgetItemId === item.id)) {
		return current.filter((entry) => entry.budgetItemId !== item.id);
	}
	const quantity =
		defaultQuantity != null && defaultQuantity > 0 ? defaultQuantity : 1;
	return [
		...current,
		{
			budgetItemId: item.id,
			...(item.versionItemId
				? { budgetVersionItemId: item.versionItemId }
				: {}),
			quantity,
		},
	];
}

export function updateSelectionQuantity(
	current: BudgetItemSelection[],
	budgetItemId: string,
	quantity: number,
): BudgetItemSelection[] {
	return current.map((entry) =>
		entry.budgetItemId === budgetItemId ? { ...entry, quantity } : entry,
	);
}

export function updateSelectionUnitPrice(
	current: BudgetItemSelection[],
	budgetItemId: string,
	unitPrice: number,
): BudgetItemSelection[] {
	return current.map((entry) =>
		entry.budgetItemId === budgetItemId ? { ...entry, unitPrice } : entry,
	);
}

export function BudgetItemSelector({
	workId,
	selectedItems,
	onChange,
	budgetItems: injectedItems,
	effectiveBudgetItems,
	disabled,
	availableQuantities,
	showUnitPrice = true,
	editableUnitPrice = true,
	quantityLabel = "Quantidade",
}: BudgetItemSelectorProps) {
	const [search, setSearch] = useState("");
	const [expandedIds, setExpandedIds] = useState<Set<string> | null>(new Set());
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
		enabled: injectedItems === undefined && effectiveBudgetItems === undefined,
	});
	const items =
		injectedItems ?? effectiveItemsToTree(effectiveBudgetItems ?? data) ?? [];
	const selectedIds = new Set(selectedItems.map((entry) => entry.budgetItemId));
	const selectionById = new Map(
		selectedItems.map((entry) => [entry.budgetItemId, entry]),
	);
	const rows = flattenBudgetSelectorItems(items);
	const selectedBranchIds = useMemo(() => {
		const ids = new Set(selectedIds);
		for (const row of rows) {
			if (selectedIds.has(row.id)) {
				for (const parentId of row.parentIds) ids.add(parentId);
			}
		}
		return ids;
	}, [rows, selectedIds]);
	const normalizedSearch = search.trim().toLocaleLowerCase();
	const filteredRows = useMemo(
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
					selectedBranchIds.has(item.id) ||
					expandedIds === null ||
					item.parentIds.every((parentId) => expandedIds.has(parentId)),
			),
		[expandedIds, filteredRows, normalizedSearch, selectedBranchIds],
	);
	const leafCount = rows.filter((item) => item.leaf).length;

	if (
		injectedItems === undefined &&
		effectiveBudgetItems === undefined &&
		(isLoading || error || !data)
	) {
		if (isLoading) return <LoadingSpinner title="Carregando orçamento..." />;
		return <ErrorFeedback onRetry={() => void refetch()} />;
	}
	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-6 text-center">
				<p className="text-sm font-medium">
					Nenhuma etapa ou item disponível no orçamento.
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Adicione itens ao orçamento antes de fazer a seleção.
				</p>
			</div>
		);
	}

	const clearSelection = () => onChange([]);
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
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<p className="text-sm font-semibold">Atividades do orçamento</p>
						<p className="text-xs text-muted-foreground">
							Escolha as atividades que farão parte deste lançamento.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
							{selectedItems.length} de {leafCount} selecionada(s)
						</span>
						{selectedItems.length > 0 && (
							<button
								type="button"
								className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
								onClick={clearSelection}
								disabled={disabled}
							>
								Limpar
							</button>
						)}
					</div>
				</div>
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por código ou descrição..."
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

			<div className="min-w-0 max-h-[55vh] overflow-x-hidden overflow-y-auto sm:max-h-[30rem]">
				<div className="sticky top-0 z-10 hidden grid-cols-[1.5rem_minmax(0,1fr)_6rem_6rem_8rem] gap-3 border-b border-border bg-background/95 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur sm:grid">
					<span />
					<span>Atividade</span>
					<span className="text-right">Total</span>
					<span className="text-right">Disponível</span>
					<span className="text-right">
						{showUnitPrice ? "Unidade / base" : "Unidade"}
					</span>
				</div>
				{visibleRows.length === 0 ? (
					<div className="p-8 text-center text-sm text-muted-foreground">
						Nenhuma atividade encontrada para “{search}”.
					</div>
				) : (
					visibleRows.map((item) => {
						if (!item.leaf) {
							const expanded = expandedIds === null || expandedIds.has(item.id);
							return (
								<button
									type="button"
									key={item.id}
									data-slot="budget-stage"
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
									<span className="text-muted-foreground">{item.index}</span>{" "}
									{item.description}
								</button>
							);
						}
						const selected = selectedIds.has(item.id);
						const selection = selectionById.get(item.id);
						const available = availableQuantities?.[item.id] ?? null;
						const toggle = () => {
							const next = toggleBudgetItemSelection(
								selectedItems,
								item,
								available,
							);
							if (!selected && item.unitCost != null) {
								onChange(
									next.map((entry) =>
										entry.budgetItemId === item.id && entry.unitPrice == null
											? { ...entry, unitPrice: item.unitCost ?? undefined }
											: entry,
									),
								);
							} else onChange(next);
						};
						return (
							<div
								key={item.id}
								data-slot="budget-leaf"
								className={`border-b px-3 py-2 transition-colors last:border-b-0 border-border ${selected ? "bg-primary/[0.045]" : "hover:bg-muted/20"}`}
								style={{ paddingLeft: `${12 + item.depth * 20}px` }}
							>
								<div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_6rem_6rem_8rem]">
									<Checkbox
										checked={selected}
										disabled={disabled}
										onCheckedChange={toggle}
										aria-label={`Selecionar ${item.index} - ${item.description}`}
									/>
									<button
										type="button"
										className="min-w-0 text-left"
										onClick={toggle}
										disabled={disabled}
									>
										<span className="block truncate text-sm font-medium">
											<span className="mr-1.5 font-mono text-xs text-muted-foreground">
												{item.index}
											</span>
											{item.description}
										</span>
										<span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
											{item.unit ?? "Sem unidade"} · Total:{" "}
											{item.quantity == null
												? "-"
												: formatQuantity(item.quantity)}{" "}
											· Disponível:{" "}
											{available == null ? "-" : formatQuantity(available)}
										</span>
									</button>
									<span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
										{item.quantity == null
											? "-"
											: formatQuantity(item.quantity)}
									</span>
									<span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
										{available == null ? "-" : formatQuantity(available)}
									</span>
									<span className="hidden text-right text-xs text-muted-foreground sm:block">
										<span className="block">{item.unit ?? "-"}</span>
										{showUnitPrice && (
											<span>
												{item.unitCost == null
													? "-"
													: formatCurrency(item.unitCost)}
											</span>
										)}
									</span>
								</div>

								{selected && (
									<div className="mt-2 grid min-w-0 items-end gap-2 rounded-lg border border-primary/20 bg-background/80 p-2 sm:ml-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
										<label
											htmlFor={`quantity-${item.id}`}
											className="space-y-1 text-xs font-medium text-muted-foreground"
										>
											<span>{quantityLabel}</span>
											<Input
												data-slot="budget-quantity"
												id={`quantity-${item.id}`}
												className="h-9 bg-background text-sm"
												type="number"
												min="0"
												step="any"
												value={selection?.quantity ?? 1}
												disabled={disabled}
												onChange={(event) =>
													onChange(
														updateSelectionQuantity(
															selectedItems,
															item.id,
															Number(event.target.value),
														),
													)
												}
												aria-label={`${quantityLabel} de ${item.description}`}
											/>
										</label>
										{showUnitPrice && editableUnitPrice && (
											<label
												htmlFor={`unit-price-${item.id}`}
												className="space-y-1 text-xs font-medium text-muted-foreground"
											>
												<span>Valor unitário</span>
												<Input
													data-slot="budget-unit-price"
													id={`unit-price-${item.id}`}
													className="h-9 bg-background text-sm"
													type="number"
													min="0"
													step="0.01"
													value={selection?.unitPrice ?? item.unitCost ?? ""}
													disabled={disabled}
													onChange={(event) =>
														onChange(
															updateSelectionUnitPrice(
																selectedItems,
																item.id,
																Number(event.target.value),
															),
														)
													}
													aria-label={`Valor unitário de ${item.description}`}
												/>
											</label>
										)}
										{showUnitPrice && (
											<div className="rounded-md bg-muted/50 px-3 py-2 text-right">
												<span className="block text-xs font-medium text-muted-foreground">
													Total estimado
												</span>
												<strong className="block text-sm tabular-nums text-foreground">
													{formatCurrency(
														(selection?.quantity ?? 0) *
															(selection?.unitPrice ?? item.unitCost ?? 0),
													)}
												</strong>
											</div>
										)}
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
