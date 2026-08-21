import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";

const MOBILE_SKELETON_ROWS = [
	"mobile-skeleton-a",
	"mobile-skeleton-b",
	"mobile-skeleton-c",
];
const MOBILE_SKELETON_CELLS = ["cell-a", "cell-b", "cell-c", "cell-d"];

interface DataTableMobileProps<TData> {
	table: ReactTable<TData>;
	onRowClick?: (row: TData) => void;
	isLoading?: boolean;
}

export function DataTableMobile<TData>({
	table,
	onRowClick,
	isLoading,
}: DataTableMobileProps<TData>) {
	const columnCount = table.getAllColumns().length;

	if (isLoading) {
		return (
			<div className="sm:hidden space-y-2">
				{MOBILE_SKELETON_ROWS.map((rowKey) => (
					<div
						key={rowKey}
						className="rounded-xl border border-border bg-card p-3 space-y-2"
					>
						{MOBILE_SKELETON_CELLS.slice(0, Math.min(columnCount, 4)).map(
							(cellKey) => (
								<Skeleton key={cellKey} className="h-4 w-full" />
							),
						)}
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="sm:hidden space-y-2">
			{table.getRowModel().rows.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					Nenhum registro encontrado.
				</p>
			) : (
				table.getRowModel().rows.map((row) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: interactive card with role button when clickable
					<div
						key={row.id}
						role={onRowClick ? "button" : undefined}
						tabIndex={onRowClick ? 0 : undefined}
						className={`rounded-xl border border-border bg-card p-3 ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
						onClick={
							onRowClick
								? (e) => {
										const target = e.target as HTMLElement;
										if (target.closest("button, a, [data-no-row-click]"))
											return;
										onRowClick(row.original);
									}
								: undefined
						}
						onKeyDown={
							onRowClick
								? (e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											const target = e.target as HTMLElement;
											if (target.closest("button, a, [data-no-row-click]"))
												return;
											onRowClick(row.original);
										}
									}
								: undefined
						}
					>
						{row.getVisibleCells().map((cell) => {
							const meta = cell.column.columnDef.meta as
								| { mobileLabel?: string; hideOnMobile?: boolean }
								| undefined;
							if (meta?.hideOnMobile) return null;
							return (
								<div
									key={cell.id}
									className="flex items-center justify-between py-0.5 text-xs"
								>
									{meta?.mobileLabel && (
										<span className="text-muted-foreground">
											{meta.mobileLabel}
										</span>
									)}
									<span className="font-medium text-foreground">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</span>
								</div>
							);
						})}
					</div>
				))
			)}
		</div>
	);
}
