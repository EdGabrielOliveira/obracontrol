import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	FileText,
	Info,
	ListTree,
	Pencil,
	Trash2,
	TriangleAlert,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCurrentCostBudgetItems } from "@/api/budget";
import { deleteActualCost, getActualCost } from "@/api/costs";
import { decideApproval } from "@/api/governance";
import { governanceKeys, workKeys, workSupplierKeys } from "@/api/query-keys";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { canDecideSupervisorRequests } from "@/lib/role-permissions";
import {
	CATEGORY_LABEL,
	COST_TYPE_LABEL,
	formatCurrency,
	formatDate,
	PAYMENT_STATUS_LABEL,
} from "@/utils/format";

export const Route = createFileRoute("/app/obras/$workId/custos/$costId/")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.costDetail(params.workId, params.costId),
				queryFn: () => getActualCost(params.workId, params.costId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.costBudgetItems(params.workId),
				queryFn: () => getCurrentCostBudgetItems(params.workId),
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

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-right text-sm font-medium">{value || "—"}</dd>
		</div>
	);
}

function RouteComponent() {
	const { workId, costId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { role, capabilities } = useAuth();
	const canApprovePendingItems =
		role === "ADMIN" ||
		role === "GERENTE" ||
		canDecideSupervisorRequests(capabilities);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [approvalDecision, setApprovalDecision] = useState<{
		decision: "APPROVE" | "REJECT";
		costDescription: string;
		requestId: string;
	} | null>(null);
	const [approvalReason, setApprovalReason] = useState("");
	const costQuery = useQuery({
		queryKey: workKeys.costDetail(workId, costId),
		queryFn: () => getActualCost(workId, costId),
	});
	const deleteMutation = useMutation({
		mutationFn: () => deleteActualCost(workId, costId),
		onSuccess: () => {
			toast.success("Custo excluído.");
			queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
			navigate({ to: "/app/obras/$workId/custos", params: { workId } });
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
			queryClient.invalidateQueries({
				queryKey: workKeys.costDetail(workId, costId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			queryClient.invalidateQueries({ queryKey: governanceKeys.all });
			setApprovalDecision(null);
			setApprovalReason("");
		},
		onError: () => toast.error("Não foi possível registrar a decisão."),
	});

	if (costQuery.isLoading)
		return <LoadingSpinner title="Carregando custo..." />;
	if (costQuery.error || !costQuery.data)
		return <ErrorFeedback onRetry={() => costQuery.refetch()} />;

	const cost = costQuery.data;
	const pendingApproval =
		canApprovePendingItems &&
		cost.approval?.status === "PENDING" &&
		Boolean(cost.approval.requestId);
	const title =
		cost.description || CATEGORY_LABEL[cost.category] || "Custo realizado";
	const items = cost.budgetVersionItem
		? [
				{
					id: cost.budgetVersionItem.versionItemId,
					index: cost.budgetVersionItem.displayIndex,
					description: cost.budgetVersionItem.description,
					unit: cost.budgetVersionItem.unit,
					version: cost.budgetVersionItem.versionLabel,
				},
			]
		: (cost.allocations ?? []).map((allocation) => ({
				id: allocation.id,
				index: allocation.budgetItem?.index ?? "—",
				description: allocation.budgetItem?.description ?? "Item de orçamento",
				unit: allocation.budgetItem?.unit ?? null,
				version: "Histórico",
			}));
	const isUnappropriated =
		cost.appropriationStatus === "UNAPPROPRIATED" || items.length === 0;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Custos realizados"
				title={title}
				description={`${formatDate(cost.costDate)} · ${formatCurrency(cost.amount)}`}
				actions={
					<>
						<Link to="/app/obras/$workId/custos" params={{ workId }}>
							<Button variant="outline">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Voltar
							</Button>
						</Link>
						<Button
							variant="outline"
							onClick={() =>
								navigate({
									to: "/app/obras/$workId/custos/$costId/edit",
									params: { workId, costId },
								})
							}
						>
							<Pencil className="mr-2 h-4 w-4" />
							Editar
						</Button>
						{pendingApproval ? (
							<>
								<Button
									variant="outline"
									disabled={approvalMutation.isPending}
									onClick={() => {
										setApprovalDecision({
											requestId: cost.approval?.requestId ?? "",
											decision: "APPROVE",
											costDescription: title,
										});
										setApprovalReason("");
									}}
								>
									<CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
									Aprovar
								</Button>
								<Button
									variant="destructive"
									disabled={approvalMutation.isPending}
									onClick={() => {
										setApprovalDecision({
											requestId: cost.approval?.requestId ?? "",
											decision: "REJECT",
											costDescription: title,
										});
										setApprovalReason("");
									}}
								>
									<XCircle className="mr-2 h-4 w-4" />
									Recusar
								</Button>
							</>
						) : null}
						<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
							<Trash2 className="mr-2 h-4 w-4" />
							Excluir
						</Button>
					</>
				}
			/>

			{isUnappropriated && (
				<div className="status-warning mb-6 flex items-start gap-2 rounded-lg p-4 text-sm">
					<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
					<span>
						Este custo ainda não está apropriado a um item do orçamento.
					</span>
				</div>
			)}

			<div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
				<Card>
					<CardHeaderWithIcon
						icon={Info}
						title="Resumo do custo"
						description="Dados principais do lançamento."
					/>
					<CardContent>
						<dl>
							<DetailRow label="Título" value={title} />
							<DetailRow label="Valor" value={formatCurrency(cost.amount)} />
							<DetailRow label="Data" value={formatDate(cost.costDate)} />
							<DetailRow
								label="Categoria"
								value={CATEGORY_LABEL[cost.category] ?? cost.category}
							/>
							<DetailRow
								label="Tipo"
								value={COST_TYPE_LABEL[cost.costType] ?? cost.costType}
							/>
							<DetailRow
								label="Status"
								value={
									PAYMENT_STATUS_LABEL[cost.paymentStatus] ?? cost.paymentStatus
								}
							/>
							<DetailRow
								label="Fornecedor"
								value={cost.supplier?.name ?? cost.supplierName ?? ""}
							/>
						</dl>
						<div className="mt-4 flex flex-wrap gap-2">
							<Badge variant="outline">
								{COST_TYPE_LABEL[cost.costType] ?? cost.costType}
							</Badge>
							<Badge variant="outline">
								{PAYMENT_STATUS_LABEL[cost.paymentStatus] ?? cost.paymentStatus}
							</Badge>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeaderWithIcon
						icon={ListTree}
						title={`Itens do orçamento (${items.length})`}
						description="Itens orçamentários vinculados."
					/>
					<CardContent>
						{items.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Nenhum item vinculado.
							</p>
						) : (
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Índice</TableHead>
											<TableHead>Descrição</TableHead>
											<TableHead>Unidade</TableHead>
											<TableHead>Versão</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{items.map((item) => (
											<TableRow key={item.id}>
												<TableCell className="font-medium">
													{item.index}
												</TableCell>
												<TableCell>{item.description}</TableCell>
												<TableCell>{item.unit ?? "—"}</TableCell>
												<TableCell>{item.version}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="mt-4">
				<CardHeaderWithIcon
					icon={FileText}
					title="Informações complementares"
					description="Observações e dados adicionais."
				/>
				<CardContent>
					<p className="whitespace-pre-wrap text-sm text-muted-foreground">
						{cost.description || "Nenhuma observação informada."}
					</p>
				</CardContent>
			</Card>

			<ConfirmDialog
				open={deleteOpen}
				title="Excluir custo?"
				description="Esta ação não pode ser desfeita."
				onConfirm={() => deleteMutation.mutate()}
				onCancel={() => setDeleteOpen(false)}
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
								? "Recusar custo pendente?"
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
							placeholder="Motivo da recusa (obrigatório)"
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
							{approvalDecision?.decision === "REJECT" ? "Recusar" : "Aprovar"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
