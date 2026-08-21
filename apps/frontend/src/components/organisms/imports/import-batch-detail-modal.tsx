import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getImportBatchPreview, getImportBatchRejected } from "@/api/import";
import { importBatchKeys } from "@/api/query-keys";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download";
import type { ImportBatchRecord } from "@/types/import";
import { getErrorMessage } from "@/utils/api-error";
import { PreviewTable } from "./import-batch-modal";

const PREVIEW_PAGE_SIZE = 100;

type ImportBatchDetailModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workId: string;
	batch: ImportBatchRecord | null;
};

export function ImportBatchDetailModal({
	open,
	onOpenChange,
	workId,
	batch,
}: ImportBatchDetailModalProps) {
	const [page, setPage] = useState(1);

	useEffect(() => {
		if (!open) setPage(1);
	}, [open]);

	const previewQuery = useQuery({
		queryKey: importBatchKeys.preview(
			workId,
			batch?.id ?? "",
			page,
			PREVIEW_PAGE_SIZE,
		),
		queryFn: () =>
			getImportBatchPreview(
				workId,
				batch?.id as string,
				page,
				PREVIEW_PAGE_SIZE,
			),
		enabled: open && batch !== null,
	});

	const rejectedMutation = useMutation({
		mutationFn: () => getImportBatchRejected(workId, batch?.id as string),
		onSuccess: (blob) => {
			downloadBlob(blob, `rejeitadas-${batch?.fileName ?? "importacao"}.xlsx`);
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao gerar rejeitados."));
		},
	});

	const summary = previewQuery.data?.summary;
	const paginationMeta = useMemo(() => {
		const total = summary?.total ?? 0;
		const totalPages = Math.max(1, Math.ceil(total / PREVIEW_PAGE_SIZE));
		return {
			page,
			limit: PREVIEW_PAGE_SIZE,
			total,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		};
	}, [page, summary]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{batch?.fileName ?? "Importação"}</DialogTitle>
					<DialogDescription>
						Status:{" "}
						<span className="font-medium text-foreground">
							{batch?.status ?? "—"}
						</span>
						{batch?.confirmedAt
							? ` · confirmada em ${new Date(batch.confirmedAt).toLocaleString()}`
							: ""}
						{summary
							? ` · ${summary.valid} válidas, ${summary.invalid} inválidas, ${summary.warnings} avisos`
							: ""}
					</DialogDescription>
				</DialogHeader>

				{previewQuery.isLoading ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						Carregando preview...
					</p>
				) : (
					<PreviewTable
						rows={previewQuery.data?.rows ?? []}
						selectedRowIds={new Set()}
						onToggleRow={() => undefined}
					/>
				)}

				<PaginationBar meta={paginationMeta} onPageChange={setPage} />

				<DialogFooter>
					{previewQuery.data?.summary.invalid ? (
						<Button
							variant="outline"
							onClick={() => rejectedMutation.mutate()}
							disabled={rejectedMutation.isPending}
						>
							{rejectedMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Download className="h-4 w-4" />
							)}
							Baixar rejeitadas
						</Button>
					) : null}
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Fechar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
