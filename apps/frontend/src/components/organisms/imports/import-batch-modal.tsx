import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	cancelImportBatch,
	confirmImportBatch,
	getImportBatchPreview,
	getImportBatchRejected,
	getSelectableImportRowIds,
	uploadImportBatch,
} from "@/api/import";
import { importBatchKeys } from "@/api/query-keys";
import { downloadTemplate } from "@/api/templates";
import { FileDropzone } from "@/components/atoms/file-dropzone";
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
import { importConfirmationQueryKeys } from "@/lib/import-invalidation";
import { toPreviewTableRow } from "@/lib/import-preview";
import type {
	ConstructionTemplateKind,
	ImportPreviewRow,
} from "@/types/import";
import { getErrorMessage } from "@/utils/api-error";
import { createIdempotencyKey } from "@/utils/idempotency-key";

const PREVIEW_PAGE_SIZE = 100;

type ImportBatchModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workId: string;
	model: ConstructionTemplateKind;
};

export function ImportBatchModal({
	open,
	onOpenChange,
	workId,
	model,
}: ImportBatchModalProps) {
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [batchId, setBatchId] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
	const [idempotencyKey] = useState(() => createIdempotencyKey("import"));
	const [confirmation, setConfirmation] = useState<{
		status: "APPROVED" | "PENDING";
		importId?: string | null;
	} | null>(null);

	const previewQuery = useQuery({
		queryKey: importBatchKeys.preview(
			workId,
			batchId ?? "",
			page,
			PREVIEW_PAGE_SIZE,
		),
		queryFn: () =>
			getImportBatchPreview(workId, batchId as string, page, PREVIEW_PAGE_SIZE),
		enabled: open && batchId !== null,
	});

	const uploadMutation = useMutation({
		mutationFn: async (selectedFile: File) => {
			const preview = await uploadImportBatch(workId, selectedFile, { model });
			const selectedRowIds = await getSelectableImportRowIds(
				workId,
				preview.batchId,
			);
			return { preview, selectedRowIds };
		},
		onSuccess: ({ preview, selectedRowIds }) => {
			setBatchId(preview.batchId);
			setPage(1);
			setSelectedRowIds(new Set(selectedRowIds));
			toast.success("Planilha analisada: revise o preview antes de confirmar.");
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao analisar a planilha."));
		},
	});

	const confirmMutation = useMutation({
		mutationFn: () =>
			confirmImportBatch(workId, batchId as string, {
				expectedBatchVersion: previewQuery.data?.batchVersion ?? 1,
				selectedRowIds: [...selectedRowIds],
				idempotencyKey,
			}),
		onSuccess: (data) => {
			setConfirmation({ status: data.status, importId: data.importId });
			if (data.status === "APPROVED") {
				toast.success("Importação confirmada com sucesso!");
			} else {
				toast.info("Importação enviada para aprovação.");
			}
			for (const queryKey of importConfirmationQueryKeys(workId)) {
				queryClient.invalidateQueries({ queryKey });
			}
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao confirmar a importação."));
		},
	});

	const rejectedMutation = useMutation({
		mutationFn: () => getImportBatchRejected(workId, batchId as string),
		onSuccess: (blob) => {
			downloadBlob(blob, "linhas-rejeitadas.xlsx");
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao gerar rejeitados."));
		},
	});

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && batchId && !confirmation) {
			cancelImportBatch(workId, batchId).catch(() => undefined);
		}
		onOpenChange(nextOpen);
	};

	useEffect(() => {
		if (!open) {
			setFile(null);
			setBatchId(null);
			setPage(1);
			setSelectedRowIds(new Set());
			setConfirmation(null);
			uploadMutation.reset();
			confirmMutation.reset();
			rejectedMutation.reset();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const rows = previewQuery.data?.rows ?? [];
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

	const toggleRow = (rowId: string, status: string) => {
		if (status === "INVALID") return;
		setSelectedRowIds((current) => {
			const next = new Set(current);
			if (next.has(rowId)) {
				next.delete(rowId);
			} else {
				next.add(rowId);
			}
			return next;
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Importação de planilha</DialogTitle>
					<DialogDescription>
						Envio seguro com preview: nada é aplicado antes da sua confirmação.
					</DialogDescription>
				</DialogHeader>

				{confirmation ? (
					<div className="flex flex-col items-center gap-4 py-6 text-center">
						{confirmation.status === "APPROVED" ? (
							<>
								<CheckCircle2 className="h-12 w-12 text-success" />
								<p className="text-base font-medium">Importação confirmada!</p>
								<p className="text-sm text-muted-foreground">
									Os dados da planilha foram aplicados à obra.
								</p>
							</>
						) : (
							<>
								<Loader2 className="h-12 w-12 animate-spin text-warning" />
								<p className="text-base font-medium">Aguardando aprovação</p>
								<p className="text-sm text-muted-foreground">
									A importação foi enviada para aprovação e será aplicada após a
									decisão.
								</p>
							</>
						)}
					</div>
				) : !batchId ? (
					<div className="space-y-4 py-2">
						<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
							<div>
								<p className="font-medium">
									Modelo: <span className="font-mono text-xs">{model}</span>
								</p>
								<p className="text-xs text-muted-foreground">
									Baixe o modelo guiado com a aba Guia (colunas, tipos e
									exemplos) antes de enviar o arquivo.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									downloadTemplate(model).then((blob) => {
										downloadBlob(blob, `modelo-${model}.xlsx`);
									});
								}}
							>
								<Download className="h-4 w-4" />
								Baixar modelo
							</Button>
						</div>
						<FileDropzone
							onFileSelect={(selectedFile) => {
								setFile(selectedFile);
								uploadMutation.mutate(selectedFile);
							}}
						/>
						{file && (
							<p className="text-sm text-muted-foreground">
								{file.name} — analisando a planilha...
							</p>
						)}
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
							<p className="text-muted-foreground">
								{file?.name ?? "Planilha"} —{" "}
								{summary ? (
									<>
										<span className="font-medium text-foreground">
											{summary.valid}
										</span>{" "}
										válidas,{" "}
										<span className="font-medium text-foreground">
											{summary.invalid}
										</span>{" "}
										inválidas,{" "}
										<span className="font-medium text-foreground">
											{summary.warnings}
										</span>{" "}
										com aviso
									</>
								) : (
									"carregando preview..."
								)}
							</p>
							{summary && summary.invalid > 0 && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => rejectedMutation.mutate()}
									disabled={rejectedMutation.isPending}
								>
									<Download className="h-4 w-4" />
									Baixar rejeitadas
								</Button>
							)}
						</div>

						{previewQuery.isLoading ? (
							<p className="py-6 text-center text-sm text-muted-foreground">
								Carregando preview...
							</p>
						) : (
							<PreviewTable
								rows={rows}
								selectedRowIds={selectedRowIds}
								onToggleRow={toggleRow}
							/>
						)}

						<PaginationBar meta={paginationMeta} onPageChange={setPage} />
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						{confirmation ? "Fechar" : "Cancelar"}
					</Button>
					{!confirmation && batchId && (
						<Button
							onClick={() => confirmMutation.mutate()}
							disabled={
								confirmMutation.isPending ||
								selectedRowIds.size === 0 ||
								previewQuery.isLoading
							}
						>
							{confirmMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<CheckCircle2 className="h-4 w-4" />
							)}
							Confirmar importação ({selectedRowIds.size})
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function PreviewTable({
	rows,
	selectedRowIds,
	onToggleRow,
}: {
	rows: ImportPreviewRow[];
	selectedRowIds: Set<string>;
	onToggleRow: (rowId: string, status: string) => void;
}) {
	if (rows.length === 0) {
		return (
			<p className="py-6 text-center text-sm text-muted-foreground">
				Nenhuma linha nesta página.
			</p>
		);
	}
	return (
		<div className="max-h-80 overflow-auto rounded-lg border">
			<table className="w-full text-left text-sm">
				<thead className="sticky top-0 bg-muted">
					<tr>
						<th className="px-3 py-2 font-medium">Sel.</th>
						<th className="px-3 py-2 font-medium">Aba</th>
						<th className="px-3 py-2 font-medium">Linha</th>
						<th className="px-3 py-2 font-medium">Coluna</th>
						<th className="px-3 py-2 font-medium">Valor original</th>
						<th className="px-3 py-2 font-medium">Valor normalizado</th>
						<th className="px-3 py-2 font-medium">Status</th>
						<th className="px-3 py-2 font-medium">Código</th>
						<th className="px-3 py-2 font-medium">Mensagem</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{rows.map((row) => {
						const preview = toPreviewTableRow(row);
						const invalid = row.status === "INVALID";
						return (
							<tr
								key={row.id}
								className={invalid ? "bg-destructive/5" : undefined}
							>
								<td className="px-3 py-2">
									{invalid ? (
										<XCircle className="h-4 w-4 text-destructive" />
									) : (
										<input
											type="checkbox"
											checked={selectedRowIds.has(row.id)}
											onChange={() => onToggleRow(row.id, row.status)}
										/>
									)}
								</td>
								<td className="px-3 py-2">{preview.sheet}</td>
								<td className="px-3 py-2">{preview.rowNumber}</td>
								<td className="px-3 py-2 text-muted-foreground">
									{preview.column || "—"}
								</td>
								<td className="max-w-[12rem] truncate px-3 py-2">
									{preview.originalValue}
								</td>
								<td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">
									{preview.normalizedValue || "—"}
								</td>
								<td className="px-3 py-2">
									<span
										className={
											invalid
												? "text-destructive"
												: row.status === "WARNING"
													? "text-warning"
													: "text-success"
										}
									>
										{preview.status}
									</span>
								</td>
								<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
									{preview.code}
								</td>
								<td className="max-w-[14rem] truncate px-3 py-2 text-muted-foreground">
									{preview.message || "—"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
