import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	BarChart3,
	CalendarDays,
	Inbox,
	Users,
} from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { WorkManagementResponse } from "@/api/management";
import { getPhysicalFinancialSchedule } from "@/api/schedule";
import { getWorkStatistics, type StatisticsPeriod } from "@/api/statistics";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	CHART_COLORS,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import { PhysicalFinancialChart } from "@/components/organisms/charts/physical-financial-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkBIResponse } from "@/types/bi";
import type { SchedulePhysicalFinancialResponse } from "@/types/schedule";
import {
	formatCurrency,
	formatPercentage,
	formatRatioAsPercentage,
} from "@/utils/format";
import { formatPeriodLabel } from "@/utils/schedule-period";

type StatisticsTabProps = {
	workId: string;
	bi: WorkBIResponse | undefined;
	mgmt: WorkManagementResponse | undefined;
	loading: boolean;
	error: Error | null;
	onRetry: () => void;
};

export function hasPhysicalFinancialPeriods(
	totals: SchedulePhysicalFinancialResponse["totals"] | null | undefined,
): totals is SchedulePhysicalFinancialResponse["totals"] {
	return (totals?.months.length ?? 0) > 0;
}

export function StatisticsTab({
	workId,
	bi,
	mgmt,
	loading,
	error,
	onRetry,
}: StatisticsTabProps) {
	const [period, setPeriod] = useState<StatisticsPeriod>("monthly");
	const scheduleQuery = useQuery({
		queryKey: ["work-statistics-schedule", workId, period],
		queryFn: () => getPhysicalFinancialSchedule(workId, period),
		enabled: Boolean(workId),
	});
	const statisticsQuery = useQuery({
		queryKey: ["work-statistics", workId, period],
		queryFn: () => getWorkStatistics(workId, period),
		enabled: Boolean(workId),
	});

	if (loading) return <LoadingSpinner title="Carregando estatísticas..." />;
	if (error || !bi || !mgmt) {
		return (
			<ErrorFeedback
				message="Não foi possível carregar as estatísticas da obra."
				onRetry={onRetry}
			/>
		);
	}

	const noInformation = "Sem informações";
	const completeness = bi.summary.dataCompleteness;

	const summary = bi.summary;
	const suppliers = mgmt.supplierBreakdown;
	const chartData = suppliers.map((supplier) => ({
		name: supplier.supplierName,
		Total: supplier.totalAmount,
		Pago: supplier.paidAmount,
		Aberto: supplier.openAmount,
	}));
	const totals = scheduleQuery.data?.totals;
	const exactSeries = statisticsQuery.data?.series ?? [];

	return (
		<Tabs defaultValue="geral" className="space-y-6">
			<TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
				<TabsTrigger value="geral">
					<BarChart3 className="mr-2 h-4 w-4" />
					Geral
				</TabsTrigger>
				<TabsTrigger value="fornecedores">
					<Users className="mr-2 h-4 w-4" />
					Fornecedores
				</TabsTrigger>
				<TabsTrigger value="saude">
					<AlertTriangle className="mr-2 h-4 w-4" />
					Saúde da obra
				</TabsTrigger>
				<TabsTrigger value="gastos">
					<CalendarDays className="mr-2 h-4 w-4" />
					Gastos
				</TabsTrigger>
			</TabsList>

			<TabsContent value="geral" className="space-y-6">
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Indicadores consolidados"
						description="Resumo dos principais indicadores da obra."
					/>
					<CardContent>
						<KpiGrid>
							<KpiCard
								title="Orçamento ativo"
								value={
									completeness.hasBudget
										? formatCurrency(summary.activeBudget)
										: noInformation
								}
							/>
							<KpiCard
								title="Gasto realizado"
								value={
									completeness.hasActualCosts
										? formatCurrency(summary.actualCost)
										: noInformation
								}
							/>
							<KpiCard
								title="Saldo atual"
								value={
									completeness.hasBudget
										? formatCurrency(summary.currentBudgetBalance)
										: noInformation
								}
							/>
							<KpiCard
								title="Medição acumulada"
								value={
									completeness.hasMeasurements
										? formatPercentage(summary.measuredPercentage * 100)
										: noInformation
								}
							/>
							<KpiCard
								title={`BDI (${summary.bdiPercentage ?? 0}%)`}
								value={
									completeness.hasBudget
										? formatCurrency(summary.bdiValue ?? 0)
										: noInformation
								}
							/>
						</KpiGrid>
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Indicadores financeiros"
						description="Valores planejado, agregado e custo futuro."
					/>
					<CardContent className="grid gap-4 sm:grid-cols-3">
						<div>
							<p className="text-sm text-muted-foreground">Planejado</p>
							<p className="text-xl font-semibold">
								{formatCurrency(summary.plannedValue)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Valor agregado</p>
							<p className="text-xl font-semibold">
								{formatCurrency(summary.earnedValue)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Custo futuro</p>
							<p className="text-xl font-semibold">
								{formatCurrency(summary.futureCost)}
							</p>
						</div>
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="fornecedores" className="space-y-6">
				<Card>
					<CardHeaderWithIcon
						icon={Users}
						title="Gastos por fornecedor"
						description="Distribuição dos pagamentos e valores em aberto."
					/>
					<CardContent>
						{chartData.length === 0 ? (
							<EmptyState
								icon={<Users className="h-10 w-10" />}
								title="Nenhum fornecedor com movimentação"
								description="Dados de fornecedores aparecerão aqui quando houver custos registrados."
							/>
						) : (
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={chartData} margin={DEFAULT_MARGIN}>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke={CHART_THEME.gridColor}
											vertical={false}
										/>
										<XAxis dataKey="name" tick={{ fontSize: 11 }} />
										<YAxis tick={{ fontSize: 11 }} />
										<Tooltip
											content={
												<ChartTooltip
													formatter={(value, name) => [
														formatCurrency(value),
														name,
													]}
												/>
											}
										/>
										<Bar dataKey="Pago" fill={CHART_COLORS.chart2} />
										<Bar dataKey="Aberto" fill={CHART_COLORS.chart4} />
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="saude" className="space-y-6">
				<Card>
					<CardHeaderWithIcon
						icon={AlertTriangle}
						title="Índices de desempenho"
						description="IDP, IDC e variação de prazo."
					/>
					<CardContent>
						<KpiGrid>
							<KpiCard
								title="IDP (SPI)"
								value={summary.schedulePerformanceIndex?.toFixed(3) ?? "-"}
							/>
							<KpiCard
								title="IDC (CPI)"
								value={summary.costPerformanceIndex?.toFixed(3) ?? "-"}
							/>
							<KpiCard
								title="Variação de prazo"
								value={
									summary.scheduleDifference == null ||
									summary.scheduleDifference <= 0
										? "-"
										: formatRatioAsPercentage(summary.scheduleDifference)
								}
							/>
						</KpiGrid>
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={AlertTriangle}
						title="Alertas e qualidade dos dados"
						description="Pendências e alertas retornados pelo backend."
					/>
					<CardContent className="space-y-3">
						{[...(bi.alerts ?? []), ...(bi.qualityIssues ?? [])].length ===
						0 ? (
							<EmptyState
								icon={<AlertTriangle className="h-10 w-10" />}
								title="Nenhum alerta registrado"
								description="Alertas e pendências dos dados atuais aparecerão aqui."
							/>
						) : (
							[...(bi.alerts ?? []), ...(bi.qualityIssues ?? [])].map(
								(issue) => (
									<div
										key={`${issue.code}-${issue.message}`}
										className="rounded-md border p-3 text-sm"
									>
										<p className="font-medium">{issue.message}</p>
										{"suggestedAction" in issue && issue.suggestedAction ? (
											<p className="mt-1 text-muted-foreground">
												{issue.suggestedAction}
											</p>
										) : null}
									</div>
								),
							)
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="gastos" className="space-y-6">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium">Período:</span>
					{(["daily", "weekly", "monthly"] as const).map((value) => (
						<Button
							key={value}
							variant={period === value ? "default" : "outline"}
							size="sm"
							onClick={() => setPeriod(value)}
						>
							{value === "daily"
								? "Diário"
								: value === "weekly"
									? "Semanal"
									: "Mensal"}
						</Button>
					))}
				</div>
				<Card>
					<CardHeaderWithIcon
						icon={CalendarDays}
						title="Custos, medições e contratos por período"
						description="Cada ponto representa o período exato retornado pelo backend."
					/>
					<CardContent>
						{scheduleQuery.isLoading ? (
							<LoadingSpinner title="Carregando série financeira..." />
						) : scheduleQuery.error ? (
							<ErrorFeedback onRetry={() => scheduleQuery.refetch()} />
						) : statisticsQuery.isLoading ? (
							<LoadingSpinner title="Carregando movimentações detalhadas..." />
						) : statisticsQuery.error ? (
							<ErrorFeedback onRetry={() => statisticsQuery.refetch()} />
						) : hasPhysicalFinancialPeriods(totals) ? (
							<>
								<PhysicalFinancialChart data={{ totals }} period={period} />
								{exactSeries.length > 0 ? (
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="border-b text-left">
													<th className="py-2">Data/período</th>
													<th className="py-2 text-right">Contratos</th>
													<th className="py-2 text-right">Medido</th>
													<th className="py-2 text-right">Custos</th>
												</tr>
											</thead>
											<tbody>
												{exactSeries.map((point) => (
													<tr key={point.date} className="border-b">
														<td className="py-2">
															{formatPeriodLabel(point.date, period)}
														</td>
														<td className="py-2 text-right">
															{formatCurrency(point.contracts)}
														</td>
														<td className="py-2 text-right">
															{formatCurrency(point.measurements)}
														</td>
														<td className="py-2 text-right">
															{formatCurrency(point.costs)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<EmptyState
										icon={<Inbox className="h-10 w-10" />}
										title="Nenhuma movimentação detalhada no período"
										description="O cronograma planejado continua disponível; custos, medições e contratos aparecerão quando forem registrados."
									/>
								)}
							</>
						) : (
							<EmptyState
								icon={<Inbox className="h-10 w-10" />}
								title="Nenhuma movimentação no período"
								description="Dados de custos, medições e contratos aparecerão aqui."
							/>
						)}
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}
