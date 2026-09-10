import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleDollarSign, Info, ListTree, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCost, getCost } from "@/api/costs";
import { workKeys } from "@/api/query-keys";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { CostDetailItems } from "@/components/organisms/costs/cost-detail-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";
import { CATEGORY_LABEL, formatCurrency, formatDate } from "@/utils/format";

function InfoItem({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-w-0 rounded-xl border border-border/70 bg-muted/20 p-3">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<div className="mt-1.5 text-sm font-medium text-foreground">
				{children}
			</div>
		</div>
	);
}

export const Route = createFileRoute("/app/obras/$workId/custos/$costId/")({
	loader: ({ params }) => {
		void queryClient.prefetchQuery({
			queryKey: workKeys.groupedCostDetail(params.workId, params.costId),
			queryFn: () => getCost(params.workId, params.costId),
		});
	},
	component: RouteComponent,
	head: () => ({ meta: [{ title: "Custo - ObraControl" }] }),
});

function RouteComponent() {
	const { workId, costId } = Route.useParams();
	const navigate = useNavigate();
	const client = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const costQuery = useQuery({
		queryKey: workKeys.groupedCostDetail(workId, costId),
		queryFn: () => getCost(workId, costId),
	});
	const deleteMutation = useMutation({
		mutationFn: () => deleteCost(workId, costId),
		onSuccess: () => {
			toast.success("Custo excluído com todos os seus itens.");
			client.invalidateQueries({ queryKey: workKeys.costs(workId) });
			client.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			client.invalidateQueries({ queryKey: workKeys.bi(workId) });
			navigate({ to: "/app/obras/$workId/custos", params: { workId } });
		},
		onError: () => toast.error("Erro ao excluir custo."),
	});

	if (costQuery.isLoading)
		return <LoadingSpinner title="Carregando custo..." />;
	if (costQuery.error || !costQuery.data)
		return <ErrorFeedback onRetry={() => costQuery.refetch()} />;

	const cost = costQuery.data;
	const items = Array.isArray(cost.items) ? cost.items : [];
	const persistedAmount = Number(cost.amount);
	const totalAmount = Number.isFinite(persistedAmount)
		? persistedAmount
		: items.reduce((sum, item) => sum + Number(item.amount), 0);
	const paidAmount = items
		.filter((item) => item.paymentStatus === "PAID")
		.reduce((sum, item) => sum + Number(item.amount), 0);
	const openAmount = totalAmount - paidAmount;
	const currentAmount = items
		.filter((item) => item.costType === "CURRENT" || item.costType === "ATUAL")
		.reduce((sum, item) => sum + Number(item.amount), 0);
	const categories = [...new Set(items.map((item) => item.category))];
	const dates = items
		.map((item) => item.costDate)
		.filter((date): date is string => Boolean(date))
		.sort();
	const firstDate = dates[0];
	const lastDate = dates.at(-1);

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Custos realizados"
				title={cost.title}
				description={`${items.length} item(ns) · ${formatCurrency(totalAmount)}`}
				actions={
					<>
						<Link
							to="/app/obras/$workId/custos/$costId/edit"
							params={{ workId, costId }}
						>
							<Button size="sm">
								<Pencil className="mr-2 size-4" />
								Editar custo
							</Button>
						</Link>
						<Button
							size="sm"
							variant="destructive"
							onClick={() => setDeleteOpen(true)}
						>
							<Trash2 className="mr-2 size-4" />
							Excluir
						</Button>
					</>
				}
			/>

			<KpiGrid className="xl:grid-cols-4">
				<KpiCard
					title="Valor total"
					value={formatCurrency(totalAmount)}
					tone="danger"
					tooltip="Soma dos valores de todos os itens deste custo."
				/>
				<KpiCard title="Itens lançados" value={items.length} />
				<KpiCard title="Categorias" value={categories.length} />
				<KpiCard
					title="Em aberto"
					value={formatCurrency(openAmount)}
					tone="warning"
					tooltip="Valor dos itens ainda não marcados como pagos."
				/>
			</KpiGrid>

			<div className="mt-4 flex flex-col gap-4">
				<Card className="gap-4 py-5">
					<CardHeaderWithIcon
						icon={Info}
						title="Informações gerais"
						description="Resumo rápido da composição deste custo."
					/>
					<CardContent className="grid gap-2 sm:grid-cols-2">
						<InfoItem label="Origem">
							{cost.importId ? "Importação de planilha" : "Lançamento manual"}
						</InfoItem>
						<InfoItem label="Pagamento">
							<div className="flex flex-wrap gap-2">
								<Badge variant="outline" tone="success">
									Pago {formatCurrency(paidAmount)}
								</Badge>
								<Badge variant="outline" tone="warning">
									Aberto {formatCurrency(openAmount)}
								</Badge>
							</div>
						</InfoItem>
						<InfoItem label="Período">
							{firstDate && lastDate && firstDate !== lastDate
								? `${formatDate(firstDate)} a ${formatDate(lastDate)}`
								: formatDate(firstDate)}
						</InfoItem>
						<InfoItem label="Tipo de custo">
							<div className="flex flex-wrap gap-2">
								<Badge variant="outline" tone="success">
									Atual {formatCurrency(currentAmount)}
								</Badge>
								<Badge variant="outline" tone="warning">
									Futuro {formatCurrency(totalAmount - currentAmount)}
								</Badge>
							</div>
						</InfoItem>
					</CardContent>
				</Card>

				<Card className="gap-4 py-5">
					<CardHeaderWithIcon
						icon={CircleDollarSign}
						title="Custo por categoria"
						description="Distribuição do valor total."
					/>
					<CardContent className="space-y-3">
						{categories.length === 0 ? (
							<p className="py-4 text-sm text-muted-foreground">
								Nenhuma categoria informada.
							</p>
						) : (
							categories.map((category) => {
								const categoryTotal = items
									.filter((item) => item.category === category)
									.reduce((sum, item) => sum + Number(item.amount), 0);
								const share =
									totalAmount > 0 ? (categoryTotal / totalAmount) * 100 : 0;
								return (
									<div key={category} className="space-y-1.5">
										<div className="flex items-center justify-between gap-2 text-sm">
											<span className="truncate font-medium">
												{CATEGORY_LABEL[category] ?? category}
											</span>
											<span className="shrink-0 font-semibold">
												{formatCurrency(categoryTotal)}
											</span>
										</div>
										<div className="h-1.5 overflow-hidden rounded-xl bg-muted">
											<div
												className="h-full rounded-xl bg-primary"
												style={{ width: `${share}%` }}
											/>
										</div>
										<p className="text-right text-[11px] text-muted-foreground">
											{share.toFixed(1).replace(".", ",")}% ·{" "}
											{
												items.filter((item) => item.category === category)
													.length
											}{" "}
											item(ns)
										</p>
									</div>
								);
							})
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="mt-4 gap-4 py-5">
				<CardHeaderWithIcon
					icon={ListTree}
					title={`Itens de custo (${items.length})`}
					description="Consulte os lançamentos agrupados por etapa e filtre pelos principais campos financeiros."
				/>
				<CardContent className="min-w-0">
					<CostDetailItems items={items} totalAmount={totalAmount} />
				</CardContent>
			</Card>

			<ConfirmDialog
				open={deleteOpen}
				title="Excluir custo?"
				description="Todos os itens deste custo serão excluídos. Esta ação não pode ser desfeita."
				onConfirm={() => deleteMutation.mutate()}
				onCancel={() => setDeleteOpen(false)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
