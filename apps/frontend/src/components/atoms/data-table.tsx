import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ChevronDown,
	ChevronRight,
	ChevronsUpDown,
	ChevronUp,
	MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { SearchInput } from "@/components/atoms/search-input";
import { DropDownMenu } from "@/components/molecules/DropdownMenu/DropDownMenu";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataTableMobile } from "./data-table-mobile";

const TABLE_SKELETON_ROWS = [
	"table-skeleton-a",
	"table-skeleton-b",
	"table-skeleton-c",
	"table-skeleton-d",
	"table-skeleton-e",
];

export type RowActionItem = {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	variant?: "default" | "destructive" | "alert" | "positive";
};

interface DataTableProps<TData> {
	columns: ColumnDef<TData, unknown>[];
	data: TData[];
	searchPlaceholder?: string;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	pageSize?: number;
	onRowClick?: (row: TData) => void;
	getSubRows?: (row: TData) => TData[] | undefined;
	isLoading?: boolean;
	emptyMessage?: string;
	resultCountLabel?: (filteredCount: number, isSearching: boolean) => string;
	rowActions?: (RowActionItem | false | null | undefined)[];
}

export function DataTable<TData>({
	columns,
	data,
	searchPlaceholder = "Buscar...",
	searchValue,
	onSearchChange,
	pageSize = 10,
	onRowClick,
	getSubRows,
	isLoading,
	emptyMessage = "Nenhum registro encontrado.",
	resultCountLabel,
	rowActions,
}: DataTableProps<TData>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");

	const isSearchControlled =
		searchValue !== undefined && onSearchChange !== undefined;
	const effectiveGlobalFilter = isSearchControlled ? searchValue : globalFilter;

	const handleGlobalFilterChange = (value: string) => {
		if (isSearchControlled) {
			onSearchChange(value);
		} else {
			setGlobalFilter(value);
		}
	};

	const treeColumn: ColumnDef<TData, unknown> | null = getSubRows
		? {
				id: "_tree",
				header: "",
				cell: ({ row }) => (
					<div
						style={{ paddingLeft: `${row.depth * 1.5}rem` }}
						className="flex items-center"
					>
						{row.getCanExpand() ? (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									row.toggleExpanded();
								}}
								className="rounded p-0.5 transition-colors"
							>
								{row.getIsExpanded() ? (
									<ChevronDown className="h-3.5 w-3.5 text-primary" />
								) : (
									<ChevronRight className="h-3.5 w-3.5 text-primary" />
								)}
							</button>
						) : (
							<span className="w-5" />
						)}
					</div>
				),
				enableSorting: false,
				enableHiding: false,
				size: 40,
				meta: { hideOnMobile: true },
			}
		: null;

	const actionsColumn: ColumnDef<TData, unknown> | null =
		rowActions && rowActions.length > 0
			? {
					id: "actions",
					header: "",
					cell: () => (
						<DropDownMenu
							targetMenu={<MoreHorizontal className="h-4 w-4" />}
							menuItems={rowActions}
						/>
					),
					enableSorting: false,
					enableHiding: false,
					size: 48,
					meta: { hideOnMobile: true },
				}
			: null;

	const hasExplicitActions = columns.some((col) => col.id === "actions");
	const effectiveColumns = [
		...(treeColumn ? [treeColumn] : []),
		...(actionsColumn && !hasExplicitActions ? [actionsColumn] : []),
		...columns,
	];

	const table = useReactTable({
		data,
		columns: effectiveColumns,
		getSubRows,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		// Controlled searches are already filtered by the server. Do not apply
		// TanStack's second pass, which can hide matches on non-visible fields
		// such as a contract code.
		globalFilterFn: isSearchControlled ? () => true : undefined,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: handleGlobalFilterChange,
		state: {
			sorting,
			columnFilters,
			globalFilter: effectiveGlobalFilter,
		},
		initialState: {
			pagination: { pageSize },
		},
	});

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					className="sm:max-w-sm"
					placeholder={searchPlaceholder}
					value={effectiveGlobalFilter}
					onChange={handleGlobalFilterChange}
				/>
				<p className="text-xs text-muted-foreground">
					{resultCountLabel?.(
						table.getFilteredRowModel().rows.length,
						effectiveGlobalFilter.trim() !== "",
					) ?? `${table.getFilteredRowModel().rows.length} registro(s)`}
				</p>
			</div>

			<div className="hidden sm:block">
				<div className="max-h-[600px] overflow-auto rounded-md border border-border">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										const isActions = header.id === "actions";
										const sortDir = header.column.getIsSorted();
										const ariaSort =
											sortDir === "asc"
												? "ascending"
												: sortDir === "desc"
													? "descending"
													: undefined;
										return (
											<TableHead
												key={header.id}
												aria-sort={ariaSort}
												className={cn(
													"text-sm font-medium text-muted-foreground",
													header.column.getCanSort()
														? "cursor-pointer select-none"
														: "",
													isActions && "text-right",
												)}
												onClick={header.column.getToggleSortingHandler()}
											>
												<div
													className={cn(
														"flex items-center gap-1",
														isActions && "justify-end",
													)}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{header.column.getCanSort() && (
														<span className="text-muted-foreground">
															{header.column.getIsSorted() === "asc" ? (
																<ChevronUp className="h-3 w-3" />
															) : header.column.getIsSorted() === "desc" ? (
																<ChevronDown className="h-3 w-3" />
															) : (
																<ChevronsUpDown className="h-3 w-3" />
															)}
														</span>
													)}
												</div>
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{isLoading ? (
								TABLE_SKELETON_ROWS.map((rowKey) => (
									<TableRow key={rowKey}>
										<TableCell
											colSpan={effectiveColumns.length}
											className="p-2"
										>
											<Skeleton className="h-8 w-full" />
										</TableCell>
									</TableRow>
								))
							) : table.getRowModel().rows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={effectiveColumns.length}
										className="py-8 text-center text-muted-foreground"
									>
										{emptyMessage}
									</TableCell>
								</TableRow>
							) : (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										className={
											onRowClick ? "cursor-pointer hover:bg-muted/50" : ""
										}
										onClick={
											onRowClick
												? (e) => {
														const target = e.target as HTMLElement;
														if (
															target.closest("button, a, [data-no-row-click]")
														)
															return;
														onRowClick(row.original);
													}
												: undefined
										}
									>
										{row.getVisibleCells().map((cell) => {
											const isActions = cell.column.id === "actions";
											return (
												<TableCell
													key={cell.id}
													className={isActions ? "text-right" : ""}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											);
										})}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			<DataTableMobile
				table={table}
				onRowClick={onRowClick}
				isLoading={isLoading}
			/>

			{table.getPageCount() > 1 && !isLoading && (
				<div className="flex items-center justify-between pt-2">
					<div className="flex items-center gap-2">
						<p className="text-xs text-muted-foreground">
							Página {table.getState().pagination.pageIndex + 1} de{" "}
							{table.getPageCount()}
						</p>
						<Select
							value={String(table.getState().pagination.pageSize)}
							onValueChange={(value) => table.setPageSize(Number(value))}
						>
							<SelectTrigger className="h-8 w-[70px] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{[10, 20, 30, 50, 100].map((size) => (
									<SelectItem
										key={size}
										value={String(size)}
										className="text-xs"
									>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							Anterior
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							Próximo
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
