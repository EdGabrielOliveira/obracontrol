import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getImportBatchPreview, getImportBatchRejected } from "@/api/import";
import { importBatchKeys } from "@/api/query-keys";
import {
	IMPORT_BATCH_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
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
import { ImportStats, PreviewTable } from "./import-batch-modal";

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
			<DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
				<div className="border-b border-border bg-muted/20 px-6 pb-5 pt-6">
					<DialogHeader>
						<div className="flex items-start gap-3 pr-8">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<FileSpreadsheet className="size-5" aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<DialogTitle className="truncate text-lg font-semibold tracking-tight">
									{batch?.title || batch?.fileName || "Importação"}
								</DialogTitle>
								<DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
									{batch?.title && batch.fileName ? (
										<span>{batch.fileName}</span>
									) : null}
									<StatusBadge
										status={batch?.status}
										map={IMPORT_BATCH_STATUS_MAP}
									/>
									{batch?.confirmedAt ? (
										<span>
											Confirmada em{" "}
											{new Date(batch.confirmedAt).toLocaleString("pt-BR")}
										</span>
									) : null}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>
				</div>

				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
					{summary && (
						<ImportStats summary={summary} impact={previewQuery.data?.impact} />
					)}
					{previewQuery.isLoading ? (
						<div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 py-12 text-sm text-muted-foreground">
							<Loader2
								className="size-4 animate-spin text-primary"
								aria-hidden="true"
							/>
							Carregando preview...
						</div>
					) : previewQuery.isError ? (
						<div
							className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm"
							role="alert"
						>
							<AlertCircle
								className="mt-0.5 size-5 shrink-0 text-destructive"
								aria-hidden="true"
							/>
							<div>
								<p className="font-semibold text-foreground">
									Não foi possível carregar o preview
								</p>
								<p className="mt-1 text-muted-foreground">
									{getErrorMessage(
										previewQuery.error,
										"Tente novamente em instantes.",
									)}
								</p>
							</div>
						</div>
					) : (
						<PreviewTable
							rows={previewQuery.data?.rows ?? []}
							selectedRowIds={new Set()}
							onToggleRow={() => undefined}
						/>
					)}

					<PaginationBar meta={paginationMeta} onPageChange={setPage} />
				</div>

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
