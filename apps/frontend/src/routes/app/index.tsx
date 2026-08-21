import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	BarChart3,
	Building2,
	CheckCircle2,
	ClipboardList,
	Clock3,
	FolderTree,
	Layers,
	ReceiptText,
	ShieldCheck,
	TriangleAlert,
	Truck,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { getDashboardSummary } from "@/api/dashboard";
import { dashboardKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";

const LazyBarChartCard = lazy(async () => {
	const module = await import("@/components/organisms/charts/bar-chart-card");
	return { default: module.BarChartCard };
});

export const Route = createFileRoute("/app/")({
	beforeLoad: requireManagementAccess,
	loader: () => {
		void queryClient.prefetchQuery({
			queryKey: dashboardKeys.summary,
			queryFn: getDashboardSummary,
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Dashboard - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const [showCharts, setShowCharts] = useState(false);

	useEffect(() => {
		const timer = window.setTimeout(() => setShowCharts(true), 800);
		return () => window.clearTimeout(timer);
	}, []);

	const {
		data: summary,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: dashboardKeys.summary,
		queryFn: getDashboardSummary,
	});

	if (isLoading) return <LoadingSpinner title="Carregando..." />;

	if (error) return <ErrorFeedback onRetry={() => refetch()} />;

	if (!summary) return <ErrorFeedback onRetry={() => refetch()} />;

	const orgTotal = summary.organizations;
	const ccTotal = summary.costCenters;
	const obraTotal = summary.works.total;
	const suppliersTotal = summary.suppliers;

	if (orgTotal === 0) {
		return (
			<PageContainer
				DesktopHeader={
					<PageHeader
						title="Bem-vindo ao ObraControl"
						description="Gestão e inteligência de obras"
					/>
				}
			>
				<div className="mx-auto max-w-2xl space-y-8 py-8">
					<Card className="border border-primary/20 bg-primary/[0.04]">
						<CardContent className="pt-8 pb-8 text-center">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
								<Building2 className="h-8 w-8 text-primary" />
							</div>
							<h2 className="text-xl font-semibold leading-snug text-foreground">
								Vamos começar!
							</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								Para usar o ObraControl, você precisa criar sua primeira
								Organização. Uma Organização representa o órgão ou empresa
								responsável pelas obras.
							</p>
							<Button
								size="lg"
								className="mt-6 gap-2"
								onClick={() => navigate({ to: "/app/organizacoes/new" })}
							>
								Criar organização <ArrowRight className="h-4 w-4" />
							</Button>
						</CardContent>
					</Card>

					<div className="space-y-4">
						<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
							Como funciona
						</h3>
						<div className="grid gap-4 sm:grid-cols-2">
							<Card className="border-border">
								<CardContent className="pt-6 text-center">
									<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
										<Building2 className="h-5 w-5 text-primary" />
									</div>
									<p className="text-sm font-semibold text-foreground">
										1. Organização
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Crie o órgão responsável
									</p>
								</CardContent>
							</Card>
							<Card className="border-border">
								<CardContent className="pt-6 text-center">
									<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
										<FolderTree className="h-5 w-5 text-accent-foreground" />
									</div>
									<p className="text-sm font-semibold text-foreground">
										2. Centro de Custo
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Agrupe obras por CC
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					title="ObraControl"
					description="Gestão e inteligência de obras"
				/>
			}
		>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={Building2}
						title="Órgãos"
						description="Total cadastrado"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{orgTotal}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={FolderTree}
						title="Centros de Custo"
						description="Total cadastrado"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{ccTotal}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={Layers}
						title="Obras"
						description="Total cadastrado"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{obraTotal}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={Truck}
						title="Fornecedores"
						description="Total cadastrado"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{suppliersTotal}
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={ClipboardList}
						title="Contratos pendentes"
						description="Aguardando conclusão"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{summary.pendingContracts}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={ShieldCheck}
						title="Aprovações pendentes"
						description="Aguardando decisão"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{summary.pendingApprovals}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={TriangleAlert}
						title="Obras em risco"
						description="Atraso ou estouro de custo"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{summary.worksAtRisk}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={ReceiptText}
						title="Custos pendentes"
						description="Aguardando pagamento"
					/>
					<CardContent>
						<p className="text-2xl font-semibold leading-tight text-foreground">
							{summary.pendingCosts}
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Card
					className="cursor-pointer border-border transition-colors hover:bg-accent/50"
					onClick={() => navigate({ to: "/app/organizacoes" })}
				>
					<div className="flex items-center gap-4 pr-6">
						<CardHeaderWithIcon
							icon={Building2}
							title="Organizações"
							description="Gerencie órgãos e centros de custo"
							className="flex-1"
						/>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
					</div>
				</Card>
				<Card
					className="cursor-pointer border-border transition-colors hover:bg-accent/50"
					onClick={() => navigate({ to: "/app/obras" })}
				>
					<div className="flex items-center gap-4 pr-6">
						<CardHeaderWithIcon
							icon={Layers}
							title="Obras"
							description="Configure integrações"
							className="flex-1"
						/>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
					</div>
				</Card>

				<Card
					className="cursor-pointer border-border transition-colors hover:bg-accent/50"
					onClick={() => navigate({ to: "/app/fornecedores" })}
				>
					<div className="flex items-center gap-4 pr-6">
						<CardHeaderWithIcon
							icon={Truck}
							title="Fornecedores"
							description="Consulte valores e vínculos"
							className="flex-1"
						/>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
					</div>
				</Card>
			</div>

			<div className="mt-8">
				<Card className="border-border">
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Status das obras"
						description="Distribuição atual das obras no seu escopo"
					/>
					<CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div className="status-info flex items-center gap-3 rounded-lg p-4">
							<Clock3 className="h-5 w-5 text-info" />
							<div>
								<p className="text-2xl font-semibold">
									{summary.works.byStatus.IN_PROGRESS}
								</p>
								<p className="text-xs text-muted-foreground">Em andamento</p>
							</div>
						</div>
						<div className="status-success flex items-center gap-3 rounded-lg p-4">
							<CheckCircle2 className="h-5 w-5 text-success" />
							<div>
								<p className="text-2xl font-semibold">
									{summary.works.byStatus.DONE}
								</p>
								<p className="text-xs text-muted-foreground">Concluídas</p>
							</div>
						</div>
						<div className="flex items-center gap-3 rounded-lg bg-muted p-4">
							<Layers className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-2xl font-semibold">
									{summary.works.byStatus.NOT_STARTED}
								</p>
								<p className="text-xs text-muted-foreground">Não iniciadas</p>
							</div>
						</div>
						<div className="status-warning flex items-center gap-3 rounded-lg p-4">
							<Clock3 className="h-5 w-5 text-warning" />
							<div>
								<p className="text-2xl font-semibold">
									{summary.works.byStatus.SUSPENDED}
								</p>
								<p className="text-xs text-muted-foreground">Suspensas</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="mt-8">
				{showCharts ? (
					<Suspense
						fallback={
							<div className="h-[220px] rounded-lg border border-border" />
						}
					>
						<LazyBarChartCard
							icon={BarChart3}
							title="Visão geral"
							description="Resumo das entidades cadastradas"
							data={[
								{ name: "Órgãos", value: orgTotal },
								{ name: "Centros de Custo", value: ccTotal },
								{ name: "Obras", value: obraTotal },
							]}
							dataKey="value"
							height={220}
							layout="horizontal"
						/>
					</Suspense>
				) : (
					<div className="h-[220px] rounded-lg border border-border" />
				)}
			</div>
		</PageContainer>
	);
}
