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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getBudgetItems } from "@/api/budget";
import { exportMedicoes } from "@/api/export";
import { listMeasurementCoverages } from "@/api/measurement-coverage";
import {
	governanceKeys,
	measurementCoverageKeys,
	workKeys,
} from "@/api/query-keys";
import {
	deleteWorkMeasurement,
	getWorkMeasurementMap,
	getWorkMeasurementReports,
	getWorkMeasurementSummary,
	listWorkMeasurements,
} from "@/api/work-measurements";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { PageHeader } from "@/components/atoms/page-header";
import { ImportBatchAction } from "@/components/organisms/imports/import-batch-action";
import { WorkMeasurementListTab } from "@/components/organisms/measurements/work-measurement-list-tab";
import { WorkMeasurementMapTab } from "@/components/organisms/measurements/work-measurement-map-tab";
import { WorkMeasurementReportsTab } from "@/components/organisms/measurements/work-measurement-reports-tab";
import { WorkMeasurementEditModal } from "@/components/organisms/modals/work-measurement-edit-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import {
	type MeasurementFilter,
	measurementFilterSchema,
} from "@/schemas/measurementFilter";
import type { MeasurementWarning, WorkMeasurement } from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

export const Route = createFileRoute("/app/obras/$workId/medicoes/")({
	validateSearch: measurementFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps }) =>
		await queryClient.prefetchQuery({
			queryKey: workKeys.measurementsList(
				params.workId,
				deps.search as Record<string, unknown>,
			),
			queryFn: () => listWorkMeasurements(params.workId, deps.search),
		}),
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

	const searchParams = useSearch({ strict: false }) as MeasurementFilter;
	const navigate = Route.useNavigate();

	const [editMeasurement, setEditMeasurement] =
		useState<WorkMeasurement | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [measurementWarnings, setMeasurementWarnings] = useState<
		MeasurementWarning[]
	>([]);
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

	const { data: budgetData } = useQuery({
		queryKey: workKeys.budget(workId),
		queryFn: () => getBudgetItems(workId),
	});

	const { data: coverages } = useQuery({
		queryKey: measurementCoverageKeys.list(workId),
		queryFn: () => listMeasurementCoverages(workId),
		staleTime: 2 * 60 * 1000,
	});

	const coveredItemIds = useMemo(() => {
		const ids = new Set<string>();
		for (const coverage of coverages ?? []) {
			ids.add(coverage.workMeasurementItemId);
		}
		return ids;
	}, [coverages]);

	const allBudgetItems = budgetData?.items ?? [];
	const budgetOptions = allBudgetItems.map((item) => ({
		id: item.id,
		value: item.id,
		label: `${item.index} - ${item.description}`,
	}));

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteWorkMeasurement(workId, id),
		onSuccess: () => {
			toast.success("Medição excluída.");
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementsBase(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementSummary(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementMap(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementReports(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.budget(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.physicalFinancialBase(workId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({
				queryKey: workKeys.reports(workId),
			});
			queryClient.invalidateQueries({
				queryKey: governanceKeys.pendingApprovals(workId),
			});
			setDeleteId(null);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir medição.")),
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

	const handleMeasurementResult = (result: {
		warnings?: MeasurementWarning[];
		approvalStatus?: "APPROVED" | "PENDING_APPROVAL";
	}) => {
		const warnings = result.warnings ?? [];
		if (warnings.length === 0) return;
		setMeasurementWarnings(warnings);
		toast.warning(
			result.approvalStatus === "PENDING_APPROVAL"
				? "Medição enviada para aprovação."
				: warnings[0].message,
		);
	};

	if (isLoading) return <LoadingSpinner title="Carregando medições..." />;

	const measList = listData?.data ?? [];
	const totalPages = listData ? Math.ceil(listData.total / listData.limit) : 1;
	const currentPage = listData ? listData.page : 1;

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
				{measurementWarnings.length > 0 && (
					<Alert>
						<AlertTitle className="flex items-center justify-between gap-2">
							<span>Atenção</span>
							<button
								type="button"
								onClick={() => setMeasurementWarnings([])}
								className="rounded p-0.5 text-muted-foreground hover:text-foreground"
								aria-label="Fechar avisos"
							>
								×
							</button>
						</AlertTitle>
						<AlertDescription>
							<ul className="list-disc pl-4">
								{measurementWarnings.map((warning) => (
									<li key={`${warning.code}-${warning.message}`}>
										{warning.message}
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}
				<KpiGrid>
					<KpiCard
						title="Total Medido"
						value={formatCurrency(summaryData?.totalMeasured ?? 0)}
						tone="success"
					/>
					<KpiCard
						title="% Medido"
						value={formatRatioAsPercentage(
							summaryData?.totalMeasuredPercentage ?? 0,
						)}
						tone="default"
					/>
					<KpiCard
						title="Saldo a Medir"
						value={formatCurrency(summaryData?.balanceToMeasure ?? 0)}
						tone={
							(summaryData?.balanceToMeasure ?? 0) <= 0 ? "danger" : "warning"
						}
					/>
					<KpiCard
						title="Medições"
						value={`${summaryData?.measurementCount ?? 0}`}
						tone="default"
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
								onEdit={setEditMeasurement}
								onDelete={(id) => setDeleteId(id)}
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

				{editMeasurement && (
					<WorkMeasurementEditModal
						open
						onOpenChange={(open) => {
							if (!open) setEditMeasurement(null);
						}}
						workId={workId}
						measurement={editMeasurement}
						budgetOptions={budgetOptions}
						coveredItemIds={coveredItemIds}
						onResult={handleMeasurementResult}
					/>
				)}

				<ConfirmDialog
					open={deleteId !== null}
					title="Excluir medição?"
					description="Esta ação não pode ser desfeita."
					onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
					onCancel={() => setDeleteId(null)}
					loading={deleteMutation.isPending}
				/>
			</div>
		</PageContainer>
	);
}
