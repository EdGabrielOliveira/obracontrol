import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	CheckCircle2,
	DollarSign,
	Download,
	FileSpreadsheet,
	Pencil,
	Plus,
	Receipt,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getBudgetItems, getCurrentCostBudgetItems } from "@/api/budget";
import {
	type ActualCostFilter,
	deleteActualCost,
	listActualCosts,
} from "@/api/costs";
import { exportCustos } from "@/api/export";
import { decideApproval } from "@/api/governance";
import { governanceKeys, workKeys, workSupplierKeys } from "@/api/query-keys";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { DataTable } from "@/components/atoms/data-table";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { PageHeader } from "@/components/atoms/page-header";
import {
	APPROVAL_STATUS_MAP,
	PAYMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { ImportBatchAction } from "@/components/organisms/imports/import-batch-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { canDecideSupervisorRequests } from "@/lib/role-permissions";
import { paginationSchema } from "@/schemas/pagination";
import type { LegacyActualCost } from "@/types/measurements";
import type { PaginationMeta } from "@/types/shared";
import {
	CATEGORY_LABEL,
	COST_TYPE_LABEL,
	costTypeStyle,
	formatCurrency,
	formatDate,
} from "@/utils/format";
import { getPaginationMeta } from "@/utils/pagination";

const costFilterSchema = z
	.object({
		q: z.string().max(100).optional(),
		category: z.string().optional(),
		supplierName: z.string().optional(),
		status: z.string().optional(),
		costType: z.string().optional(),
		startDate: z.string().optional(),
		endDate: z.string().optional(),
	})
	.merge(paginationSchema);

type CostFilter = z.infer<typeof costFilterSchema>;

const costColumnHelper = createColumnHelper<LegacyActualCost>();

export const Route = createFileRoute("/app/obras/$workId/custos/")({
	validateSearch: costFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps }) => {
		await Promise.allSettled([
			queryClient.prefetchQuery({
				queryKey: workKeys.costsList(
					params.workId,
					deps.search as Record<string, unknown>,
				),
				queryFn: () =>
					listActualCosts(params.workId, deps.search as ActualCostFilter),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.costBudgetItems(params.workId),
				queryFn: () => getCurrentCostBudgetItems(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.budget(params.workId),
				queryFn: () => getBudgetItems(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: workSupplierKeys.list(params.workId),
				queryFn: () => listWorkSuppliers(params.workId),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Custos - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const params = useParams({
		from: "/app/obras/$workId/custos/",
	});
	const searchParams = useSearch({ from: Route.id }) as CostFilter;
	const navigate = useNavigate({ from: Route.id });
	const { workId } = params;
	const { role, capabilities } = useAuth();
	const canApprovePendingItems =
		role === "ADMIN" ||
		role === "GERENTE" ||
		canDecideSupervisorRequests(capabilities);
	const queryClient = useQueryClient();
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [approvalDecision, setApprovalDecision] = useState<{
		requestId: string;
		decision: "APPROVE" | "REJECT";
		costDescription: string;
	} | null>(null);
	const [approvalReason, setApprovalReason] = useState("");

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: workKeys.costsList(
			workId,
			searchParams as Record<string, unknown>,
		),
		queryFn: () => listActualCosts(workId, searchParams),
		staleTime: 2 * 60 * 1000,
	});

	const {
		isLoading: costBudgetItemsLoading,
		error: costBudgetItemsError,
		refetch: refetchCostBudgetItems,
	} = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
	});

	const handleExport = async () => {
		try {
			const blob = await exportCustos(workId);
			downloadBlob(blob, `custos-${workId}.xlsx`);
			toast.success("Exportação concluída!");
		} catch {
			toast.error("Erro ao exportar custos.");
		}
	};

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteActualCost(workId, id),
		onSuccess: () => {
			toast.success("Custo excluído.");
			queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.management(workId) });
			queryClient.invalidateQueries({
				queryKey: workKeys.costBudgetItems(workId),
			});
			setDeleteId(null);
		},
		onError: () => toast.error("Erro ao excluir custo."),
	});

	const approvalMutation = useMutation({
		mutationFn: () => {
			if (!approvalDecision) throw new Error("Decisão não selecionada.");
			return decideApproval({
				requestId: approvalDecision.requestId,
				decision: approvalDecision.decision,
				reason: approvalReason.trim() || undefined,
			});
		},
		onSuccess: () => {
			toast.success("Decisão registrada.");
			queryClient.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			queryClient.invalidateQueries({ queryKey: governanceKeys.all });
			setApprovalDecision(null);
			setApprovalReason("");
		},
		onError: () => toast.error("Não foi possível registrar a decisão."),
	});

	const costColumns = [
		costColumnHelper.display({
			id: "title",
			header: "Título",
			cell: (info) => {
				const cost = info.row.original;
				return (
					<div className="min-w-[180px]">
						<p className="font-medium text-foreground">
							{cost.description ||
								CATEGORY_LABEL[cost.category] ||
								"Custo realizado"}
						</p>
						<p className="text-xs text-muted-foreground">
							{formatDate(cost.costDate)}
						</p>
					</div>
				);
			},
			meta: { mobileLabel: "Título" },
		}),
		costColumnHelper.accessor("costDate", {
			header: "Data",
			cell: (info) => formatDate(info.getValue()),
			meta: { mobileLabel: "Data" },
		}),
		costColumnHelper.accessor("category", {
			header: "Categoria",
			cell: (info) => {
				const cost = info.row.original;
				return (
					cost.categoryDetail || CATEGORY_LABEL[cost.category] || cost.category
				);
			},
			meta: { mobileLabel: "Categoria" },
		}),
		costColumnHelper.accessor("description", {
			header: "Descrição",
			cell: (info) => info.getValue() ?? "—",
			meta: { mobileLabel: "Descrição" },
		}),
		costColumnHelper.accessor("amount", {
			header: "Valor",
			cell: (info) => (
				<span className="text-right font-medium">
					{formatCurrency(info.getValue())}
				</span>
			),
			meta: { mobileLabel: "Valor" },
		}),
		costColumnHelper.accessor("costType", {
			header: "Tipo",
			cell: (info) => (
				<span className={costTypeStyle(info.getValue())}>
					{COST_TYPE_LABEL[info.getValue()] ?? info.getValue()}
				</span>
			),
			meta: { mobileLabel: "Tipo" },
		}),
		costColumnHelper.accessor("supplierName", {
			header: "Fornecedor",
			cell: (info) => {
				const cost = info.row.original;
				return cost.supplier?.name ?? cost.supplierName ?? "—";
			},
			meta: { mobileLabel: "Fornecedor" },
		}),
		costColumnHelper.accessor("paymentStatus", {
			header: "Status",
			cell: (info) => (
				<StatusBadge status={info.getValue()} map={PAYMENT_STATUS_MAP} />
			),
			meta: { mobileLabel: "Status" },
		}),
		costColumnHelper.display({
			id: "approval",
			header: "Aprovação",
			cell: (info) => {
				const approval = info.row.original.approval;
				if (!approval) {
					return <StatusBadge status="UNAVAILABLE" map={APPROVAL_STATUS_MAP} />;
				}
				return (
					<StatusBadge status={approval.status} map={APPROVAL_STATUS_MAP} />
				);
			},
			meta: { mobileLabel: "Aprovação" },
		}),
		costColumnHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => (
				<div className="flex items-center justify-end gap-1" data-no-row-click>
					{canApprovePendingItems &&
					info.row.original.approval?.status === "PENDING" &&
					info.row.original.approval.requestId ? (
						<>
							<Button
								variant="ghost"
								size="icon"
								title="Aprovar custo pendente"
								disabled={approvalMutation.isPending}
								onClick={() => {
									setApprovalDecision({
										requestId: info.row.original.approval?.requestId ?? "",
										decision: "APPROVE",
										costDescription: info.row.original.description ?? "Custo",
									});
									setApprovalReason("");
								}}
							>
								<CheckCircle2 className="h-4 w-4 text-emerald-600" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								title="Rejeitar custo pendente"
								disabled={approvalMutation.isPending}
								onClick={() => {
									setApprovalDecision({
										requestId: info.row.original.approval?.requestId ?? "",
										decision: "REJECT",
										costDescription: info.row.original.description ?? "Custo",
									});
									setApprovalReason("");
								}}
							>
								<XCircle className="h-4 w-4 text-destructive" />
							</Button>
						</>
					) : null}
					<Button
						variant="ghost"
						size="icon"
						onClick={() =>
							navigate({
								to: "/app/obras/$workId/custos/$costId/edit",
								params: { workId, costId: info.row.original.id },
							})
						}
					>
						<Pencil className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setDeleteId(info.row.original.id)}
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			),
			meta: { hideOnMobile: true },
		}),
	];

	if (costBudgetItemsLoading)
		return <LoadingSpinner title="Carregando itens do orçamento vigente..." />;
	if (costBudgetItemsError && data === null)
		return (
			<ErrorFeedback
				message="Não foi possível carregar os itens do orçamento vigente."
				onRetry={() => refetchCostBudgetItems()}
			/>
		);
	if (isLoading) return <LoadingSpinner title="Carregando custos..." />;
	if (error || !data || !Array.isArray(data.data))
		return <ErrorFeedback onRetry={() => refetch()} />;

	const costList = data.data ?? [];
	const totalCostCount = data.total ?? 0;
	const paginationMeta: PaginationMeta = getPaginationMeta(data);

	const handlePageChange = (page: number) => {
		navigate({ search: (prev) => ({ ...prev, page }) });
	};

	if (costList.length === 0) {
		return (
			<PageContainer>
				<PageHeader
					eyebrow="Obra"
					title="Custos Realizados"
					description="Nenhum custo registrado."
				/>
				<EmptyStateCard
					icon={DollarSign}
					title="Nenhum custo registrado"
					description="Importe uma planilha ou cadastre um custo manualmente."
					actions={
						<>
							<Button
								variant="default"
								size="sm"
								onClick={() =>
									navigate({
										to: "/app/obras/$workId/custos/new",
										params: { workId },
									})
								}
							>
								<Plus className="mr-2 h-4 w-4" />
								Novo custo
							</Button>
							<ImportBatchAction
								workId={workId}
								model="custos"
								buttonProps={{ variant: "outline", size: "sm" }}
							>
								<Download className="mr-2 h-4 w-4" />
								Importar planilha
							</ImportBatchAction>
						</>
					}
				/>
			</PageContainer>
		);
	}

	const totalAmount = costList.reduce((sum, c) => sum + (c.amount ?? 0), 0);
	const pendingApprovalCount = costList.filter(
		(cost) => cost.approval?.status === "PENDING",
	).length;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Custos Realizados"
				description={`${totalCostCount} custo(s) registrado(s)`}
				actions={
					<>
						<Button
							variant="default"
							size="sm"
							onClick={() =>
								navigate({
									to: "/app/obras/$workId/custos/new",
									params: { workId },
								})
							}
						>
							<Plus className="mr-2 h-4 w-4" />
							Novo custo
						</Button>
						<ImportBatchAction
							workId={workId}
							model="custos"
							buttonProps={{ variant: "outline", size: "sm" }}
						>
							<Download className="mr-2 h-4 w-4" />
							Importar planilha
						</ImportBatchAction>
						<Button variant="outline" size="sm" onClick={handleExport}>
							<FileSpreadsheet className="mr-2 h-4 w-4" />
							Exportar
						</Button>
					</>
				}
			/>
			<KpiGrid>
				<KpiCard
					title="Total de Custos"
					value={formatCurrency(totalAmount)}
					tone="danger"
				/>
				<KpiCard
					title="Quantidade"
					value={`${totalCostCount} custo(s)`}
					tone="default"
				/>
				<KpiCard
					title="Pendentes nesta página"
					value={`${pendingApprovalCount}`}
					tone={pendingApprovalCount > 0 ? "warning" : "default"}
				/>
			</KpiGrid>

			<Card className="mt-6">
				<CardHeaderWithIcon
					icon={Receipt}
					title="Lista de Custos"
					description={`${totalCostCount} custo(s) registrado(s)`}
				/>
				<CardContent>
					<DataTable
						columns={costColumns}
						data={costList}
						searchPlaceholder="Buscar custos..."
						onRowClick={(row) =>
							navigate({
								to: "/app/obras/$workId/custos/$costId",
								params: { workId, costId: row.id },
							})
						}
					/>
					<PaginationBar
						meta={paginationMeta}
						onPageChange={handlePageChange}
					/>
				</CardContent>
			</Card>

			<ConfirmDialog
				open={!!deleteId}
				title="Excluir custo?"
				description="Esta ação não pode ser desfeita."
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				onCancel={() => setDeleteId(null)}
				loading={deleteMutation.isPending}
			/>

			<Dialog
				open={approvalDecision !== null}
				onOpenChange={(open) => {
					if (!open && !approvalMutation.isPending) {
						setApprovalDecision(null);
						setApprovalReason("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{approvalDecision?.decision === "REJECT"
								? "Rejeitar custo pendente?"
								: "Aprovar custo pendente?"}
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						{approvalDecision?.costDescription}
					</p>
					{approvalDecision?.decision === "REJECT" ? (
						<Textarea
							value={approvalReason}
							onChange={(event) => setApprovalReason(event.target.value)}
							placeholder="Motivo da rejeição (obrigatório)"
							rows={3}
						/>
					) : null}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={approvalMutation.isPending}
							onClick={() => setApprovalDecision(null)}
						>
							Cancelar
						</Button>
						<Button
							variant={
								approvalDecision?.decision === "REJECT"
									? "destructive"
									: "default"
							}
							disabled={
								approvalMutation.isPending ||
								(approvalDecision?.decision === "REJECT" &&
									!approvalReason.trim())
							}
							loading={approvalMutation.isPending}
							onClick={() => approvalMutation.mutate()}
						>
							{approvalDecision?.decision === "REJECT" ? "Rejeitar" : "Aprovar"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
