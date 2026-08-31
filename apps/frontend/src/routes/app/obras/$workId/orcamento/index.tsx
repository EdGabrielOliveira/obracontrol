import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import {
	FileSpreadsheet,
	GanttChart,
	ListTree,
	Pencil,
	Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	archiveBudgetVersion,
	confirmBudgetVersionImport,
	getBudgetItems,
	getBudgetVersion,
	getEffectiveBudgetVersion,
	listBudgetVersions,
	previewBudgetVersionImport,
	submitBudgetVersion,
} from "@/api/budget";
import { exportCompleto, exportOrcamento } from "@/api/export";
import { cancelImportBatch } from "@/api/import";
import { budgetVersionKeys, governanceKeys, workKeys } from "@/api/query-keys";
import {
	createScheduleRevision,
	getPhysicalFinancialSchedule,
	getSchedule,
	importSchedule,
} from "@/api/schedule";
import {
	downloadBudgetAmendmentTemplate,
	downloadScheduleTemplate,
	TEMPLATE_FILENAMES,
} from "@/api/templates";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { PageHeader } from "@/components/atoms/page-header";
import { BudgetVersionAccordion } from "@/components/organisms/budget/budget-version-accordion";
import { BudgetVersionImportDialog } from "@/components/organisms/budget/budget-version-import-dialog";
import { ScheduleImportDialog } from "@/components/organisms/schedule/schedule-import-dialog";
import { BudgetKpiCards } from "@/components/organisms/works/budget-kpi-cards";
import { PhysicalFinancialPanel } from "@/components/organisms/works/physical-financial-panel";
import { SchedulePanel } from "@/components/organisms/works/schedule-panel";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import type {
	BudgetVersionDetail,
	BudgetVersionImportPreview,
	BudgetViewResponse,
} from "@/types/budget";
import { getErrorMessage } from "@/utils/api-error";
import { formatCurrency } from "@/utils/format";

const orcamentoSearchSchema = z.object({
	tab: z
		.enum(["itens", "cronograma", "fisico-financeiro"])
		.optional()
		.default("itens"),
});

export type OrcamentoSearch = z.infer<typeof orcamentoSearchSchema>;

export const Route = createFileRoute("/app/obras/$workId/orcamento/")({
	component: RouteComponent,
	validateSearch: orcamentoSearchSchema,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Orçamento - ObraControl" },
		],
	}),
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.budget(params.workId),
				queryFn: () =>
					getBudgetItems(params.workId, { includePhysicalFinancial: false }),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.budgetVersion(params.workId),
				queryFn: () => getEffectiveBudgetVersion(params.workId),
			}),
		]).catch(() => undefined);
	},
});

const emptySummary: BudgetViewResponse["summary"] = {
	totalBudgeted: 0,
	totalDirectCost: 0,
	bdiPercentage: 0,
	bdiValue: 0,
	totalFinalPrice: 0,
	totalMeasured: 0,
	balanceToMeasure: 0,
	measurementCount: 0,
	actualCostCount: 0,
};

function RouteComponent() {
	const { requestCreationConfirmation } = useCreationConfirmation();
	const { workId } = useParams({
		from: "/app/obras/$workId/orcamento/",
	});
	const navigate = useNavigate();
	const { tab } = useSearch({
		from: "/app/obras/$workId/orcamento/",
	});
	const { role } = useAuth();
	const canWrite = role !== null;

	const [aditivoOpen, setAditivoOpen] = useState(false);
	const [scheduleImportOpen, setScheduleImportOpen] = useState(false);
	const [downloadingAditivoTemplate, setDownloadingAditivoTemplate] =
		useState(false);
	const [aditivoPreview, setAditivoPreview] =
		useState<BudgetVersionImportPreview | null>(null);

	const { data, isLoading, error, refetch } = useQuery<BudgetViewResponse>({
		queryKey: workKeys.budget(workId),
		queryFn: () =>
			getBudgetItems(workId, { includePhysicalFinancial: false }),
		staleTime: 2 * 60 * 1000,
	});

	const {
		isLoading: budgetVersionLoading,
		error: budgetVersionError,
		refetch: refetchBudgetVersion,
	} = useQuery({
		queryKey: workKeys.budgetVersion(workId),
		queryFn: () => getEffectiveBudgetVersion(workId),
	});

	const { data: versionHistory, isLoading: versionHistoryLoading } = useQuery({
		queryKey: budgetVersionKeys.history(workId),
		queryFn: () => listBudgetVersions(workId),
		enabled: tab === "itens",
	});

	const [expandedVersionId, setExpandedVersionId] = useState<string | null>(
		null,
	);
	const [hasInitializedVersionAccordion, setHasInitializedVersionAccordion] =
		useState(false);
	const activeVersionId =
		versionHistory?.find((version) => version.isActive)?.id ??
		versionHistory?.[0]?.id ??
		null;
	useEffect(() => {
		if (!hasInitializedVersionAccordion && activeVersionId) {
			setExpandedVersionId(activeVersionId);
			setHasInitializedVersionAccordion(true);
		}
	}, [activeVersionId, hasInitializedVersionAccordion]);

	const expandedVersion =
		versionHistory?.find((version) => version.id === expandedVersionId) ?? null;
	const expandedSourceId = expandedVersion?.sourceVersionId ?? null;

	const expandedDetailQuery = useQuery({
		queryKey: budgetVersionKeys.detail(workId, expandedVersionId ?? ""),
		queryFn: () =>
			expandedVersionId
				? getBudgetVersion(workId, expandedVersionId)
				: Promise.resolve(null),
		enabled: tab === "itens" && expandedVersionId !== null,
	});
	const sourceDetailQuery = useQuery({
		queryKey: budgetVersionKeys.detail(workId, expandedSourceId ?? ""),
		queryFn: () =>
			expandedSourceId
				? getBudgetVersion(workId, expandedSourceId)
				: Promise.resolve(null),
		enabled: tab === "itens" && expandedSourceId !== null,
	});

	const versionDetails = new Map<string, BudgetVersionDetail | null>();
	if (expandedVersionId && expandedDetailQuery.data) {
		versionDetails.set(expandedVersionId, expandedDetailQuery.data);
	}
	if (expandedSourceId && sourceDetailQuery.data) {
		versionDetails.set(expandedSourceId, sourceDetailQuery.data);
	}
	const loadingVersionIds = new Set<string>();
	if (expandedVersionId && expandedDetailQuery.isLoading) {
		loadingVersionIds.add(expandedVersionId);
	}
	if (expandedSourceId && sourceDetailQuery.isLoading) {
		loadingVersionIds.add(expandedSourceId);
	}

	const {
		data: scheduleData,
		isLoading: scheduleLoading,
		error: scheduleError,
		refetch: refetchSchedule,
	} = useQuery({
		queryKey: workKeys.schedule(workId),
		queryFn: () => getSchedule(workId),
		enabled: tab === "cronograma",
		staleTime: 2 * 60 * 1000,
	});

	const [physFinPeriod, setPhysFinPeriod] = useState<
		"monthly" | "biweekly" | "weekly"
	>("monthly");

	const { data: physFinData, isLoading: physFinLoading } = useQuery({
		queryKey: workKeys.physicalFinancial(workId, physFinPeriod),
		queryFn: () => getPhysicalFinancialSchedule(workId, physFinPeriod),
		enabled: tab === "fisico-financeiro",
		staleTime: 2 * 60 * 1000,
	});

	const budgetData = data ?? null;
	const summary = budgetData?.summary ?? emptySummary;
	const hasItems = (budgetData?.items?.length ?? 0) > 0;
	const effectiveTotalBudgeted = summary.totalBudgeted;

	const createRevisionMutation = useMutation({
		mutationFn: (values: Parameters<typeof createScheduleRevision>[1]) =>
			createScheduleRevision(workId, values),
		onSuccess: () => {
			toast.success("Replanejamento registrado com sucesso!");
			queryClient.invalidateQueries({ queryKey: workKeys.schedule(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.budget(workId) });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao registrar replanejamento.")),
	});

	const scheduleImportMutation = useMutation({
		mutationFn: (file: File) => importSchedule(workId, file),
		onSuccess: (result) => {
			const rejected = result.rejectedCount ?? result.errors?.length ?? 0;
			if (rejected > 0) {
				toast.warning(
					`Cronograma importado com ${rejected} linha(s) rejeitada(s). Confira o arquivo enviado.`,
				);
			} else {
				toast.success("Cronograma importado com sucesso!");
			}
			setScheduleImportOpen(false);
			queryClient.invalidateQueries({ queryKey: workKeys.schedule(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.budget(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.detail(workId) });
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível importar o cronograma."),
			),
	});

	const submitVersionMutation = useMutation({
		mutationFn: ({
			versionId,
			reason,
		}: {
			versionId: string;
			reason?: string;
		}) => submitBudgetVersion(workId, versionId, reason),
		onSuccess: (result) => {
			if (result.status === "APPROVED") {
				toast.success("Aditivo aprovado e ativado com sucesso!");
				queryClient.invalidateQueries({
					queryKey: budgetVersionKeys.history(workId),
				});
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(workId),
				});
				queryClient.invalidateQueries({
					queryKey: workKeys.budgetVersion(workId),
				});
				queryClient.invalidateQueries({ queryKey: workKeys.budget(workId) });
				queryClient.invalidateQueries({ queryKey: workKeys.schedule(workId) });
				queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
				queryClient.invalidateQueries({
					queryKey: workKeys.measurementsBase(workId),
				});
				queryClient.invalidateQueries({
					queryKey: workKeys.contracts(workId),
				});
				queryClient.invalidateQueries({
					queryKey: workKeys.physicalFinancialBase(workId),
				});
				queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
				queryClient.invalidateQueries({
					queryKey: workKeys.management(workId),
				});
				queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
				return;
			}
			toast.success("Versão submetida para aprovação!");
			queryClient.invalidateQueries({
				queryKey: budgetVersionKeys.history(workId),
			});
			queryClient.invalidateQueries({
				queryKey: governanceKeys.pendingApprovals(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.budgetVersion(workId),
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao submeter versão.")),
	});

	const archiveVersionMutation = useMutation({
		mutationFn: ({
			versionId,
			reason,
		}: {
			versionId: string;
			reason: string;
		}) => archiveBudgetVersion(workId, versionId, reason),
		onSuccess: () => {
			toast.success("Versão arquivada com sucesso.");
			queryClient.invalidateQueries({
				queryKey: budgetVersionKeys.history(workId),
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao arquivar versão.")),
	});

	const previewAditivoMutation = useMutation({
		mutationFn: (input: { title: string; file: File }) =>
			previewBudgetVersionImport(workId, input),
		onMutate: () => setAditivoPreview(null),
		onSuccess: (preview) => setAditivoPreview(preview),
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao gerar preview do aditivo.")),
	});

	const confirmAditivoMutation = useMutation({
		mutationFn: ({
			importId,
			sourceVersionId,
		}: {
			importId: string;
			sourceVersionId: string | null;
		}) => confirmBudgetVersionImport(workId, importId, sourceVersionId),
		onSuccess: () => {
			toast.success("Versão criada em rascunho.");
			setAditivoOpen(false);
			setAditivoPreview(null);
			queryClient.invalidateQueries({
				queryKey: budgetVersionKeys.history(workId),
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao confirmar a versão.")),
	});

	if (budgetVersionLoading)
		return <LoadingSpinner title="Resolvendo versão efetiva do orçamento..." />;
	if (budgetVersionError)
		return (
			<ErrorFeedback
				message="Não foi possível resolver a versão efetiva do orçamento."
				onRetry={() => refetchBudgetVersion()}
			/>
		);
	if (isLoading) return <LoadingSpinner title="Carregando orçamento..." />;
	if (error) return <ErrorFeedback onRetry={() => refetch()} />;

	const handleExport = async () => {
		try {
			const blob = await exportOrcamento(workId);
			downloadBlob(blob, `orcamento-${workId}.xlsx`);
			toast.success("Exportação concluída!");
		} catch {
			toast.error("Erro ao exportar orçamento.");
		}
	};

	const handleDownloadAditivoTemplate = async () => {
		setDownloadingAditivoTemplate(true);
		try {
			const blob = await downloadBudgetAmendmentTemplate(workId);
			downloadBlob(blob, TEMPLATE_FILENAMES["orcamento-aditivo"]);
			toast.success("Modelo de aditivo baixado!");
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Não foi possível baixar o modelo de aditivo."),
			);
		} finally {
			setDownloadingAditivoTemplate(false);
		}
	};

	const handleDownloadScheduleTemplate = async () => {
		try {
			const blob = await downloadScheduleTemplate(workId);
			downloadBlob(blob, `modelo-cronograma-${workId}.xlsx`);
			toast.success("Modelo de cronograma baixado!");
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					"Não foi possível baixar o modelo de cronograma.",
				),
			);
		}
	};

	const handleAditivoOpenChange = (open: boolean) => {
		if (!open && aditivoPreview) {
			cancelImportBatch(workId, aditivoPreview.batchId).catch(() => undefined);
		}
		setAditivoOpen(open);
		if (!open) setAditivoPreview(null);
	};

	const _handleExportCronograma = async () => {
		try {
			const blob = await exportCompleto(workId);
			downloadBlob(blob, `cronograma-${workId}.xlsx`);
			toast.success("Exportação concluída!");
		} catch {
			toast.error("Erro ao exportar cronograma.");
		}
	};

	if (
		!hasItems &&
		!versionHistoryLoading &&
		(versionHistory?.length ?? 0) === 0
	) {
		return (
			<PageContainer>
				<PageHeader
					eyebrow="Obra"
					title={budgetData?.work?.name ?? "Orçamento"}
					description="Itens de orçamento"
				/>
				<EmptyStateCard
					icon={FileSpreadsheet}
					title="Nenhum item de orçamento"
					description="Esta obra ainda não possui um orçamento vinculado. Importe uma planilha Excel para começar."
					actions={
						canWrite ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAditivoOpen(true)}
							>
								<Upload className="mr-2 h-4 w-4" />
								Importar orçamento
							</Button>
						) : undefined
					}
				/>
				<BudgetVersionImportDialog
					open={aditivoOpen}
					onOpenChange={handleAditivoOpenChange}
					preview={aditivoPreview}
					previewPending={previewAditivoMutation.isPending}
					confirmPending={confirmAditivoMutation.isPending}
					templateDownloadPending={downloadingAditivoTemplate}
					onDownloadTemplate={handleDownloadAditivoTemplate}
					onPreview={(input) => previewAditivoMutation.mutate(input)}
					onConfirm={(importId, sourceVersionId) =>
						confirmAditivoMutation.mutate({ importId, sourceVersionId })
					}
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title={budgetData?.work?.name ?? "Orçamento"}
				description={`Itens de orçamento — Total: ${formatCurrency(effectiveTotalBudgeted)}`}
				actions={
					<>
						{canWrite && hasItems && (
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									navigate({
										to: "/app/obras/$workId/orcamento/editar",
										params: { workId },
									})
								}
							>
								<Pencil className="mr-2 h-4 w-4" />
								Editar orçamento
							</Button>
						)}
						{canWrite && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setScheduleImportOpen(true)}
							>
								<Upload className="mr-2 h-4 w-4" />
								Importar cronograma
							</Button>
						)}
						<Button variant="outline" size="sm" onClick={handleExport}>
							<FileSpreadsheet className="mr-2 h-4 w-4" />
							Exportar orçamento
						</Button>
					</>
				}
			/>
			<div className="space-y-6">
				<BudgetKpiCards
					summary={summary}
					effectiveTotal={effectiveTotalBudgeted}
				/>

				<Tabs
					value={tab}
					onValueChange={(v) => {
						navigate({
							from: "/app/obras/$workId/orcamento/",
							search: {
								tab: v as "itens" | "cronograma" | "fisico-financeiro",
							},
						});
					}}
				>
					<TabsList>
						<TabsTrigger value="itens" className="gap-1.5">
							<ListTree className="h-4 w-4" />
							Itens
						</TabsTrigger>
						<TabsTrigger value="cronograma" className="gap-1.5">
							<GanttChart className="h-4 w-4" />
							Cronograma
						</TabsTrigger>
						<TabsTrigger value="fisico-financeiro" className="gap-1.5">
							<FileSpreadsheet className="h-4 w-4" />
							Físico-Financeiro
						</TabsTrigger>
					</TabsList>
					<TabsContent value="itens" className="mt-4">
						<BudgetVersionAccordion
							versions={versionHistory ?? []}
							details={versionDetails}
							loadingVersionIds={loadingVersionIds}
							openVersionId={expandedVersionId}
							canWrite={canWrite && !budgetData?.governed}
							canApprove={role !== null && role !== "SUPERVISOR"}
							submitPending={submitVersionMutation.isPending}
							archivePending={archiveVersionMutation.isPending}
							onCreateAditivo={() => setAditivoOpen(true)}
							onOpenChange={setExpandedVersionId}
							onSubmitVersion={(versionId, reason) =>
								submitVersionMutation.mutate({ versionId, reason })
							}
							onArchiveVersion={(versionId, reason) =>
								archiveVersionMutation.mutate({ versionId, reason })
							}
						/>
					</TabsContent>
					<TabsContent value="cronograma" className="mt-4">
						{scheduleLoading ? (
							<LoadingSpinner title="Carregando cronograma..." />
						) : scheduleError ? (
							<ErrorFeedback
								message={getErrorMessage(
									scheduleError,
									"Não foi possível carregar o cronograma.",
								)}
								onRetry={() => void refetchSchedule()}
							/>
						) : (
							<SchedulePanel
								workId={workId}
								scheduleData={scheduleData}
								onCreateRevision={
									canWrite
										? (values) =>
												requestCreationConfirmation(() =>
													createRevisionMutation.mutate(values),
												)
										: undefined
								}
								canEditManualSchedule={canWrite}
							/>
						)}
					</TabsContent>
					<TabsContent value="fisico-financeiro" className="mt-4">
						{physFinLoading ? (
							<LoadingSpinner title="Carregando físico-financeiro..." />
						) : physFinData ? (
							<PhysicalFinancialPanel
								data={physFinData}
								period={physFinPeriod}
								onPeriodChange={setPhysFinPeriod}
							/>
						) : (
							<EmptyStateCard
								icon={FileSpreadsheet}
								title="Nenhum dado físico-financeiro"
								description="Dados físico-financeiros serão exibidos aqui quando disponíveis."
							/>
						)}
					</TabsContent>
				</Tabs>

				<BudgetVersionImportDialog
					open={aditivoOpen}
					onOpenChange={handleAditivoOpenChange}
					preview={aditivoPreview}
					previewPending={previewAditivoMutation.isPending}
					confirmPending={confirmAditivoMutation.isPending}
					templateDownloadPending={downloadingAditivoTemplate}
					onDownloadTemplate={handleDownloadAditivoTemplate}
					onPreview={(input) => previewAditivoMutation.mutate(input)}
					onConfirm={(importId, sourceVersionId) =>
						confirmAditivoMutation.mutate({ importId, sourceVersionId })
					}
				/>
				<ScheduleImportDialog
					open={scheduleImportOpen}
					onOpenChange={setScheduleImportOpen}
					pending={scheduleImportMutation.isPending}
					error={
						scheduleImportMutation.error
							? getErrorMessage(
									scheduleImportMutation.error,
									"Não foi possível importar o cronograma.",
								)
							: null
					}
					onImport={(file) => scheduleImportMutation.mutate(file)}
					onDownloadTemplate={() => void handleDownloadScheduleTemplate()}
				/>
			</div>
		</PageContainer>
	);
}
