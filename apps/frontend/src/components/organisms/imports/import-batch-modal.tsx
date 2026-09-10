import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	Info,
	Loader2,
	Rows3,
	ShieldCheck,
	UploadCloud,
	XCircle,
} from "lucide-react";
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
import {
	IMPORT_PREVIEW_STATUS_MAP,
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
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/download";
import { importConfirmationQueryKeys } from "@/lib/import-invalidation";
import {
	previewFieldKeys,
	previewFieldLabel,
	previewFieldValue,
	previewIssueLabel,
} from "@/lib/import-preview";
import type {
	ConstructionTemplateKind,
	ImportPreviewPage,
	ImportPreviewRow,
} from "@/types/import";
import {
	getApiErrorCode,
	getErrorMessage,
	normalizePortugueseText,
} from "@/utils/api-error";
import { createIdempotencyKey } from "@/utils/idempotency-key";

const PREVIEW_PAGE_SIZE = 100;

const IMPORT_MODEL_DETAILS: Record<
	ConstructionTemplateKind,
	{ label: string; description: string; hint: string }
> = {
	custos: {
		label: "Custos realizados",
		description: "Registre despesas, pagamentos e apropriações desta obra.",
		hint: "Lançamentos financeiros e documentos de origem",
	},
	"medicao-obra": {
		label: "Medições da obra",
		description: "Atualize o avanço físico dos itens do orçamento.",
		hint: "Quantidades e percentuais medidos",
	},
	"medicao-contrato": {
		label: "Medições de contrato",
		description: "Importe medições vinculadas aos serviços contratados.",
		hint: "Serviços, quantidades e valores medidos",
	},
	orcamento: {
		label: "Orçamento",
		description: "Crie uma nova versão de orçamento a partir da planilha.",
		hint: "Composição, unidades, quantidades e custos",
	},
	"orcamento-aditivo": {
		label: "Aditivo de orçamento",
		description: "Adicione itens ou ajustes a uma versão de orçamento.",
		hint: "Itens, quantidades e impacto financeiro",
	},
	cronograma: {
		label: "Cronograma",
		description: "Planeje ou replaneje as atividades da obra.",
		hint: "Atividades, datas e pesos planejados",
	},
	cotacao: {
		label: "Mapa de cotação",
		description: "Compare propostas de fornecedores com os dados da planilha.",
		hint: "Fornecedores, preços e condições comerciais",
	},
};

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
	const isCostImport = model === "custos";
	const modelDetails = IMPORT_MODEL_DETAILS[model];
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [title, setTitle] = useState("");
	const [batchId, setBatchId] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [downloadingTemplate, setDownloadingTemplate] = useState(false);
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

	const returnToUpload = () => {
		const staleBatchId = batchId;
		if (staleBatchId) {
			queryClient.removeQueries({
				queryKey: ["import-batches", "preview", workId, staleBatchId],
			});
			void cancelImportBatch(workId, staleBatchId).catch(() => undefined);
		}
		setBatchId(null);
		setFile(null);
		setPage(1);
		setSelectedRowIds(new Set());
	};

	const uploadMutation = useMutation({
		mutationFn: async (selectedFile: File) => {
			const preview = await uploadImportBatch(workId, selectedFile, {
				model,
				...(isCostImport ? { title: title.trim() } : {}),
			});
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
			const status = axios.isAxiosError(error)
				? error.response?.status
				: undefined;
			const code = getApiErrorCode(error);
			const message = getErrorMessage(error, "").toLowerCase();

			if (status === 409 || code === "IMPORT_BATCH_CONFLICT") {
				void previewQuery.refetch();
				toast.info(
					"O preview foi atualizado. Revise as linhas e tente novamente.",
				);
				return;
			}

			if (
				code === "IMPORT_MODEL_INVALID" ||
				(status === 422 && message.includes("planilha rejeitada"))
			) {
				toast.error(
					"O modelo da planilha foi rejeitado. Baixe o modelo oficial e envie o arquivo novamente.",
				);
				return;
			}

			if (
				status === 404 ||
				code === "NOT_FOUND" ||
				code === "IMPORT_BATCH_NOT_READY"
			) {
				returnToUpload();
				toast.error(
					"Este lote não está mais disponível. Envie a planilha novamente para gerar um novo preview.",
				);
				return;
			}

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

	const handleDownloadTemplate = async () => {
		setDownloadingTemplate(true);
		try {
			const blob = await downloadTemplate(model, workId);
			downloadBlob(blob, `modelo-${model}.xlsx`);
			toast.success("Modelo baixado.");
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Não foi possível baixar o modelo da planilha."),
			);
		} finally {
			setDownloadingTemplate(false);
		}
	};

	useEffect(() => {
		if (!open) {
			setFile(null);
			setTitle("");
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
	const validationErrors = previewQuery.data?.errors ?? [];
	const validationWarnings = previewQuery.data?.warnings ?? [];
	const modelInvalid = validationErrors.length > 0;

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
			<DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
				<div className="border-b border-border bg-muted/20 px-6 pb-5 pt-6">
					<DialogHeader className="gap-4">
						<div className="flex items-start gap-3 pr-8">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<UploadCloud className="size-5" aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<DialogTitle className="text-lg font-semibold">
									Importar {modelDetails.label.toLowerCase()}
								</DialogTitle>
								<DialogDescription className="mt-1 max-w-2xl">
									Envie a planilha e revise os dados antes de confirmar.
								</DialogDescription>
							</div>
						</div>
						<div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
							<div className="flex items-center gap-2 text-primary">
								<span className="flex size-6 items-center justify-center rounded-xl bg-primary text-xs text-primary-foreground">
									1
								</span>
								Enviar arquivo
							</div>
							<span className="h-px w-8 bg-border" aria-hidden="true" />
							<div
								className={
									batchId
										? "flex items-center gap-2 text-primary"
										: "flex items-center gap-2"
								}
							>
								<span
									className={
										batchId
											? "flex size-6 items-center justify-center rounded-xl bg-primary text-xs text-primary-foreground"
											: "flex size-6 items-center justify-center rounded-xl border border-border bg-background text-xs"
									}
								>
									2
								</span>
								Revisar e confirmar
							</div>
						</div>
					</DialogHeader>
				</div>

				{confirmation ? (
					<div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
						{confirmation.status === "APPROVED" ? (
							<>
								<div className="flex size-16 items-center justify-center rounded-xl bg-success/10 text-success">
									<CheckCircle2 className="size-9" aria-hidden="true" />
								</div>
								<p className="mt-5 text-lg font-semibold text-foreground">
									Importação confirmada
								</p>
								<p className="mt-1 max-w-md text-sm text-muted-foreground">
									Os dados da planilha foram aplicados à obra.
								</p>
								{previewQuery.data?.title && (
									<p className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground">
										{previewQuery.data.title}
									</p>
								)}
								<p className="mt-4 text-xs text-muted-foreground">
									Você já pode consultar os dados na obra.
								</p>
							</>
						) : (
							<>
								<div className="flex size-16 items-center justify-center rounded-xl bg-warning/10 text-warning">
									<Loader2 className="size-8 animate-spin" aria-hidden="true" />
								</div>
								<p className="mt-5 text-lg font-semibold text-foreground">
									Aguardando aprovação
								</p>
								<p className="mt-1 max-w-md text-sm text-muted-foreground">
									A importação foi enviada para aprovação e será aplicada após a
									decisão.
								</p>
							</>
						)}
					</div>
				) : !batchId ? (
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
						<div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
							<div className="min-w-0 space-y-5">
								{isCostImport && (
									<div className="space-y-2">
										<label
											htmlFor="cost-import-title"
											className="text-sm font-semibold text-foreground"
										>
											Título da importação
										</label>
										<Input
											id="cost-import-title"
											value={title}
											onChange={(event) => setTitle(event.target.value)}
											placeholder="Ex: Custos da fundação — janeiro"
											maxLength={200}
											aria-describedby="cost-import-title-help"
											className="mt-1 h-11 rounded-xl bg-background"
										/>
										<p
											id="cost-import-title-help"
											className="text-xs text-muted-foreground"
										>
											Esse nome será aplicado ao lote importado.
										</p>
									</div>
								)}
								<FileDropzone
									accept=".xlsx"
									disabled={uploadMutation.isPending}
									onFileReject={(message) => toast.error(message)}
									onFileSelect={(selectedFile) => {
										if (isCostImport && !title.trim()) {
											toast.error(
												"Informe o título da importação antes de enviar.",
											);
											return;
										}
										setFile(selectedFile);
										uploadMutation.mutate(selectedFile);
									}}
								/>
								{file && uploadMutation.isPending && (
									<div
										className="flex items-center gap-3 rounded-xl border border-info/25 bg-info/10 p-3 text-sm text-foreground"
										role="status"
									>
										<Loader2
											className="size-4 shrink-0 animate-spin text-info"
											aria-hidden="true"
										/>
										<span className="min-w-0 truncate">
											<strong>{file.name}</strong> está sendo analisada...
										</span>
									</div>
								)}
								{file && uploadMutation.isError && (
									<div
										className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm"
										role="alert"
									>
										<AlertCircle
											className="mt-0.5 size-4 shrink-0 text-destructive"
											aria-hidden="true"
										/>
										<span>
											<strong>Não foi possível analisar {file.name}.</strong>{" "}
											Corrija o arquivo e tente novamente.
										</span>
									</div>
								)}
							</div>
							<aside className="space-y-4">
								<div className="rounded-xl border border-border bg-background p-4">
									<div className="flex items-center gap-3">
										<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
											<Rows3 className="size-5" aria-hidden="true" />
										</div>
										<div className="min-w-0">
											<p className="text-xs font-medium text-muted-foreground">
												Tipo de importação
											</p>
											<p className="mt-1 truncate text-sm font-semibold text-foreground">
												{modelDetails.label}
											</p>
										</div>
									</div>
									<p className="mt-4 text-sm leading-6 text-muted-foreground">
										{modelDetails.description}
									</p>
									<div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
										<Info
											className="mt-0.5 size-4 shrink-0 text-info"
											aria-hidden="true"
										/>
										{modelDetails.hint}
									</div>
								</div>
								<div className="rounded-xl border-l-2 border-primary/40 bg-primary/5 p-4">
									<div className="flex items-start gap-3">
										<ShieldCheck
											className="mt-0.5 size-5 shrink-0 text-primary"
											aria-hidden="true"
										/>
										<div>
											<p className="text-sm font-semibold text-foreground">
												Use o modelo oficial
											</p>
											<p className="mt-1 text-xs leading-5 text-muted-foreground">
												Baixe a planilha com as colunas e exemplos corretos.
											</p>
										</div>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="mt-4 w-full bg-background"
										onClick={handleDownloadTemplate}
										disabled={downloadingTemplate}
									>
										<Download className="size-4" aria-hidden="true" />
										{downloadingTemplate
											? "Baixando modelo..."
											: "Baixar modelo .xlsx"}
									</Button>
								</div>
							</aside>
						</div>
					</div>
				) : (
					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
							<div className="flex min-w-0 items-center gap-3">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<FileSpreadsheet className="size-5" aria-hidden="true" />
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-foreground">
										{file?.name ?? "Planilha"}
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{modelDetails.label} · dados ainda não aplicados
									</p>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={returnToUpload}
							>
								<ArrowLeft className="size-4" aria-hidden="true" />
								Trocar arquivo
							</Button>
						</div>

						{summary && (
							<ImportStats
								summary={summary}
								impact={previewQuery.data?.impact}
							/>
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
							<>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-sm font-semibold text-foreground">
											Revisão dos dados
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">
											Selecione as linhas válidas que deseja aplicar.
										</p>
									</div>
									{summary && summary.invalid > 0 && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => rejectedMutation.mutate()}
											disabled={rejectedMutation.isPending}
										>
											<Download className="size-4" aria-hidden="true" />
											{rejectedMutation.isPending
												? "Gerando..."
												: "Baixar rejeitadas"}
										</Button>
									)}
								</div>
								<PreviewTable
									rows={rows}
									selectedRowIds={selectedRowIds}
									onToggleRow={toggleRow}
								/>
							</>
						)}

						{(validationErrors.length > 0 || validationWarnings.length > 0) && (
							<div
								className="space-y-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm"
								role="alert"
							>
								<div className="flex items-center gap-2 font-semibold text-foreground">
									<AlertCircle
										className="size-4 text-warning"
										aria-hidden="true"
									/>
									Pendências encontradas
								</div>
								{validationErrors.map((issue) => (
									<p
										key={`error-${issue.sheet ?? ""}-${issue.row ?? ""}-${issue.field ?? ""}-${issue.code}-${issue.message}`}
										className="flex items-start gap-2 text-destructive"
									>
										<XCircle
											className="mt-0.5 size-4 shrink-0"
											aria-hidden="true"
										/>
										{issue.sheet
											? `${normalizePortugueseText(issue.sheet)}: `
											: ""}
										{issue.field ? `${previewFieldLabel(issue.field)} — ` : ""}
										{normalizePortugueseText(issue.message)}
									</p>
								))}
								{validationWarnings.map((issue) => (
									<p
										key={`warning-${issue.sheet ?? ""}-${issue.row ?? ""}-${issue.field ?? ""}-${issue.code}-${issue.message}`}
										className="flex items-start gap-2 text-foreground"
									>
										<Info
											className="mt-0.5 size-4 shrink-0 text-warning"
											aria-hidden="true"
										/>
										{issue.sheet
											? `${normalizePortugueseText(issue.sheet)}: `
											: ""}
										{issue.field ? `${previewFieldLabel(issue.field)} — ` : ""}
										{normalizePortugueseText(issue.message)}
									</p>
								))}
							</div>
						)}

						<PaginationBar meta={paginationMeta} onPageChange={setPage} />
					</div>
				)}

				<DialogFooter className="border-t border-border bg-background px-6 py-4">
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						{confirmation ? "Fechar" : "Cancelar"}
					</Button>
					{!confirmation && batchId && (
						<Button
							onClick={() => confirmMutation.mutate()}
							disabled={
								confirmMutation.isPending ||
								selectedRowIds.size === 0 ||
								previewQuery.isLoading ||
								modelInvalid
							}
						>
							{confirmMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<CheckCircle2 className="size-4" />
							)}
							Confirmar importação ({selectedRowIds.size})
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ImportStats({
	summary,
	impact,
}: {
	summary: ImportPreviewPage["summary"];
	impact?: ImportPreviewPage["impact"];
}) {
	const amount = impact?.amount ? Number(impact.amount) : Number.NaN;
	const formattedAmount = Number.isFinite(amount)
		? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
		: "—";

	const stats = [
		{ label: "Total de linhas", value: summary.total, tone: "neutral" },
		{ label: "Prontas para importar", value: summary.valid, tone: "success" },
		{ label: "Com aviso", value: summary.warnings, tone: "warning" },
		{ label: "Com erro", value: summary.invalid, tone: "danger" },
	] as const;

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="rounded-xl border border-border bg-background p-3 shadow-sm"
					>
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">{stat.label}</p>
							<span
								className={[
									"size-2 rounded-xl",
									stat.tone === "success" && "bg-success",
									stat.tone === "warning" && "bg-warning",
									stat.tone === "danger" && "bg-destructive",
									stat.tone === "neutral" && "bg-muted-foreground/40",
								]
									.filter(Boolean)
									.join(" ")}
								aria-hidden="true"
							/>
						</div>
						<p className="mt-1 text-xl font-semibold text-foreground">
							{stat.value.toLocaleString("pt-BR")}
						</p>
					</div>
				))}
			</div>
			{impact && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-1 py-3 text-xs">
					<div className="flex items-center gap-2 font-semibold text-foreground">
						Impacto estimado
					</div>
					<span className="text-muted-foreground">
						<strong className="text-foreground">{impact.create}</strong> novos
					</span>
					<span className="text-muted-foreground">
						<strong className="text-foreground">{impact.update}</strong>{" "}
						atualizações
					</span>
					<span className="text-muted-foreground">
						<strong className="text-foreground">{impact.reject}</strong>{" "}
						rejeições
					</span>
					{impact.amount && (
						<span className="text-muted-foreground">
							<strong className="text-foreground">{formattedAmount}</strong> em
							valores
						</span>
					)}
				</div>
			)}
		</div>
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
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
				<Rows3 className="size-8 text-muted-foreground/50" aria-hidden="true" />
				<p className="mt-3 text-sm font-semibold text-foreground">
					Nenhuma linha nesta página
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Tente navegar para outra página do preview.
				</p>
			</div>
		);
	}
	const fields = previewFieldKeys(rows);
	return (
		<div className="max-h-[28rem] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-border bg-background shadow-sm">
			<table className="w-max min-w-full text-left text-sm">
				<thead className="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
					<tr>
						<th className="whitespace-nowrap px-4 py-3 font-semibold">
							Selecionar
						</th>
						{fields.map((field) => (
							<th
								key={field}
								className="whitespace-nowrap px-4 py-3 font-semibold"
							>
								{previewFieldLabel(field)}
							</th>
						))}
						<th className="min-w-[18rem] whitespace-nowrap px-4 py-3 font-semibold">
							Validação
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{rows.map((row) => {
						const invalid = row.status === "INVALID";
						return (
							<tr
								key={row.id}
								className={[
									"transition-colors hover:bg-muted/30",
									invalid && "bg-destructive/5 hover:bg-destructive/10",
								]
									.filter(Boolean)
									.join(" ")}
							>
								<td className="px-4 py-3 align-top">
									{invalid ? (
										<XCircle
											className="size-4 text-destructive"
											aria-label="Linha inválida"
										/>
									) : (
										<input
											type="checkbox"
											aria-label={`Selecionar linha ${row.rowNumber}`}
											checked={selectedRowIds.has(row.id)}
											className="size-4 rounded border-border accent-primary"
											onChange={() => onToggleRow(row.id, row.status)}
										/>
									)}
								</td>
								{fields.map((field) => (
									<td
										key={field}
										className="max-w-[14rem] truncate px-4 py-3 align-top text-sm text-foreground"
									>
										{previewFieldValue(field, row.values?.[field])}
									</td>
								))}
								<td className="px-4 py-3 align-top">
									<div className="space-y-1.5">
										<StatusBadge
											status={row.status}
											map={IMPORT_PREVIEW_STATUS_MAP}
										/>
										{row.issues.length > 0 ? (
											<ul className="max-w-sm space-y-1 text-xs leading-5 text-muted-foreground">
												{row.issues.map((issue) => (
													<li
														key={`${issue.column ?? ""}-${issue.code}-${issue.message}-${issue.value ?? ""}`}
													>
														{previewIssueLabel(issue)}
													</li>
												))}
											</ul>
										) : (
											<span className="text-xs text-muted-foreground">
												Nenhuma inconsistência encontrada.
											</span>
										)}
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
