import { useQuery } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { getCurrentCostBudgetItems } from "@/api/budget";
import { workKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BudgetTreeItem } from "@/types/budget";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import { formatCurrency, formatQuantity } from "@/utils/format";

export type BudgetItemSelection = {
	budgetItemId: string;
	budgetVersionItemId?: string;
	quantity: number;
	percentage?: number;
	unitPrice?: number;
};

export type FlatBudgetNode = BudgetTreeItem & {
	depth: number;
	leaf: boolean;
	parentIds: string[];
};

export type BudgetItemSelectorFilter = {
	id: string;
	label: string;
	predicate: (item: FlatBudgetNode) => boolean;
};

export type BudgetItemSelectorItemContext = {
	item: FlatBudgetNode;
	selected: boolean;
	disabled: boolean;
	selection?: BudgetItemSelection;
	availableQuantity: number | null;
	toggle: () => void;
};

export type BudgetItemSelectorColumn = {
	key: string;
	label: string;
	headerClassName?: string;
	cellClassName?: string;
	render: (context: BudgetItemSelectorItemContext) => ReactNode;
};

export interface BudgetItemSelectorProps {
	workId?: string;
	selectedItems: BudgetItemSelection[];
	onChange: (items: BudgetItemSelection[]) => void;
	budgetItems?: BudgetTreeItem[];
	effectiveBudgetItems?: CostBudgetItemSelectorResponse;
	disabled?: boolean;
	disabledItemIds?: ReadonlySet<string>;
	availableQuantities?: Record<string, number>;
	selectionMode?: "multiple" | "single" | "browse";
	columns?: BudgetItemSelectorColumn[];
	columnsGridClassName?: string;
	itemSearchText?: (item: BudgetTreeItem) => string;
	filters?: BudgetItemSelectorFilter[];
	showQuantity?: boolean;
	showUnitPrice?: boolean;
	editableUnitPrice?: boolean;
	quantityLabel?: string;
	showMeasurementPercentage?: boolean;
	percentageLabel?: string;
	title?: string;
	description?: string;
	hideTitle?: boolean;
	className?: string;
	emptyMessage?: string;
	onItemClick?: (item: FlatBudgetNode) => void;
	renderItem?: (context: BudgetItemSelectorItemContext) => ReactNode;
	renderSelectedItemDetails?: (
		context: BudgetItemSelectorItemContext & { selectionIndex: number },
	) => ReactNode;
	renderFooter?: (context: {
		filteredItems: FlatBudgetNode[];
		allItems: FlatBudgetNode[];
	}) => ReactNode;
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
		item.parentId = stage.id;
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
	itemSearchText?: (item: BudgetTreeItem) => string,
): FlatBudgetNode[] {
	return items.flatMap((item) => {
		const matches = (
			itemSearchText?.(item) ?? `${item.index} ${item.description}`
		)
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
			itemSearchText,
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

export function updateSelectionPercentage(
	current: BudgetItemSelection[],
	budgetItemId: string,
	percentage: number,
): BudgetItemSelection[] {
	return current.map((entry) =>
		entry.budgetItemId === budgetItemId ? { ...entry, percentage } : entry,
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
	disabledItemIds,
	availableQuantities,
	selectionMode = "multiple",
	columns = [],
	columnsGridClassName = "grid-cols-[1.5rem_minmax(0,1fr)_6rem_6rem_8rem]",
	itemSearchText,
	filters = [],
	showQuantity = true,
	showUnitPrice = true,
	editableUnitPrice = true,
	quantityLabel = "Quantidade",
	showMeasurementPercentage = false,
	percentageLabel = "% medido",
	title = "Atividades do orçamento",
	description = "Escolha as atividades que farão parte deste lançamento.",
	hideTitle = false,
	className,
	emptyMessage = "Nenhuma etapa ou item disponível no orçamento.",
	onItemClick,
	renderItem,
	renderSelectedItemDetails,
	renderFooter,
}: BudgetItemSelectorProps) {
	const [search, setSearch] = useState("");
	const [activeFilterIds, setActiveFilterIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [expandedIds, setExpandedIds] = useState<Set<string> | null>(new Set());
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: workKeys.costBudgetItems(workId ?? ""),
		queryFn: () => getCurrentCostBudgetItems(workId ?? ""),
		enabled:
			Boolean(workId) &&
			injectedItems === undefined &&
			effectiveBudgetItems === undefined,
	});
	const items =
		injectedItems ?? effectiveItemsToTree(effectiveBudgetItems ?? data) ?? [];
	const selectedIds = useMemo(
		() => new Set(selectedItems.map((entry) => entry.budgetItemId)),
		[selectedItems],
	);
	const selectionById = useMemo(
		() => new Map(selectedItems.map((entry) => [entry.budgetItemId, entry])),
		[selectedItems],
	);
	const rows = useMemo(() => flattenBudgetSelectorItems(items), [items]);
	const selectedBranchIds = useMemo(() => {
		const ids = new Set(selectedIds);
		for (const row of rows) {
			if (selectedIds.has(row.id)) {
				for (const parentId of row.parentIds) ids.add(parentId);
			}
		}
		return ids;
	}, [rows, selectedIds]);
	const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
	const filteredRows = useMemo(() => {
		const searchRows = normalizedSearch
			? filterBudgetSelectorItems(
					items,
					normalizedSearch,
					0,
					[],
					itemSearchText,
				)
			: rows;
		const activeFilters = filters.filter((filter) =>
			activeFilterIds.has(filter.id),
		);
		if (activeFilters.length === 0) return searchRows;
		const matchingIds = new Set(
			searchRows
				.filter(
					(row) =>
						row.leaf && activeFilters.every((filter) => filter.predicate(row)),
				)
				.flatMap((row) => [row.id, ...row.parentIds]),
		);
		return searchRows.filter((row) => matchingIds.has(row.id));
	}, [activeFilterIds, filters, itemSearchText, items, normalizedSearch, rows]);
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
	const filteredLeafRows = filteredRows.filter((item) => item.leaf);
	const nonLeafIds = useMemo(
		() => rows.filter((row) => !row.leaf).map((row) => row.id),
		[rows],
	);

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
			<div className="rounded-xl border border-dashed border-border p-6 text-center">
				<p className="text-sm font-medium">{emptyMessage}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Adicione itens ao orçamento antes de continuar.
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
	const expandAll = () => setExpandedIds(null);
	const collapseAll = () => setExpandedIds(new Set());

	return (
		<div
			className={cn(
				"min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm",
				className,
			)}
		>
			<div className="space-y-3 border-b border-border bg-muted/20 p-3">
				<div
					className={cn(
						"flex flex-wrap items-start justify-between gap-3",
						hideTitle && "justify-end",
					)}
				>
					{!hideTitle && (
						<div className="min-w-0">
							<p className="text-sm font-semibold">{title}</p>
							<p className="text-xs text-muted-foreground">{description}</p>
						</div>
					)}
					<div className="flex flex-wrap items-center justify-end gap-2">
						{selectionMode !== "browse" && (
							<span className="rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
								{selectedItems.length} de {leafCount} selecionada(s)
							</span>
						)}
						<button
							type="button"
							className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
							onClick={expandAll}
							disabled={disabled || nonLeafIds.length === 0}
							title="Abrir todas as etapas"
						>
							<ChevronsDownUp className="size-4" />
							<span className="hidden sm:inline">Abrir tudo</span>
						</button>
						<button
							type="button"
							className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
							onClick={collapseAll}
							disabled={disabled || nonLeafIds.length === 0}
							title="Recolher todas as etapas"
						>
							<ChevronsUpDown className="size-4" />
							<span className="hidden sm:inline">Recolher tudo</span>
						</button>
						{selectedItems.length > 0 && selectionMode !== "browse" && (
							<button
								type="button"
								className="min-h-9 rounded-xl px-2.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
								onClick={clearSelection}
								disabled={disabled}
							>
								Limpar seleção
							</button>
						)}
					</div>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por código ou descrição..."
						className="h-10 rounded-xl bg-background pl-9 pr-9 text-sm"
						disabled={disabled}
						aria-label="Buscar itens do orçamento"
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
				{filters.length > 0 && (
					<fieldset
						className="flex flex-wrap items-center gap-2"
						aria-label="Filtros"
					>
						<span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<SlidersHorizontal className="size-3.5" /> Filtros
						</span>
						{filters.map((filter) => {
							const active = activeFilterIds.has(filter.id);
							return (
								<button
									key={filter.id}
									type="button"
									className={cn(
										"min-h-8 rounded-xl border px-2.5 text-xs font-semibold transition-colors",
										active
											? "border-primary/30 bg-primary/10 text-primary"
											: "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
									onClick={() =>
										setActiveFilterIds((current) => {
											const next = new Set(current);
											if (active) next.delete(filter.id);
											else next.add(filter.id);
											return next;
										})
									}
									aria-pressed={active}
								>
									{filter.label}
								</button>
							);
						})}
					</fieldset>
				)}
			</div>

			<div className="min-w-0 max-h-[55vh] overflow-x-hidden overflow-y-auto sm:max-h-[34rem]">
				<div
					className={cn(
						"sticky top-0 z-10 hidden gap-3 border-b border-border bg-background/95 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur sm:grid",
						columnsGridClassName,
					)}
				>
					<span />
					<span>{columns.length > 0 ? "Item" : "Atividade"}</span>
					{columns.length > 0
						? columns.map((column) => (
								<span key={column.key} className={column.headerClassName}>
									{column.label}
								</span>
							))
						: [
								<span key="total" className="text-right">
									Total
								</span>,
								<span key="available" className="text-right">
									Disponível
								</span>,
								<span key="unit" className="text-right">
									{showUnitPrice ? "Unidade / base" : "Unidade"}
								</span>,
							]}
				</div>
				{visibleRows.length === 0 ? (
					<div className="p-8 text-center text-sm text-muted-foreground">
						Nenhum item encontrado
						{search ? ` para “${search}”` : " com estes filtros"}.
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
									aria-expanded={expanded}
								>
									{expanded ? (
										<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
									) : (
										<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
									)}
									<span className="text-muted-foreground">{item.index}</span>
									<span className="truncate">{item.description}</span>
								</button>
							);
						}
						const selected = selectedIds.has(item.id);
						const itemDisabled =
							disabled || disabledItemIds?.has(item.id) === true;
						const selection = selectionById.get(item.id);
						const available = availableQuantities?.[item.id] ?? null;
						const maxQuantity = available ?? item.quantity ?? undefined;
						const maxPercentage =
							available != null && item.quantity && item.quantity > 0
								? Math.min(100, (available / item.quantity) * 100)
								: 100;
						const toggle = () => {
							if (itemDisabled || selectionMode === "browse") return;
							const next = toggleBudgetItemSelection(
								selectionMode === "single" ? [] : selectedItems,
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
						const context: BudgetItemSelectorItemContext = {
							item,
							selected,
							disabled: itemDisabled,
							selection,
							availableQuantity: available,
							toggle,
						};
						const handleItemClick = () => {
							onItemClick?.(item);
							if (!onItemClick || !selected) toggle();
						};
						if (renderItem) {
							return (
								<div key={item.id} data-slot="budget-leaf">
									{renderItem(context)}
								</div>
							);
						}
						return (
							<div
								key={item.id}
								data-slot="budget-leaf"
								className={cn(
									"border-b border-border px-3 py-2 transition-colors last:border-b-0",
									selected ? "bg-primary/[0.045]" : "hover:bg-muted/20",
								)}
								style={{ paddingLeft: `${12 + item.depth * 20}px` }}
							>
								<div
									className={cn(
										"grid items-center gap-3",
										columns.length > 0
											? columnsGridClassName
											: "grid-cols-[1.5rem_minmax(0,1fr)] sm:grid-cols-[1.5rem_minmax(0,1fr)_6rem_6rem_8rem]",
									)}
								>
									{selectionMode === "browse" ? (
										<span />
									) : (
										<Checkbox
											checked={selected}
											disabled={itemDisabled}
											onCheckedChange={handleItemClick}
											aria-label={`Selecionar ${item.index} - ${item.description}`}
										/>
									)}
									<button
										type="button"
										className="min-w-0 text-left"
										onClick={handleItemClick}
										disabled={itemDisabled || selectionMode === "browse"}
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
									{columns.length > 0 ? (
										columns.map((column) => (
											<span key={column.key} className={column.cellClassName}>
												{column.render(context)}
											</span>
										))
									) : (
										<>
											<span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
												{showQuantity && item.quantity != null
													? formatQuantity(item.quantity)
													: "-"}
											</span>
											<span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
												{showQuantity && available != null
													? formatQuantity(available)
													: "-"}
											</span>
											<span className="hidden text-right text-xs text-muted-foreground sm:block">
												<span className="block">{item.unit ?? "-"}</span>
												{showUnitPrice &&
													(item.unitCost == null
														? "-"
														: formatCurrency(item.unitCost))}
											</span>
										</>
									)}
								</div>
								{selected && selectionMode !== "browse" && (
									<div className="mt-2 grid min-w-0 items-end gap-2 rounded-xl border border-primary/20 bg-background/80 p-2 sm:ml-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
										{showQuantity && (
											<label
												htmlFor={`quantity-${item.id}`}
												className="space-y-1 text-xs font-medium text-muted-foreground"
											>
												<span>{quantityLabel}</span>
												<Input
													data-slot="budget-quantity"
													id={`quantity-${item.id}`}
													className="h-10 rounded-xl bg-background text-sm"
													type="number"
													min="0"
													max={maxQuantity}
													step="any"
													value={selection?.quantity ?? 1}
													disabled={itemDisabled}
													onChange={(event) => {
														const quantity = Math.min(
															maxQuantity ?? Number.POSITIVE_INFINITY,
															Math.max(0, Number(event.target.value)),
														);
														let next = updateSelectionQuantity(
															selectedItems,
															item.id,
															quantity,
														);
														if (
															showMeasurementPercentage &&
															(item.quantity ?? 0) > 0
														)
															next = updateSelectionPercentage(
																next,
																item.id,
																(quantity / (item.quantity ?? 1)) * 100,
															);
														onChange(next);
													}}
													aria-label={`${quantityLabel} de ${item.description}`}
												/>
											</label>
										)}
										{showMeasurementPercentage && (
											<label
												htmlFor={`measurement-percentage-${item.id}`}
												className="space-y-1 text-xs font-medium text-muted-foreground"
											>
												<span>{percentageLabel}</span>
												<Input
													data-slot="budget-measurement-percentage"
													id={`measurement-percentage-${item.id}`}
													className="h-10 rounded-xl bg-background text-sm"
													type="number"
													min="0"
													max={maxPercentage}
													step="0.01"
													value={
														selection?.percentage ??
														(item.quantity && item.quantity > 0
															? ((selection?.quantity ?? 0) / item.quantity) *
																100
															: "")
													}
													disabled={itemDisabled}
													onChange={(event) => {
														const percentage = Math.min(
															maxPercentage,
															Math.max(0, Number(event.target.value)),
														);
														const next = updateSelectionPercentage(
															selectedItems,
															item.id,
															percentage,
														);
														onChange(
															item.quantity && item.quantity > 0
																? updateSelectionQuantity(
																		next,
																		item.id,
																		(item.quantity * percentage) / 100,
																	)
																: next,
														);
													}}
													aria-label={`${percentageLabel} de ${item.description}`}
												/>
											</label>
										)}
										{showUnitPrice && editableUnitPrice && (
											<label
												htmlFor={`unit-price-${item.id}`}
												className="space-y-1 text-xs font-medium text-muted-foreground"
											>
												<span>Valor unitário</span>
												<Input
													data-slot="budget-unit-price"
													id={`unit-price-${item.id}`}
													className="h-10 rounded-xl bg-background text-sm"
													type="number"
													min="0"
													step="0.01"
													value={selection?.unitPrice ?? item.unitCost ?? ""}
													disabled={itemDisabled}
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
											<div className="rounded-xl bg-muted/50 px-3 py-2 text-right">
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
										{renderSelectedItemDetails && (
											<div className="sm:col-span-2 lg:col-span-4">
												{renderSelectedItemDetails({
													...context,
													selectionIndex: selectedItems.findIndex(
														(entry) => entry.budgetItemId === item.id,
													),
												})}
											</div>
										)}
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
			{renderFooter?.({
				filteredItems: filteredLeafRows,
				allItems: rows.filter((item) => item.leaf),
			})}
		</div>
	);
}
