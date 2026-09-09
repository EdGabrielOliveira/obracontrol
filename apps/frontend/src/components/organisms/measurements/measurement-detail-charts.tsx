import { AreaChart as AreaChartIcon, BarChart3, Target } from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	CHART_COLORS_ARRAY,
	CHART_STATUS_COLORS,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import type { MeasurementTreeItem } from "@/types/measurements";
import { formatCurrency, formatCurrencyTick } from "@/utils/format";

type MeasurementDetailChartsProps = {
	items: MeasurementTreeItem[];
	budgetSummary: {
		totalBudgeted: number;
		totalMeasured: number;
		balanceToMeasure: number;
	};
};

export function MeasurementDetailCharts({
	items,
	budgetSummary,
}: MeasurementDetailChartsProps) {
	const itemsList = items ?? [];
	const flattenedItems = flattenMeasurementItems(itemsList);

	const topItems = flattenedItems
		.filter((item) => item.children.length === 0)
		.sort((a, b) => b.measuredAccumulated.value - a.measuredAccumulated.value)
		.slice(0, 10);

	const stageData = itemsList
		.filter((item) => !item.parentId)
		.map((stage) => ({
			name: `${stage.index} · ${stage.description}`.slice(0, 34),
			orcado: stage.totalCost,
			medido: stage.measuredAccumulated.value,
		}));

	const topItemsData = topItems.map((item) => ({
		name: `${item.index} · ${item.description || "Item sem descrição"}`.slice(
			0,
			38,
		),
		valor: item.measuredAccumulated.value,
	}));

	const balanceData = itemsList
		.filter((item) => !item.parentId)
		.map((stage) => ({
			name: `${stage.index} · ${stage.description || "Etapa sem descrição"}`,
			saldo: Number(stage.balanceToMeasure.value),
		}))
		.filter((entry) => Number.isFinite(entry.saldo) && entry.saldo !== 0)
		.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
		.slice(0, 12);
	const balanceMin = Math.min(0, ...balanceData.map((entry) => entry.saldo));
	const balanceMax = Math.max(0, ...balanceData.map((entry) => entry.saldo));
	const balancePadding = Math.max(Math.abs(balanceMax - balanceMin) * 0.1, 1);
	const balanceDomain: [number, number] = [
		balanceMin - balancePadding,
		balanceMax + balancePadding,
	];
	const overrunCount = balanceData.filter((entry) => entry.saldo < 0).length;

	const accumulatedEvolutionData = [
		{ name: "Orçado", valor: budgetSummary.totalBudgeted },
		{ name: "Medido", valor: budgetSummary.totalMeasured },
		{ name: "Saldo", valor: budgetSummary.balanceToMeasure },
	];

	return (
		<div className="space-y-6">
			{stageData.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Orçado vs Medido por Etapa"
						description="Comparativo por etapa do orçamento."
					/>
					<CardContent>
						<ResponsiveContainer width="100%" height={300}>
							<BarChart data={stageData} margin={DEFAULT_MARGIN}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke={CHART_THEME.gridColor}
									vertical={false}
								/>
								<XAxis
									dataKey="name"
									tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
									axisLine={false}
									tickLine={false}
									angle={-15}
									textAnchor="end"
									height={60}
								/>
								<YAxis
									tickFormatter={formatCurrencyTick}
									tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
									axisLine={false}
									tickLine={false}
								/>
								<Tooltip
									content={
										<ChartTooltip
											formatter={(v: number) => [formatCurrency(v), ""]}
										/>
									}
								/>
								<Legend />
								<Bar
									dataKey="orcado"
									fill={CHART_COLORS_ARRAY[0]}
									radius={[4, 4, 0, 0]}
									maxBarSize={32}
									name="Orçado"
								/>
								<Bar
									dataKey="medido"
									fill={CHART_COLORS_ARRAY[1]}
									radius={[4, 4, 0, 0]}
									maxBarSize={32}
									name="Medido"
								/>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{itemsList.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={Target}
						title="Planejado vs Medido"
						description="Planejado versus medido acumulado."
					/>
					<CardContent>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart
								data={[
									{
										name: "Total",
										planejado: budgetSummary.totalBudgeted,
										medido: budgetSummary.totalMeasured,
									},
								]}
								margin={DEFAULT_MARGIN}
							>
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
									tickFormatter={formatCurrencyTick}
									tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
									axisLine={false}
									tickLine={false}
								/>
								<Tooltip
									content={
										<ChartTooltip
											formatter={(v: number) => [formatCurrency(v), ""]}
										/>
									}
								/>
								<Legend />
								<Bar
									dataKey="planejado"
									fill={CHART_COLORS_ARRAY[0]}
									radius={[4, 4, 0, 0]}
									maxBarSize={48}
									name="Planejado"
								/>
								<Bar
									dataKey="medido"
									fill={CHART_COLORS_ARRAY[1]}
									radius={[4, 4, 0, 0]}
									maxBarSize={48}
									name="Medido"
								/>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			<div className="grid gap-6 md:grid-cols-2">
				{accumulatedEvolutionData.length > 0 && (
					<Card>
						<CardHeaderWithIcon
							icon={AreaChartIcon}
							title="Evolução Acumulada"
							description="Evolução acumulada dos valores."
						/>
						<CardContent>
							<ResponsiveContainer width="100%" height={250}>
								<AreaChart
									data={accumulatedEvolutionData}
									margin={DEFAULT_MARGIN}
								>
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
										tickFormatter={formatCurrencyTick}
										tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<Tooltip
										content={
											<ChartTooltip
												formatter={(v: number) => [formatCurrency(v), ""]}
											/>
										}
									/>
									<Area
										type="monotone"
										dataKey="valor"
										fill={CHART_COLORS_ARRAY[2]}
										stroke={CHART_COLORS_ARRAY[2]}
										fillOpacity={0.2}
										strokeWidth={2}
										name="Valor"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</CardContent>
					</Card>
				)}

				{topItemsData.length > 0 && (
					<Card>
						<CardHeaderWithIcon
							icon={BarChart3}
							title="Top Itens Medidos"
							description="Itens com maior valor medido."
						/>
						<CardContent>
							<ResponsiveContainer width="100%" height={250}>
								<BarChart
									data={topItemsData}
									layout="vertical"
									margin={DEFAULT_MARGIN}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke={CHART_THEME.gridColor}
										horizontal={false}
									/>
									<XAxis
										type="number"
										tickFormatter={formatCurrencyTick}
										tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										dataKey="name"
										type="category"
										tick={{ fill: CHART_THEME.textColor, fontSize: 10 }}
										axisLine={false}
										tickLine={false}
										width={140}
									/>
									<Tooltip
										content={
											<ChartTooltip
												formatter={(v: number) => [formatCurrency(v), ""]}
											/>
										}
									/>
									<Bar
										dataKey="valor"
										fill={CHART_COLORS_ARRAY[3]}
										radius={[0, 4, 4, 0]}
										maxBarSize={20}
										name="Valor Medido"
									/>
								</BarChart>
							</ResponsiveContainer>
						</CardContent>
					</Card>
				)}
			</div>

			{balanceData.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Saldo por Etapa"
						description="Valor ainda disponível para medir; valores negativos indicam excedente."
					/>
					<CardContent>
						<div role="img" aria-label="Gráfico de saldo restante por etapa">
							<ResponsiveContainer
								width="100%"
								height={Math.max(260, balanceData.length * 44)}
							>
								<BarChart
									data={balanceData}
									layout="vertical"
									margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke={CHART_THEME.gridColor}
										horizontal={false}
									/>
									<XAxis
										type="number"
										domain={balanceDomain}
										tickFormatter={formatCurrencyTick}
										tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										dataKey="name"
										type="category"
										tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
										axisLine={false}
										tickLine={false}
										width={220}
										interval={0}
									/>
									<ReferenceLine
										x={0}
										stroke={CHART_THEME.textColor}
										strokeDasharray="4 4"
										strokeOpacity={0.55}
									/>
									<Tooltip
										content={
											<ChartTooltip
												formatter={(v: number) => [formatCurrency(v), ""]}
											/>
										}
									/>
									<Bar
										dataKey="saldo"
										fill={CHART_COLORS_ARRAY[0]}
										radius={[0, 4, 4, 0]}
										maxBarSize={28}
										name="Saldo"
									>
										{balanceData.map((entry) => (
											<Cell
												key={entry.name}
												fill={
													entry.saldo >= 0
														? CHART_STATUS_COLORS.healthy
														: CHART_STATUS_COLORS.critical
												}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-2">
								<span className="h-2.5 w-2.5 rounded-sm bg-primary" />
								Saldo disponível
							</span>
							{overrunCount > 0 && (
								<span className="inline-flex items-center gap-2">
									<span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
									{overrunCount} etapa(s) acima do orçamento
								</span>
							)}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function flattenMeasurementItems(
	items: MeasurementTreeItem[],
): MeasurementTreeItem[] {
	return items.flatMap((item) => [
		item,
		...flattenMeasurementItems(item.children),
	]);
}
