import { AreaChart as AreaChartIcon, BarChart3, Target } from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	CHART_COLORS_ARRAY,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import type { MeasurementTreeItem } from "@/types/measurements";
import { formatCurrency, formatCurrencyTick } from "@/utils/format";

type MeasurementDetailChartsProps = {
	items: MeasurementTreeItem[];
	totals: {
		current: { measuredValue: number };
		accumulated: { measuredValue: number };
		balance: { value: number };
	} | null;
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

	const topItems = [...itemsList]
		.sort((a, b) => b.measuredAccumulated.value - a.measuredAccumulated.value)
		.slice(0, 10);

	const stageData = itemsList
		.filter((item) => item.children && item.children.length > 0)
		.map((stage) => ({
			name: stage.description.slice(0, 30),
			orcado: stage.totalCost,
			medido: stage.measuredAccumulated.value,
			saldo: stage.balanceToMeasure.value,
		}));

	const topItemsData = topItems.map((item) => ({
		name: (item.description || "").slice(0, 35),
		valor: item.measuredAccumulated.value,
	}));

	const balanceData = itemsList
		.filter((item) => !item.parentId || item.children?.length > 0)
		.map((stage) => ({
			name: (stage.description || "").slice(0, 25),
			saldo: stage.balanceToMeasure.value,
		}))
		.filter((d) => d.saldo !== 0);

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
						description="Saldo restante por etapa."
					/>
					<CardContent>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={balanceData} margin={DEFAULT_MARGIN}>
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
								<Bar
									dataKey="saldo"
									fill={CHART_COLORS_ARRAY[4]}
									radius={[4, 4, 0, 0]}
									maxBarSize={32}
									name="Saldo"
								>
									{balanceData.map((entry) => (
										<Cell
											key={entry.name}
											fill={
												entry.saldo >= 0
													? CHART_COLORS_ARRAY[0]
													: "var(--color-destructive)"
											}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
