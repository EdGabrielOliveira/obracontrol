import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import {
	BarChart3,
	Download,
	FileSpreadsheet,
	Map as MapIcon,
	Plus,
	Table2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { exportMedicoes } from "@/api/export";
import { workKeys } from "@/api/query-keys";
import {
	deleteWorkMeasurement,
	getWorkMeasurementMap,
	getWorkMeasurementReports,
	getWorkMeasurementSummary,
	listWorkMeasurements,
	updateWorkMeasurementStatus,
} from "@/api/work-measurements";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { PageHeader } from "@/components/atoms/page-header";
import { ImportBatchAction } from "@/components/organisms/imports/import-batch-action";
import { MeasurementStatusModal } from "@/components/organisms/measurements/measurement-status-modal";
import { WorkMeasurementListTab } from "@/components/organisms/measurements/work-measurement-list-tab";
import { WorkMeasurementMapTab } from "@/components/organisms/measurements/work-measurement-map-tab";
import { WorkMeasurementReportsTab } from "@/components/organisms/measurements/work-measurement-reports-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { invalidateWorkMeasurementQueries } from "@/lib/work-measurement-invalidation";
import {
	type MeasurementFilter,
	measurementFilterSchema,
} from "@/schemas/measurementFilter";
import type {
	MeasurementLifecycleStatus,
	WorkMeasurement,
} from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

export const Route = createFileRoute("/app/obras/$workId/medicoes/")({
	validateSearch: measurementFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ params, deps }) => {
		void queryClient.prefetchQuery({
			queryKey: workKeys.measurementsList(
				params.workId,
				deps.search as Record<string, unknown>,
			),
			queryFn: () => listWorkMeasurements(params.workId, deps.search),
		}).catch(() => undefined);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Medições - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({
		from: "/app/obras/$workId/medicoes/",
	});
	const { role } = useAuth();

	const searchParams = useSearch({ strict: false }) as MeasurementFilter;
	const navigate = Route.useNavigate();

	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [statusTarget, setStatusTarget] = useState<WorkMeasurement | null>(
		null,
	);
	const activeTab = searchParams.tab ?? "lista";

	const {
		data: listData,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: workKeys.measurementsList(
			workId,
			searchParams as Record<string, unknown>,
		),
		queryFn: () => listWorkMeasurements(workId, searchParams),
		staleTime: 2 * 60 * 1000,
	});

	const { data: mapData, isLoading: isMapLoading } = useQuery({
		queryKey: workKeys.measurementMap(workId),
		queryFn: () => getWorkMeasurementMap(workId),
	});

	const { data: reportsData, isLoading: isReportsLoading } = useQuery({
		queryKey: workKeys.measurementReports(workId),
		queryFn: () => getWorkMeasurementReports(workId),
		enabled: activeTab === "relatorios",
	});

	const { data: summaryData } = useQuery({
		queryKey: workKeys.measurementSummary(workId),
		queryFn: () => getWorkMeasurementSummary(workId),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteWorkMeasurement(workId, id),
		onSuccess: () => {
			toast.success("Medição excluída.");
			invalidateWorkMeasurementQueries(queryClient, workId);
			setDeleteId(null);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir medição.")),
	});

	const statusMutation = useMutation({
		mutationFn: ({
			measurementId,
			status,
			reason,
		}: {
			measurementId: string;
			status: MeasurementLifecycleStatus;
			reason?: string;
		}) => updateWorkMeasurementStatus(workId, measurementId, status, reason),
		onSuccess: () => {
			setStatusTarget(null);
			toast.success("Status da medição atualizado.");
			invalidateWorkMeasurementQueries(queryClient, workId);
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível alterar o status da medição."),
			),
	});

	const handleExport = async () => {
		try {
			const blob = await exportMedicoes(workId);
			downloadBlob(blob, `medicoes-${workId}.xlsx`);
			toast.success("Exportação concluída!");
		} catch {
			toast.error("Erro ao exportar medições.");
		}
	};

	const updateSearch = (patch: Partial<MeasurementFilter>) => {
		navigate({
			search: (prev) => {
				const current = prev as MeasurementFilter;
				return { ...current, ...patch };
			},
		});
	};

	if (isLoading) return <LoadingSpinner title="Carregando medições..." />;

	const measList = listData?.data ?? [];
	const totalPages = listData ? Math.ceil(listData.total / listData.limit) : 1;
	const currentPage = listData ? listData.page : 1;
	const hasMeasurementData = (summaryData?.measurementCount ?? 0) > 0;
	const noInformation = "Sem informações";

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Medições"
				description="Medições da obra"
				actions={
					<>
						<Button
							variant="default"
							size="sm"
							onClick={() =>
								navigate({
									to: "/app/obras/$workId/medicoes/new",
									params: { workId },
								})
							}
						>
							<Plus className="mr-2 h-4 w-4" />
							Nova medição
						</Button>
						<Button variant="outline" size="sm" onClick={handleExport}>
							<FileSpreadsheet className="mr-2 h-4 w-4" />
							Exportar
						</Button>
						<ImportBatchAction
							workId={workId}
							model="medicao-obra"
							buttonProps={{ variant: "outline", size: "sm" }}
						>
							<Download className="mr-2 h-4 w-4" />
							Importar planilha
						</ImportBatchAction>
					</>
				}
			/>
			<div className="space-y-6">
				<KpiGrid>
					<KpiCard
						title="Total Medido"
						value={
							hasMeasurementData
								? formatCurrency(summaryData?.totalMeasured ?? 0)
								: noInformation
						}
						tone="success"
					/>
					<KpiCard
						title="% Medido"
						value={
							hasMeasurementData
								? formatRatioAsPercentage(
										summaryData?.totalMeasuredPercentage ?? 0,
									)
								: noInformation
						}
						tone="default"
					/>
					<KpiCard
						title="Saldo a Medir"
						value={
							hasMeasurementData
								? formatCurrency(summaryData?.balanceToMeasure ?? 0)
								: noInformation
						}
						tone={
							(summaryData?.balanceToMeasure ?? 0) <= 0 ? "danger" : "warning"
						}
					/>
				</KpiGrid>

				<Tabs
					value={activeTab}
					onValueChange={(tab) =>
						updateSearch({ tab: tab as MeasurementFilter["tab"] })
					}
				>
					<TabsList className="mb-4">
						<TabsTrigger value="lista" className="gap-1.5">
							<Table2 className="h-4 w-4" />
							Lista
						</TabsTrigger>
						<TabsTrigger value="mapa" className="gap-1.5">
							<MapIcon className="h-4 w-4" />
							Mapa
						</TabsTrigger>
						<TabsTrigger value="relatorios" className="gap-1.5">
							<BarChart3 className="h-4 w-4" />
							Relatórios
						</TabsTrigger>
					</TabsList>

					<TabsContent value="lista">
						{error ? (
							<ErrorFeedback onRetry={() => refetch()} />
						) : (
							<WorkMeasurementListTab
								measurements={measList}
								searchParams={searchParams}
								onSearchChange={updateSearch}
								onCreate={() =>
									navigate({
										to: "/app/obras/$workId/medicoes/new",
										params: { workId },
									})
								}
								onEdit={(measurement) =>
									navigate({
										to: "/app/obras/$workId/medicoes/$measurementId/edit",
										params: { workId, measurementId: measurement.id },
									})
								}
								onDelete={(id) => setDeleteId(id)}
								canChangeStatus={role !== null && role !== "SUPERVISOR"}
								onOpenStatus={setStatusTarget}
								isUpdatingStatus={statusMutation.isPending}
								currentPage={currentPage}
								totalPages={totalPages}
								workId={workId}
							/>
						)}
					</TabsContent>
					<TabsContent value="mapa">
						{isMapLoading && <LoadingSpinner title="Carregando mapa..." />}
						{mapData && <WorkMeasurementMapTab data={mapData} />}
					</TabsContent>
					<TabsContent value="relatorios">
						{isReportsLoading && (
							<LoadingSpinner title="Carregando relatórios..." />
						)}
						{reportsData && <WorkMeasurementReportsTab data={reportsData} />}
					</TabsContent>
				</Tabs>

				<ConfirmDialog
					open={deleteId !== null}
					title="Excluir medição?"
					description="Esta ação não pode ser desfeita."
					onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
					onCancel={() => setDeleteId(null)}
					loading={deleteMutation.isPending}
				/>
				<MeasurementStatusModal
					open={statusTarget !== null}
					onOpenChange={(open) => {
						if (!open) setStatusTarget(null);
					}}
					currentStatus={statusTarget?.status ?? "RASCUNHO"}
					onSave={(status, reason) => {
						if (!statusTarget) return;
						statusMutation.mutate({
							measurementId: statusTarget.id,
							status,
							reason,
						});
					}}
					loading={statusMutation.isPending}
				/>
			</div>
		</PageContainer>
	);
}
