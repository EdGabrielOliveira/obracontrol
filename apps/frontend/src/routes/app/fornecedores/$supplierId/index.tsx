import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowUpRight,
	BarChart3,
	BriefcaseBusiness,
	Building2,
	DollarSign,
	FileText,
	Receipt,
} from "lucide-react";
import { supplierKeys } from "@/api/query-keys";
import { getSupplier, getSupplierAnalytics } from "@/api/suppliers";
import { EmptyStateCard } from "@/atoms/empty-state-card";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	CONTRACT_STATUS_MAP,
	PAYMENT_STATUS_MAP,
	StatusBadge,
	SUPPLIER_STATUS_MAP,
	WORK_SUPPLIER_STATUS_MAP,
} from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";
import { formatCurrency } from "@/utils/format";

export const Route = createFileRoute("/app/fornecedores/$supplierId/")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: supplierKeys.detail(params.supplierId),
				queryFn: () => getSupplier(params.supplierId),
			}),
			queryClient.prefetchQuery({
				queryKey: supplierKeys.analytics(),
				queryFn: getSupplierAnalytics,
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Fornecedores - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { supplierId } = Route.useParams();
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: supplierKeys.detail(supplierId),
		queryFn: () => getSupplier(supplierId),
	});
	const analyticsQuery = useQuery({
		queryKey: supplierKeys.analytics(),
		queryFn: getSupplierAnalytics,
	});

	if (isLoading) return <LoadingSpinner title="Carregando fornecedor..." />;
	if (analyticsQuery.isLoading)
		return <LoadingSpinner title="Carregando métricas..." />;
	if (error || analyticsQuery.error) {
		return (
			<ErrorFeedback
				onRetry={() => {
					void refetch();
					void analyticsQuery.refetch();
				}}
			/>
		);
	}
	if (!data) return <PageContainer>Fornecedor não encontrado.</PageContainer>;

	const { supplier, contracts, actualCosts, workLinks } = data;
	const analytics = analyticsQuery.data?.find(
		(item) => item.supplierId === supplier.id,
	);
	const totalCosts = actualCosts.reduce(
		(total, cost) => total + Number(cost.amount),
		0,
	);
	const paidCosts = actualCosts.reduce(
		(total, cost) =>
			total + (cost.paymentStatus === "PAID" ? Number(cost.amount) : 0),
		0,
	);
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Cadastros"
				title={supplier.name}
				description="Dados cadastrais, contratos, custos e obras vinculadas"
				actions={
					<Link to="/app/fornecedores">
						<Button variant="outline">
							<ArrowLeft className="mr-2 h-4 w-4" /> Voltar
						</Button>
					</Link>
				}
			/>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeaderWithIcon
						icon={DollarSign}
						title="Valor contratado"
						description="Total contratado com este fornecedor."
					/>
					<CardContent className="text-2xl font-semibold">
						{formatCurrency(analytics?.contractedAmount ?? 0)}
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={Receipt}
						title="Pago em contratos"
						description="Total pago em contratos."
					/>
					<CardContent className="text-2xl font-semibold">
						{formatCurrency(analytics?.paidAmount ?? 0)}
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Custos lançados"
						description="Total de custos lançados."
					/>
					<CardContent className="text-2xl font-semibold">
						{formatCurrency(totalCosts)}
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={DollarSign}
						title="Custos pagos"
						description="Total de custos pagos."
					/>
					<CardContent className="text-2xl font-semibold">
						{formatCurrency(paidCosts)}
					</CardContent>
				</Card>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Histórico e métricas"
						description="Indicadores de relacionamento e desempenho."
					/>
					<CardContent className="grid grid-cols-2 gap-3 text-sm">
						<p>
							<strong>Contratos:</strong>{" "}
							{analytics?.contractCount ?? contracts.length}
						</p>
						<p>
							<strong>Rodadas:</strong> {analytics?.roundCount ?? 0}
						</p>
						<p>
							<strong>Propostas:</strong> {analytics?.proposalCount ?? 0}
						</p>
						<p>
							<strong>Negociações:</strong> {analytics?.negotiationCount ?? 0}
						</p>
						<p>
							<strong>Valor ganho:</strong>{" "}
							{analytics?.awardedValue?.toLocaleString("pt-BR", {
								style: "currency",
								currency: "BRL",
							}) ?? "—"}
						</p>
						<p>
							<strong>Redução:</strong>{" "}
							{analytics?.reductionPercent == null
								? "—"
								: `${analytics.reductionPercent.toFixed(2)}%`}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={Building2}
						title="Dados cadastrais"
						description="Documento, contato e endereço."
					/>
					<CardContent className="space-y-2 text-sm">
						<p>
							<strong>Documento:</strong> {supplier.document ?? "—"}
						</p>
						<p>
							<strong>Contato:</strong> {supplier.contact ?? "—"}
						</p>
						<p>
							<strong>Endereço:</strong>{" "}
							{[
								supplier.addressStreet,
								supplier.addressNumber,
								supplier.addressCity,
								supplier.addressState,
							]
								.filter(Boolean)
								.join(", ") || "—"}
						</p>
						<p>
							<strong>Status:</strong>{" "}
							<StatusBadge status={supplier.status} map={SUPPLIER_STATUS_MAP} />
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={BriefcaseBusiness}
						title={`Obras vinculadas (${workLinks.length})`}
						description="Obras relacionadas ao fornecedor."
					/>
					<CardContent className="space-y-2 text-sm">
						{workLinks.length === 0 ? (
							<EmptyStateCard
								icon={BriefcaseBusiness}
								title="Nenhuma obra vinculada."
								variant="dashed"
							/>
						) : (
							workLinks.map((link) => (
								<p key={link.id}>
									<Link
										to="/app/obras/$workId"
										params={{ workId: link.work.id }}
										className="link-navigation mr-2 inline-flex items-center"
									>
										Abrir obra <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
									</Link>
									{link.work.name} —{" "}
									<StatusBadge
										status={link.status}
										map={WORK_SUPPLIER_STATUS_MAP}
									/>
								</p>
							))
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={FileText}
						title={`Contratos (${contracts.length})`}
						description="Contratos relacionados ao fornecedor."
					/>
					<CardContent className="space-y-2 text-sm">
						{contracts.length === 0 ? (
							<EmptyStateCard
								icon={FileText}
								title="Nenhum contrato vinculado."
								variant="dashed"
							/>
						) : (
							contracts.map((contract) => (
								<p key={contract.id}>
									<Link
										to="/app/obras/$workId"
										params={{ workId: contract.work.id }}
										className="link-navigation mr-2 inline-flex items-center"
									>
										Abrir obra <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
									</Link>
									{contract.code} — {contract.work.name} —{" "}
									{String(contract.contractValue)} —{" "}
									<StatusBadge
										status={contract.status}
										map={CONTRACT_STATUS_MAP}
									/>
								</p>
							))
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title={`Custos (${actualCosts.length})`}
						description="Custos lançados para o fornecedor."
					/>
					<CardContent className="space-y-2 text-sm">
						{actualCosts.length === 0 ? (
							<EmptyStateCard
								icon={BarChart3}
								title="Nenhum custo vinculado."
								variant="dashed"
							/>
						) : (
							actualCosts.map((cost) => (
								<p key={cost.id}>
									<Link
										to="/app/obras/$workId"
										params={{ workId: cost.work.id }}
										className="link-navigation mr-2 inline-flex items-center"
									>
										Abrir obra <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
									</Link>
									{cost.work.name} — {cost.description ?? cost.category} —{" "}
									{String(cost.amount)} —{" "}
									<StatusBadge
										status={cost.paymentStatus}
										map={PAYMENT_STATUS_MAP}
									/>
								</p>
							))
						)}
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
