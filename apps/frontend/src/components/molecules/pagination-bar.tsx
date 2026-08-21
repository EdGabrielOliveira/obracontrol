import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types/shared";

type PaginationBarProps = {
	meta: PaginationMeta;
	onPageChange: (page: number) => void;
};

export function PaginationBar({ meta, onPageChange }: PaginationBarProps) {
	const page = Number.isFinite(meta.page) ? meta.page : 1;
	const totalPages = Number.isFinite(meta.totalPages) ? meta.totalPages : 1;
	const total = Number.isFinite(meta.total) ? meta.total : 0;
	const limit = Number.isFinite(meta.limit) ? meta.limit : 10;
	const hasNextPage = meta.hasNextPage ?? page < totalPages;
	const hasPreviousPage = meta.hasPreviousPage ?? page > 1;

	if (totalPages <= 1) return null;

	const from = (page - 1) * limit + 1;
	const to = Math.min(page * limit, total);

	return (
		<div className="flex items-center justify-between gap-4 px-2 py-3">
			<p className="text-sm text-muted-foreground">
				{from}–{to} de {total}
			</p>
			<div className="flex items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					disabled={!hasPreviousPage}
					onClick={() => onPageChange(page - 1)}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				{getPageNumbers(page, totalPages).map((p) => {
					const key = typeof p === "string" ? p : `page-${p}`;
					return p === "ellipsis-start" || p === "ellipsis-end" ? (
						<span key={key} className="px-1 text-sm text-muted-foreground">
							...
						</span>
					) : (
						<Button
							key={key}
							variant={p === page ? "default" : "outline"}
							size="sm"
							className="min-w-[2rem]"
							onClick={() => onPageChange(p as number)}
						>
							{p}
						</Button>
					);
				})}
				<Button
					variant="outline"
					size="sm"
					disabled={!hasNextPage}
					onClick={() => onPageChange(page + 1)}
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

function getPageNumbers(
	current: number,
	total: number,
): (number | "ellipsis-start" | "ellipsis-end")[] {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}

	const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [1];

	if (current > 3) pages.push("ellipsis-start");

	const start = Math.max(2, current - 1);
	const end = Math.min(total - 1, current + 1);

	for (let i = start; i <= end; i++) {
		pages.push(i);
	}

	if (current < total - 2) pages.push("ellipsis-end");

	pages.push(total);

	return pages;
}
