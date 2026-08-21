import {
	CalendarClock,
	DollarSign,
	FileSpreadsheet,
	TrendingUp,
} from "lucide-react";
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
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { AsOfDatePicker } from "@/components/molecules/as-of-date-picker";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	CHART_COLORS_ARRAY,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import { SCurveChart } from "@/components/organisms/charts/s-curve-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { CostByStage, WorkBIResponse } from "@/types/bi";
import type { ScheduleItem, ScheduleResponse } from "@/types/schedule";
import { getErrorMessage } from "@/utils/api-error";
import { classifyIndex, HEALTH_TONE } from "@/utils/evm-health";
import {
	CATEGORY_LABEL,
	formatCurrency,
	formatDate,
	formatPercentage,
	formatRatioAsPercentage,
} from "@/utils/format";
import { FinancialAnalysisSection } from "./financial-analysis-section";
import { StageSpiCpiScatterChart } from "./stage-spi-cpi-scatter-chart";

type SummaryTabProps = {
	bi: WorkBIResponse | undefined;
	biLoading: boolean;
	biError: Error | null;
	onBiRetry: () => void;
	mgmt: WorkManagementResponse | undefined;
	mgmtLoading: boolean;
	mgmtError: Error | null;
	onMgmtRetry: () => void;
	schedule: ScheduleResponse | null | undefined;
	asOfDate: string | undefined;
	onAsOfDateChange: (value: string | undefined) => void;
	hasNoBudget: boolean;
	onGoToBudget: () => void;
};

export function SummaryTab({
	bi,
	biLoading,
	biError,
	onBiRetry,
	mgmt,
	mgmtLoading,
	mgmtError,
	onMgmtRetry,
	schedule,
	asOfDate,
	onAsOfDateChange,
	hasNoBudget,
	onGoToBudget,
}: SummaryTabProps) {
	if (hasNoBudget) {
		return (
			<EmptyState
				icon={<FileSpreadsheet className="h-10 w-10" />}
				title="Nenhum orçamento importado"
				description="Importe ou crie um orçamento para visualizar os indicadores de desempenho da obra."
				actions={[{ label: "Ir para Orçamento", onClick: onGoToBudget }]}
			/>
		);
	}

	if (biLoading) return <LoadingSpinner title="Carregando indicadores..." />;
	if (biError || !bi)
		return (
			<ErrorFeedback
				message={getErrorMessage(
					biError,
					"Erro ao carregar indicadores da obra.",
				)}
				onRetry={onBiRetry}
			/>
		);

	const { summary, sCurve, costByStage } = bi;

	const safeFormat = (v: number | null | undefined) =>
		v != null && Number.isFinite(v) ? formatCurrency(v) : "-";

	const formatIndex = (v: number | null | undefined) =>
		v != null && Number.isFinite(v) ? v.toFixed(3) : "-";

	const spIndex = summary.schedulePerformanceIndex ?? summary.idp;
	const cpIndex = summary.costPerformanceIndex ?? summary.idc;

	const progressWidth = Math.min(summary.measuredPercentage * 100, 100);

	const topVariances = (costByStage || [])
		.filter((stage) => stage.variation != null)
		.slice()
		.sort((a, b) => Math.abs(b.variation ?? 0) - Math.abs(a.variation ?? 0))
		.slice(0, 5);

	const costStageChartData = (costByStage || []).map((s: CostByStage) => ({
		name: s.stageName,
		Orçado: s.activeBudget,
		Real: s.actualCost,
	}));

	return (
		<div className="space-y-6 pt-4">
			<KpiGrid>
				<KpiCard title="Orçado" value={formatCurrency(mgmt?.budgeted ?? 0)} />
				<KpiCard title="Gasto" value={formatCurrency(summary.actualCost)} />
				<KpiCard
					title="Saldo"
					value={formatCurrency(summary.currentBudgetBalance)}
					tone={summary.currentBudgetBalance >= 0 ? "success" : "danger"}
				/>
				<KpiCard
					title="Execução (%)"
					value={
						summary.activeBudget > 0
							? formatPercentage(
									(summary.actualCost / summary.activeBudget) * 100,
								)
							: "-"
					}
				/>
				<KpiCard
					title="Valor agregado (EV)"
					value={safeFormat(summary.earnedValue)}
				/>
				<KpiCard
					title="IDC (CPI)"
					value={formatIndex(cpIndex)}
					tone={
						cpIndex != null
							? classifyIndex(cpIndex) === "good"
								? "success"
								: classifyIndex(cpIndex) === "attention"
									? "warning"
									: "danger"
							: "default"
					}
				/>
				<KpiCard
					title="IDP (SPI)"
					value={formatIndex(spIndex)}
					tone={
						spIndex != null
							? classifyIndex(spIndex) === "good"
								? "success"
								: classifyIndex(spIndex) === "attention"
									? "warning"
									: "danger"
							: "default"
					}
				/>
				<KpiCard
					title="Custos futuros"
					value={formatCurrency(summary.futureCost)}
					tone="warning"
				/>
				<KpiCard
					title="Saldo projetado"
					value={formatCurrency(summary.projectedBudgetBalance)}
					tone={summary.projectedBudgetBalance >= 0 ? "success" : "danger"}
				/>
				{bi.financial?.budgetCostPerM2 != null && (
					<KpiCard
						title="Custo/m² (orçado)"
						value={formatCurrency(bi.financial.budgetCostPerM2)}
					/>
				)}
				{bi.financial?.actualCostPerM2 != null && (
					<KpiCard
						title="Custo/m² (real)"
						value={formatCurrency(bi.financial.actualCostPerM2)}
					/>
				)}
			</KpiGrid>
			<div>
				<div className="flex items-center justify-between text-sm">
					<span className="font-medium text-foreground">Progresso</span>
					<span className="text-muted-foreground">
						{formatRatioAsPercentage(summary.measuredPercentage)}
					</span>
				</div>
				<Progress value={progressWidth} className="mt-1 h-2" />
			</div>

			{sCurve && sCurve.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={TrendingUp}
						title="Curva S"
						description="Acompanhamento do progresso ao longo do tempo"
					/>
					<CardContent className="space-y-6">
						<SCurveChart points={sCurve} />
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Período</TableHead>
									<TableHead className="text-right">Planejado</TableHead>
									<TableHead className="text-right">Medido</TableHead>
									<TableHead className="text-right">Tendência</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sCurve.map((point) => (
									<TableRow key={point.period}>
										<TableCell>{point.period}</TableCell>
										<TableCell className="text-right">
											{formatRatioAsPercentage(point.plannedAccumulated)}
										</TableCell>
										<TableCell className="text-right">
											{point.measuredAccumulated != null
												? formatRatioAsPercentage(point.measuredAccumulated)
												: "-"}
										</TableCell>
										<TableCell className="text-right">
											{point.trendProjected != null
												? formatRatioAsPercentage(point.trendProjected)
												: "-"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{costStageChartData.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={DollarSign}
						title="Custo por Etapa"
						description="Orçado vs Real por etapa de execução"
					/>
					<CardContent>
						<div className="h-80 w-full">
							<ResponsiveContainer width="100%" height={320}>
								<BarChart data={costStageChartData} margin={DEFAULT_MARGIN}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke={CHART_THEME.gridColor}
										vertical={false}
									/>
									<XAxis
										dataKey="name"
										tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
										axisLine={false}
										tickLine={false}
										tickFormatter={(v: number) => formatCurrency(v)}
									/>
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
									<Bar
										dataKey="Orçado"
										fill={CHART_COLORS_ARRAY[0]}
										radius={[4, 4, 0, 0]}
										maxBarSize={32}
									/>
									<Bar
										dataKey="Real"
										fill={CHART_COLORS_ARRAY[1]}
										radius={[4, 4, 0, 0]}
										maxBarSize={32}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>
			)}

			{costByStage && costByStage.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={DollarSign}
						title="Detalhamento por Etapa"
						description="Orçamento, medido, custo real e saldo por etapa"
					/>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Etapa</TableHead>
									<TableHead className="text-right">Orçamento</TableHead>
									<TableHead className="text-right">Valor medido</TableHead>
									<TableHead className="text-right">Custo real</TableHead>
									<TableHead className="text-right">Saldo</TableHead>
									<TableHead className="text-right">Completude</TableHead>
									<TableHead className="text-right">IDC (CPI)</TableHead>
									<TableHead className="text-right">IDP (SPI)</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{costByStage.map((stage) => {
									const cpi = stage.costPerformanceIndex;
									const spi = stage.schedulePerformanceIndex;
									const indexColor = (v: number | null | undefined) =>
										v == null ? "" : HEALTH_TONE[classifyIndex(v)].text;
									return (
										<TableRow key={stage.stageId}>
											<TableCell>{stage.stageName}</TableCell>
											<TableCell className="text-right">
												{formatCurrency(stage.activeBudget)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(stage.earnedValue)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(stage.actualCost)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(stage.balance)}
											</TableCell>
											<TableCell className="text-right">
												{formatRatioAsPercentage(stage.measuredPercentage)}
											</TableCell>
											<TableCell
												className={`text-right font-medium ${indexColor(cpi)}`}
											>
												{formatIndex(cpi)}
											</TableCell>
											<TableCell
												className={`text-right font-medium ${indexColor(spi)}`}
											>
												{formatIndex(spi)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{topVariances.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={DollarSign}
						title="Maiores Variações"
						description="Etapas com maior diferença entre valor medido e custo real"
					/>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Etapa</TableHead>
									<TableHead className="text-right">Valor medido</TableHead>
									<TableHead className="text-right">Custo real</TableHead>
									<TableHead className="text-right">Variação</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{topVariances.map((stage) => {
									const variation = stage.variation ?? 0;
									return (
										<TableRow key={stage.stageId}>
											<TableCell>{stage.stageName}</TableCell>
											<TableCell className="text-right">
												{formatCurrency(stage.earnedValue)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(stage.actualCost)}
											</TableCell>
											<TableCell
												className={`text-right font-medium ${
													variation >= 0
														? HEALTH_TONE.good.text
														: HEALTH_TONE.critical.text
												}`}
											>
												{variation >= 0 ? "+" : ""}
												{formatCurrency(variation)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{mgmtError && !mgmt && (
				<ErrorFeedback
					message={getErrorMessage(
						mgmtError,
						"Erro ao carregar dados de gestão.",
					)}
					onRetry={onMgmtRetry}
				/>
			)}
			{mgmtLoading && !mgmt ? (
				<LoadingSpinner title="Carregando gestão..." />
			) : (
				mgmt && (
					<>
						<ReplanningImpactCard schedule={schedule} />
						<TabsDefault data={mgmt} />
					</>
				)
			)}

			{bi.financial && (
				<FinancialAnalysisSection
					financial={bi.financial}
					unappropriatedCosts={bi.unappropriatedCosts}
				/>
			)}

			{costByStage && costByStage.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={CalendarClock}
						title="SPI x CPI por Etapa"
						description="Saúde de cada etapa: atraso, estouro ou desempenho saudável"
					/>
					<CardContent>
						<StageSpiCpiScatterChart stages={costByStage} />
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function TabsDefault({ data }: { data: WorkManagementResponse }) {
	return (
		<Card>
			<CardHeaderWithIcon
				icon={DollarSign}
				title="Custos por Categoria"
				description="Distribuição dos custos por categoria e fornecedor."
			/>
			<CardContent>
				<CostsByCategoryTab data={data} />
			</CardContent>
		</Card>
	);
}

function CostsByCategoryTab({ data }: { data: WorkManagementResponse }) {
	const barData = data.costsByCategory.map((c) => ({
		name: CATEGORY_LABEL[c.category] ?? c.category,
		amount: c.amount,
	}));

	if (barData.length === 0) {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Categoria</TableHead>
						<TableHead className="text-right">Valor</TableHead>
						<TableHead className="text-right">%</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell
							colSpan={3}
							className="text-center text-muted-foreground"
						>
							Nenhum custo registrado.
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		);
	}

	return (
		<div className="space-y-6">
			<div className="min-w-0">
				<div className="max-h-[320px] overflow-y-auto pr-1">
					<ResponsiveContainer
						width="100%"
						height={Math.max(barData.length * 44 + 20, 200)}
					>
						<BarChart
							data={barData}
							margin={DEFAULT_MARGIN}
							layout="vertical"
							barCategoryGap={8}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke={CHART_THEME.gridColor}
								horizontal={false}
							/>
							<XAxis
								type="number"
								tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								tickFormatter={(value: number) => formatCurrency(value)}
							/>
							<YAxis
								type="category"
								dataKey="name"
								width={150}
								tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								content={
									<ChartTooltip
										formatter={(value: number) => [
											formatCurrency(value),
											"Valor",
										]}
									/>
								}
							/>
							<Bar
								dataKey="amount"
								name="Valor"
								fill={CHART_COLORS_ARRAY[0]}
								radius={[0, 4, 4, 0]}
								maxBarSize={20}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Categoria</TableHead>
						<TableHead className="text-right">Valor</TableHead>
						<TableHead className="text-right">%</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.costsByCategory.map((cat) => (
						<TableRow key={cat.category}>
							<TableCell>
								{CATEGORY_LABEL[cat.category] ?? cat.category}
							</TableCell>
							<TableCell className="text-right">
								{formatCurrency(cat.amount)}
							</TableCell>
							<TableCell className="text-right">
								{formatRatioAsPercentage(cat.percentage)}
							</TableCell>
						</TableRow>
					))}
					{data.costsByCategory.length === 0 && (
						<TableRow>
							<TableCell
								colSpan={3}
								className="text-center text-muted-foreground"
							>
								Nenhum custo registrado.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Fornecedor</TableHead>
						<TableHead className="text-right">Total</TableHead>
						<TableHead className="text-right">Pago</TableHead>
						<TableHead className="text-right">Em Aberto</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.supplierBreakdown.map((s) => (
						<TableRow key={s.supplierName}>
							<TableCell>{s.supplierName}</TableCell>
							<TableCell className="text-right">
								{formatCurrency(s.totalAmount)}
							</TableCell>
							<TableCell className="text-right">
								{formatCurrency(s.paidAmount)}
							</TableCell>
							<TableCell className="text-right">
								{formatCurrency(s.openAmount)}
							</TableCell>
						</TableRow>
					))}
					{data.supplierBreakdown.length === 0 && (
						<TableRow>
							<TableCell
								colSpan={4}
								className="text-center text-muted-foreground"
							>
								Nenhum fornecedor registrado.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}

function flattenScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
	return items.flatMap((item) => [
		item,
		...(item.children ? flattenScheduleItems(item.children) : []),
	]);
}

function ReplanningImpactCard({
	schedule,
}: {
	schedule: ScheduleResponse | null | undefined;
}) {
	if (!schedule?.replanning) return null;
	const { replanning } = schedule;
	const hasImpact = replanning.itemsShifted > 0 || replanning.revisedEndAt;
	if (!hasImpact) return null;

	const shiftedItems = flattenScheduleItems(schedule.items).filter(
		(item) => item.deltaDays != null && item.deltaDays !== 0,
	);

	return (
		<Card>
			<CardHeaderWithIcon
				icon={CalendarClock}
				title="Impacto do Replanejamento"
				description="Deslocamentos do cronograma em relação à linha de base."
			/>
			<CardContent>
				<KpiGrid>
					<KpiCard
						title="Itens deslocados"
						value={replanning.itemsShifted}
						tone="default"
					/>
					<KpiCard
						title="Maior desvio"
						value={`${replanning.maxDeltaDays} dia(s)`}
						tone={replanning.maxDeltaDays > 0 ? "danger" : "default"}
					/>
					{replanning.revisedEndAt && (
						<KpiCard
							title="Fim revisado"
							value={formatDate(replanning.revisedEndAt)}
							tone="default"
						/>
					)}
				</KpiGrid>

				{shiftedItems.length > 0 && (
					<div className="mt-4 overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Índice</TableHead>
									<TableHead>Descrição</TableHead>
									<TableHead>Fim (base)</TableHead>
									<TableHead>Fim (revisado)</TableHead>
									<TableHead className="text-right">Desvio</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{shiftedItems.slice(0, 20).map((item) => (
									<TableRow key={item.id}>
										<TableCell className="font-mono text-xs text-muted-foreground">
											{item.index}
										</TableCell>
										<TableCell>{item.description}</TableCell>
										<TableCell>
											{item.baselineEnd ? formatDate(item.baselineEnd) : "—"}
										</TableCell>
										<TableCell>
											{item.revisedEnd ? formatDate(item.revisedEnd) : "—"}
										</TableCell>
										<TableCell
											className={`text-right font-medium ${
												item.deltaDays != null && item.deltaDays > 0
													? "text-destructive"
													: "text-primary"
											}`}
										>
											{item.deltaDays != null && item.deltaDays > 0
												? `+${item.deltaDays} dia(s)`
												: `${item.deltaDays} dia(s)`}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{shiftedItems.length > 20 && (
							<p className="mt-2 text-xs text-muted-foreground">
								Exibindo os 20 primeiros itens deslocados.
							</p>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
