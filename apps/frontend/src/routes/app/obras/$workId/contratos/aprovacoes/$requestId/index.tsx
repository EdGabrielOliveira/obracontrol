import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { getApprovalRequest } from "@/api/governance";
import { governanceKeys } from "@/api/query-keys";
import { APPROVAL_STATUS_MAP, StatusBadge } from "@/components/atoms/status-badge";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";
import { APPROVAL_ACTION_LABELS } from "@/components/organisms/works/approvals-tab";
import { formatCurrency, formatDate } from "@/utils/format";

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/aprovacoes/$requestId/",
)({
	loader: ({ params }) =>
		queryClient.prefetchQuery({
			queryKey: governanceKeys.approvalDetail(params.requestId),
			queryFn: () => getApprovalRequest(params.requestId),
		}),
	component: ApprovalDetailRoute,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Aprovação de contrato - ObraControl" },
		],
	}),
});

function ApprovalDetailRoute() {
	const { workId, requestId } = useParams({
		from: "/app/obras/$workId/contratos/aprovacoes/$requestId/",
	});
	const navigate = useNavigate({ from: Route.id });
	const query = useQuery({
		queryKey: governanceKeys.approvalDetail(requestId),
		queryFn: () => getApprovalRequest(requestId),
	});

	if (query.isLoading) return <LoadingSpinner title="Carregando solicitação..." />;
	if (query.error || !query.data) return <ErrorFeedback onRetry={() => query.refetch()} />;

	const approval = query.data;
	const payload = approval.payload as {
		workId?: string;
		contract?: {
			code?: string;
			title?: string | null;
			serviceType?: string | null;
			supplierName?: string;
			contractValue?: number;
			objectDescription?: string | null;
			startDate?: string | null;
			endDate?: string | null;
			notes?: string | null;
		};
	} | null;
	const contract = payload?.contract;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contratos / Aprovação"
				title={contract?.title ?? contract?.code ?? "Solicitação de contrato"}
				description="Confira os dados enviados e o resultado da análise."
				actions={
					<Button
						variant="outline"
						onClick={() =>
							navigate({
								to: "/app/obras/$workId/contratos",
								params: { workId },
							})
						}
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Voltar
					</Button>
				}
			/>
			<Card>
				<CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
					<Info
						label="Ação"
						value={
							APPROVAL_ACTION_LABELS[approval.effectAction] ??
							approval.effectAction
						}
					/>
					<div>
						<p className="text-sm text-muted-foreground">Status</p>
						<StatusBadge status={approval.status} map={APPROVAL_STATUS_MAP} />
					</div>
					<Info label="Fornecedor" value={contract?.supplierName ?? "Não informado"} />
					<Info label="Valor" value={formatCurrency(contract?.contractValue ?? 0)} />
					<Info label="Serviço" value={contract?.serviceType ?? "Não informado"} />
					<Info
						label="Período"
						value={`${formatDate(contract?.startDate ?? null)} até ${formatDate(contract?.endDate ?? null)}`}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="space-y-4 pt-6">
					<div className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-primary" />
						<h2 className="font-semibold">Descrição da solicitação</h2>
					</div>
					<p className="whitespace-pre-wrap text-sm text-muted-foreground">
						{contract?.objectDescription ?? approval.description ?? "Não informada."}
					</p>
					{approval.status === "REJECTED" && approval.decisionReason ? (
						<div className="status-danger rounded-md p-3 text-sm">
							<p className="font-semibold">Motivo da rejeição</p>
							<p className="mt-1 whitespace-pre-wrap">{approval.decisionReason}</p>
						</div>
					) : null}
				</CardContent>
			</Card>
		</PageContainer>
	);
}

function Info({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="font-medium">{value}</p>
		</div>
	);
}
