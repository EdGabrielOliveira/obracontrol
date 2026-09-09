import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	DollarSign,
	Download,
	FileSpreadsheet,
	Plus,
	Receipt,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	type ActualCostFilter,
	type Cost,
	deleteCost,
	listCosts,
} from "@/api/costs";
import { exportCustos } from "@/api/export";
import { workKeys } from "@/api/query-keys";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { DataTable } from "@/components/atoms/data-table";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { ImportBatchAction } from "@/components/organisms/imports/import-batch-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { paginationSchema } from "@/schemas/pagination";
import type { PaginationMeta } from "@/types/shared";
import { CATEGORY_LABEL, formatCurrency, formatDate } from "@/utils/format";
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
const columnsHelper = createColumnHelper<Cost>();

export const Route = createFileRoute("/app/obras/$workId/custos/")({
	validateSearch: costFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ params, deps }) => {
		void queryClient.prefetchQuery({
			queryKey: workKeys.costsList(
				params.workId,
				deps.search as Record<string, unknown>,
			),
			queryFn: () => listCosts(params.workId, deps.search as ActualCostFilter),
		});
	},
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Custos - ObraControl" }] }),
});

function RouteComponent() {
	const { workId } = useParams({ from: "/app/obras/$workId/custos/" });
	const search = useSearch({ from: Route.id }) as CostFilter;
	const navigate = useNavigate({ from: Route.id });
	const client = useQueryClient();
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const costsQuery = useQuery({
		queryKey: workKeys.costsList(workId, search as Record<string, unknown>),
		queryFn: () => listCosts(workId, search),
		staleTime: 2 * 60 * 1000,
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteCost(workId, id),
		onSuccess: () => {
			toast.success("Custo excluído com todos os seus itens.");
			client.invalidateQueries({ queryKey: workKeys.costs(workId) });
			client.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			client.invalidateQueries({ queryKey: workKeys.bi(workId) });
			client.invalidateQueries({ queryKey: workKeys.management(workId) });
			client.invalidateQueries({ queryKey: workKeys.reports(workId) });
			setDeleteId(null);
		},
		onError: () => toast.error("Erro ao excluir custo."),
	});
	const goToNewCost = () =>
		navigate({ to: "/app/obras/$workId/custos/new", params: { workId } });
	const handleExport = async () => {
		try {
			downloadBlob(await exportCustos(workId), `custos-${workId}.xlsx`);
			toast.success("Exportação concluída!");
		} catch {
			toast.error("Erro ao exportar custos.");
		}
	};
	const columns = [
		columnsHelper.accessor("title", {
			header: "Custo",
			cell: (info) => (
				<div className="min-w-[13rem]">
					<p className="font-medium text-foreground">{info.getValue()}</p>
					<p className="text-xs text-muted-foreground">
						{info.row.original.itemCount} item(ns) de custo
					</p>
				</div>
			),
			meta: { mobileLabel: "Custo" },
		}),
		columnsHelper.accessor("categories", {
			header: "Categorias",
			cell: (info) =>
				info
					.getValue()
					.map((category) => CATEGORY_LABEL[category] ?? category)
					.join(", "),
			meta: { mobileLabel: "Categorias" },
		}),
		columnsHelper.accessor("amount", {
			header: "Valor total",
			cell: (info) => (
				<span className="font-medium">{formatCurrency(info.getValue())}</span>
			),
			meta: { mobileLabel: "Valor total" },
		}),
		columnsHelper.accessor("createdAt", {
			header: "Criado em",
			cell: (info) => formatDate(info.getValue()),
			meta: { mobileLabel: "Criado em" },
		}),
		columnsHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => (
				<div className="flex justify-end" data-no-row-click>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Excluir custo"
						onClick={() => setDeleteId(info.row.original.id)}
					>
						<Trash2 className="size-4 text-destructive" />
					</Button>
				</div>
			),
			meta: { hideOnMobile: true },
		}),
	];
	if (costsQuery.isLoading)
		return <LoadingSpinner title="Carregando custos..." />;
	if (
		costsQuery.error ||
		!costsQuery.data ||
		!Array.isArray(costsQuery.data.data)
	)
		return <ErrorFeedback onRetry={() => costsQuery.refetch()} />;
	const costs = costsQuery.data.data;
	const totalAmount = costs.reduce((sum, cost) => sum + cost.amount, 0);
	const totalItems = costs.reduce((sum, cost) => sum + cost.itemCount, 0);
	const pagination: PaginationMeta = getPaginationMeta(costsQuery.data);
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Custos realizados"
				description={`${costsQuery.data.total ?? 0} custo(s) registrado(s)`}
				actions={
					<>
						<Button size="sm" onClick={goToNewCost}>
							<Plus className="mr-2 size-4" />
							Novo custo
						</Button>
						<ImportBatchAction
							workId={workId}
							model="custos"
							buttonProps={{ variant: "outline", size: "sm" }}
						>
							<Download className="mr-2 size-4" />
							Importar planilha
						</ImportBatchAction>
						<Button variant="outline" size="sm" onClick={handleExport}>
							<FileSpreadsheet className="mr-2 size-4" />
							Exportar
						</Button>
					</>
				}
			/>
			{costs.length === 0 ? (
				<EmptyStateCard
					icon={DollarSign}
					title="Nenhum custo registrado"
					description="Crie um custo com vários itens ou importe uma planilha completa."
					actions={
						<Button onClick={goToNewCost}>
							<Plus className="mr-2 size-4" />
							Novo custo
						</Button>
					}
				/>
			) : (
				<>
					<KpiGrid>
						<KpiCard
							title="Total nesta página"
							value={formatCurrency(totalAmount)}
							tone="danger"
						/>
						<KpiCard
							title="Custos"
							value={`${costsQuery.data.total ?? 0}`}
							tone="default"
						/>
						<KpiCard
							title="Itens nesta página"
							value={`${totalItems}`}
							tone="default"
						/>
					</KpiGrid>
					<Card className="mt-6">
						<CardHeaderWithIcon
							icon={Receipt}
							title="Lista de custos"
							description="Cada custo pode conter vários itens do orçamento."
						/>
						<CardContent>
							<DataTable
								columns={columns}
								data={costs}
								searchPlaceholder="Buscar custos..."
								onRowClick={(row) =>
									navigate({
										to: "/app/obras/$workId/custos/$costId",
										params: { workId, costId: row.id },
									})
								}
							/>
							<PaginationBar
								meta={pagination}
								onPageChange={(page) =>
									navigate({ search: (previous) => ({ ...previous, page }) })
								}
							/>
						</CardContent>
					</Card>
				</>
			)}
			<ConfirmDialog
				open={Boolean(deleteId)}
				title="Excluir custo?"
				description="Todos os itens deste custo serão excluídos. Esta ação não pode ser desfeita."
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				onCancel={() => setDeleteId(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
