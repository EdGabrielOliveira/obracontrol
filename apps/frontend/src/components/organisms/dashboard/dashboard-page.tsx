import {
	BarChart3,
	Building2,
	CircleDollarSign,
	HardHat,
	ScatterChart,
	TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { lazy, Suspense, useMemo } from "react";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageHeader } from "@/components/atoms/page-header";
import { SearchInput } from "@/components/atoms/search-input";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { CriticalAlerts } from "@/components/organisms/bi/critical-alerts";
import { HealthCards } from "@/components/organisms/bi/health-cards";
import { PortfolioProjections } from "@/components/organisms/bi/portfolio-projections";
import { Rankings } from "@/components/organisms/bi/rankings";
import { TopRankings } from "@/components/organisms/bi/top-rankings";
import { WorksHealthTable } from "@/components/organisms/bi/works-health-table";
import { Card, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { DashboardScope, DashboardSearch } from "@/schemas/dashboard";
import type { MultiworksBIResponse, WorkBIResponse } from "@/types/bi";
import type { ContractSummaryResponse } from "@/types/contracts";
import type { CostCenterDetail, Organization } from "@/types/organizations";
import type { PaginatedResponse } from "@/types/shared";
import { parseBIWorkIds, serializeBIWorkIds } from "@/utils/bi-search";
import { ContractMeasurementStatus } from "./contract-measurement-status";
import { DashboardTabs } from "./dashboard-tabs";
import { DataQualityIssues } from "./data-quality-issues";
import { WorkKPICards } from "./work-kpi-cards";

const CustoPorObraChart = lazy(() =>
	import("@/components/organisms/bi/portfolio-charts").then(
		({ CustoPorObraChart: chart }) => ({ default: chart }),
	),
);
const SpiCpiScatterChart = lazy(() =>
	import("@/components/organisms/bi/portfolio-charts").then(
		({ SpiCpiScatterChart: chart }) => ({ default: chart }),
	),
);
const SCurveChart = lazy(() =>
	import("@/components/organisms/charts/s-curve-chart").then(
		({ SCurveChart: chart }) => ({ default: chart }),
	),
);
const CostCenterBarChart = lazy(() =>
	import("./cost-center-bar-chart").then(({ CostCenterBarChart: chart }) => ({
		default: chart,
	})),
);
const CostPieChart = lazy(() =>
	import("./cost-pie-chart").then(({ CostPieChart: chart }) => ({
		default: chart,
	})),
);
const OrganizationBarChart = lazy(() =>
	import("./organization-bar-chart").then(
		({ OrganizationBarChart: chart }) => ({
			default: chart,
		}),
	),
);
const TemporalEvolutionChart = lazy(() =>
	import("./temporal-evolution-chart").then(
		({ TemporalEvolutionChart: chart }) => ({
			default: chart,
		}),
	),
);

type DashboardPageProps = {
	search: DashboardSearch;
	onSearchChange: (changes: Partial<DashboardSearch>) => void;
	multiworks: MultiworksBIResponse | undefined;
	multiworksLoading: boolean;
	multiworksError: Error | null;
	onMultiworksRetry: () => void;
	organizations: PaginatedResponse<Organization> | undefined;
	costCenters: PaginatedResponse<CostCenterDetail> | undefined;
	organizationQuery: DashboardQueryState<MultiworksBIResponse>;
	costCenterQuery: DashboardQueryState<MultiworksBIResponse>;
	workQuery: DashboardQueryState<WorkBIResponse>;
	workOptions: MultiworksBIResponse | undefined;
	contractSummary: ContractSummaryResponse | undefined;
};

type DashboardQueryState<T> = {
	data: T | undefined;
	isLoading: boolean;
	error: Error | null;
	onRetry: () => void;
};

import type { LucideIcon } from "lucide-react";

export function DashboardChart({
	icon,
	title,
	description,
	children,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<Card className="min-w-0">
			<CardHeaderWithIcon icon={icon} title={title} description={description} />
			<CardContent>
				<Suspense
					fallback={
						<div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
							Carregando gráfico...
						</div>
					}
				>
					{children}
				</Suspense>
			</CardContent>
		</Card>
	);
}

const SCOPE_RESET: Record<DashboardScope, Partial<DashboardSearch>> = {
	system: { orgId: undefined, ccId: undefined, workId: undefined },
	organization: { ccId: undefined, workId: undefined, workIds: undefined },
	costCenter: { workId: undefined, workIds: undefined },
	work: { orgId: undefined, ccId: undefined, workIds: undefined },
};

export function DashboardPage({
	search,
	onSearchChange,
	multiworks,
	multiworksLoading,
	multiworksError,
	onMultiworksRetry,
	organizations,
	costCenters,
	organizationQuery,
	costCenterQuery,
	workQuery,
	workOptions,
	contractSummary,
}: DashboardPageProps) {
	const scope = search.scope;
	const selectedOrgId = search.orgId;
	const selectedCCId = search.ccId;
	const selectedWorkId = search.workId;
	const selectedWorks = useMemo(
		() => new Set(parseBIWorkIds(search.workIds)),
		[search.workIds],
	);

	const handleScopeChange = (next: DashboardScope) => {
		onSearchChange({ scope: next, ...SCOPE_RESET[next] });
	};

	const handleOrgChange = (value: string) => {
		onSearchChange({
			orgId: value,
			ccId: undefined,
			workId: undefined,
			workIds: undefined,
		});
	};

	const handleCCChange = (value: string) => {
		onSearchChange({ ccId: value, workId: undefined, workIds: undefined });
	};

	const handleWorkChange = (value: string) => {
		onSearchChange({ workId: value });
	};

	const handleToggleWork = (workId: string) => {
		const next = new Set(selectedWorks);
		if (next.has(workId)) {
			next.delete(workId);
		} else {
			next.add(workId);
		}
		onSearchChange({ workIds: serializeBIWorkIds(Array.from(next)) });
	};

	const handleToggleAll = (allWorks: Array<{ workId: string }>) => {
		const allIds = allWorks.map((work) => work.workId);
		const allSelected =
			allIds.length > 0 && allIds.every((id) => selectedWorks.has(id));
		onSearchChange({
			workIds: serializeBIWorkIds(allSelected ? [] : allIds),
		});
	};

	const worksForSelect = workOptions?.works ?? [];

	const isLoading =
		scope === "system"
			? multiworksLoading
			: scope === "organization"
				? organizationQuery.isLoading
				: scope === "costCenter"
					? costCenterQuery.isLoading
					: workQuery.isLoading;

	const isError =
		scope === "system"
			? multiworksError
			: scope === "organization"
				? organizationQuery.error
				: scope === "costCenter"
					? costCenterQuery.error
					: workQuery.error;

	const handleRetry =
		scope === "system"
			? onMultiworksRetry
			: scope === "organization"
				? organizationQuery.onRetry
				: scope === "costCenter"
					? costCenterQuery.onRetry
					: workQuery.onRetry;

	const pageHeader = (
		<PageHeader
			eyebrow="Análise"
			title="Dashboard Analítico"
			description="Acompanhe os principais indicadores e a evolução das suas obras."
		/>
	);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-6 p-4">
				{pageHeader}
				<DashboardTabs activeTab={scope} onTabChange={handleScopeChange} />
				<LoadingSpinner />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col gap-6 p-4">
				{pageHeader}
				<DashboardTabs activeTab={scope} onTabChange={handleScopeChange} />
				<ErrorFeedback onRetry={handleRetry} />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 p-4">
			{pageHeader}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<DashboardTabs activeTab={scope} onTabChange={handleScopeChange} />
				{scope !== "system" && (
					<div className="flex flex-wrap items-center gap-3">
						{scope !== "work" && (
							<Select
								value={selectedOrgId ?? ""}
								onValueChange={handleOrgChange}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Organização" />
								</SelectTrigger>
								<SelectContent>
									{organizations?.data.map((org) => (
										<SelectItem key={org.id} value={org.id}>
											{org.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{(scope === "costCenter" || scope === "work") && (
							<Select value={selectedCCId ?? ""} onValueChange={handleCCChange}>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Centro de Custo" />
								</SelectTrigger>
								<SelectContent>
									{costCenters?.data.map((cc) => (
										<SelectItem key={cc.id} value={cc.id}>
											{cc.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{scope === "work" && (
							<Select
								value={selectedWorkId ?? ""}
								onValueChange={handleWorkChange}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Obra" />
								</SelectTrigger>
								<SelectContent>
									{worksForSelect.map((work) => (
										<SelectItem key={work.workId} value={work.workId}>
											{work.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
				)}
			</div>

			{renderTabContent()}
		</div>
	);

	function renderTabContent() {
		switch (scope) {
			case "system": {
				const data = multiworks;
				if (!data) return null;

				const visibleWorks = data.works ?? [];
				const allWorkIds = visibleWorks.map((work) => work.workId);
				const allSelected =
					allWorkIds.length > 0 &&
					allWorkIds.every((workId) => selectedWorks.has(workId));

				return (
					<div className="space-y-6">
						<div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
							<SearchInput
								value={search.q ?? ""}
								placeholder="Buscar obra ou código..."
								className="w-full sm:w-72"
								onChange={(value) => onSearchChange({ q: value || undefined })}
							/>
							<Select
								value={search.status ?? "ALL"}
								onValueChange={(value) =>
									onSearchChange({
										status:
											value === "ALL"
												? undefined
												: (value as DashboardSearch["status"]),
									})
								}
							>
								<SelectTrigger className="w-full sm:w-56">
									<SelectValue placeholder="Status da obra" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">Todos os status</SelectItem>
									<SelectItem value="DRAFT">Rascunho</SelectItem>
									<SelectItem value="NOT_STARTED">Não iniciada</SelectItem>
									<SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
									<SelectItem value="DONE">Concluída</SelectItem>
									<SelectItem value="SUSPENDED">Suspensa</SelectItem>
									<SelectItem value="IGNORED">Arquivada</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{visibleWorks.length === 0 ? (
							<EmptyState
								icon={<BarChart3 className="size-10" />}
								title="Nenhuma obra encontrada"
								description="Cadastre obras e alimente seus dados operacionais para visualizar a análise consolidada de desempenho."
							/>
						) : (
							<>
								<HealthCards cards={data.cards} works={visibleWorks} />
								<PortfolioProjections cards={data.cards} />
								<DataQualityIssues issues={data.qualityIssues} />
								<CriticalAlerts works={visibleWorks} />
								<div className="grid grid-cols-1 gap-4">
									<DashboardChart
										icon={BarChart3}
										title="Custo por Obra"
										description="Comparativo de custos entre obras do portfólio"
									>
										<CustoPorObraChart data={data.portfolioChart} />
									</DashboardChart>
									<DashboardChart
										icon={ScatterChart}
										title="SPI × CPI"
										description="Índices de desempenho por obra"
									>
										<SpiCpiScatterChart works={visibleWorks} />
									</DashboardChart>
								</div>
								<TopRankings rankings={data.rankings} />
								<Rankings rankings={data.rankings} />
								<WorksHealthTable
									works={visibleWorks}
									selected={selectedWorks}
									allSelected={allSelected}
									onToggle={handleToggleWork}
									onToggleAll={() => handleToggleAll(visibleWorks)}
								/>
							</>
						)}
					</div>
				);
			}

			case "organization": {
				const data = organizationQuery.data;
				if (!selectedOrgId) {
					return (
						<EmptyState
							icon={<Building2 className="size-10" />}
							title="Selecione uma organização"
							description="Escolha uma organização para visualizar os indicadores."
						/>
					);
				}
				if (!data) return null;

				return (
					<>
						{data.works.length === 0 ? (
							<EmptyState
								icon={<Building2 className="size-10" />}
								title="Nenhuma obra encontrada"
								description="Esta organização não possui obras com dados de BI."
							/>
						) : (
							<>
								<HealthCards cards={data.cards} works={data.works} />
								<PortfolioProjections cards={data.cards} />
								<DataQualityIssues issues={data.qualityIssues} />
								<CriticalAlerts works={data.works} />
								<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
									<DashboardChart
										icon={ScatterChart}
										title="SPI × CPI"
										description="Índices de desempenho por obra"
									>
										<SpiCpiScatterChart works={data.works} />
									</DashboardChart>
									<WorksHealthTable
										works={data.works}
										selected={selectedWorks}
										allSelected={
											selectedWorks.size === data.works.length &&
											data.works.length > 0
										}
										onToggle={handleToggleWork}
										onToggleAll={() => handleToggleAll(data.works)}
									/>
								</div>
								<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
									<DashboardChart
										icon={BarChart3}
										title="Custos por Centro de Custo"
										description="Distribuição de custos entre centros de custo"
									>
										<OrganizationBarChart data={data.costsByWork} />
									</DashboardChart>
									<DashboardChart
										icon={BarChart3}
										title="Composição de Custos"
										description="Participação de cada centro de custo no total"
									>
										<CostPieChart data={data.costsByWork} />
									</DashboardChart>
								</div>
								<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
									<DashboardChart
										icon={BarChart3}
										title="Custo por Obra"
										description="Comparativo de custos entre obras"
									>
										<CustoPorObraChart data={data.portfolioChart} />
									</DashboardChart>
									<DashboardChart
										icon={TrendingUp}
										title="Evolução Temporal"
										description="Acompanhamento do cronograma ao longo do tempo"
									>
										<TemporalEvolutionChart data={data.scheduleByWork} />
									</DashboardChart>
								</div>
							</>
						)}
					</>
				);
			}

			case "costCenter": {
				const data = costCenterQuery.data;
				if (!selectedOrgId || !selectedCCId) {
					return (
						<EmptyState
							icon={<CircleDollarSign className="size-10" />}
							title="Selecione organização e centro de custo"
							description="Escolha uma organização e um centro de custo para visualizar os indicadores."
						/>
					);
				}
				if (!data) return null;

				return (
					<>
						{data.works.length === 0 ? (
							<EmptyState
								icon={<CircleDollarSign className="size-10" />}
								title="Nenhuma obra encontrada"
								description="Este centro de custo não possui obras com dados de BI."
							/>
						) : (
							<>
								<HealthCards cards={data.cards} works={data.works} />
								<PortfolioProjections cards={data.cards} />
								<DataQualityIssues issues={data.qualityIssues} />
								<CriticalAlerts works={data.works} />
								<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
									<DashboardChart
										icon={ScatterChart}
										title="SPI × CPI"
										description="Índices de desempenho por obra"
									>
										<SpiCpiScatterChart works={data.works} />
									</DashboardChart>
									<WorksHealthTable
										works={data.works}
										selected={selectedWorks}
										allSelected={
											selectedWorks.size === data.works.length &&
											data.works.length > 0
										}
										onToggle={handleToggleWork}
										onToggleAll={() => handleToggleAll(data.works)}
									/>
								</div>
								<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
									<DashboardChart
										icon={BarChart3}
										title="Custos por Obra"
										description="Distribuição de custos entre obras"
									>
										<CostCenterBarChart data={data.costsByWork} />
									</DashboardChart>
									<DashboardChart
										icon={BarChart3}
										title="Composição de Custos"
										description="Participação de cada obra no total"
									>
										<CostPieChart data={data.costsByWork} />
									</DashboardChart>
								</div>
								<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
									<DashboardChart
										icon={BarChart3}
										title="Custo por Obra"
										description="Comparativo de custos entre obras"
									>
										<CustoPorObraChart data={data.portfolioChart} />
									</DashboardChart>
									<DashboardChart
										icon={TrendingUp}
										title="Evolução Temporal"
										description="Acompanhamento do cronograma ao longo do tempo"
									>
										<TemporalEvolutionChart data={data.scheduleByWork} />
									</DashboardChart>
								</div>
							</>
						)}
					</>
				);
			}

			case "work": {
				const data = workQuery.data;
				if (!selectedWorkId) {
					return (
						<EmptyState
							icon={<HardHat className="size-10" />}
							title="Selecione uma obra"
							description="Escolha uma obra para visualizar os indicadores detalhados."
						/>
					);
				}
				if (!data) return null;

				return (
					<>
						<WorkKPICards summary={data.summary} />
						<DataQualityIssues issues={data.qualityIssues} />
						<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
							<DashboardChart
								icon={TrendingUp}
								title="Curva S"
								description="Acompanhamento do progresso ao longo do tempo"
							>
								<SCurveChart points={data.sCurve} />
							</DashboardChart>
							<DashboardChart
								icon={BarChart3}
								title="Custos por Etapa"
								description="Participação de cada etapa no total"
							>
								<CostPieChart
									data={data.costByStage}
									title="Custos por Etapa"
								/>
							</DashboardChart>
						</div>
						<ContractMeasurementStatus summary={contractSummary} />
					</>
				);
			}
		}
	}
}
