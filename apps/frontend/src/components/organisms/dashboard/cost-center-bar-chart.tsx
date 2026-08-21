import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	CHART_COLORS,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import type { MultiworksBIResponse } from "@/types/bi";
import { formatCurrency } from "@/utils/format";

interface CostCenterBarChartProps {
	data: MultiworksBIResponse["costsByWork"];
}

type ChartRow = {
	name: string;
	planejado: number;
	executado: number;
	real: number;
};

function buildChartData(data: MultiworksBIResponse["costsByWork"]): ChartRow[] {
	return data.map((item) => ({
		name: item.name,
		planejado: item.budget,
		executado: item.executedValue,
		real: item.activeBudget,
	}));
}

export function CostCenterBarChart({ data }: CostCenterBarChartProps) {
	const chartData = buildChartData(data);

	if (chartData.length === 0) return null;

	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="mb-4">
				<p className="text-sm font-semibold text-foreground">Custos por Obra</p>
				<p className="text-xs text-muted-foreground">
					Comparativo entre valor planejado, executado e real por obra.
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground mb-4">
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-1)]" />
					Planejado
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-2)]" />
					Executado
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-3)]" />
					Real
				</span>
			</div>
			<div className="h-80 w-full min-w-0">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={chartData} margin={DEFAULT_MARGIN}>
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
							interval={0}
							angle={-45}
							textAnchor="end"
							height={80}
						/>
						<YAxis
							tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
							axisLine={false}
							tickLine={false}
							tickFormatter={(value) => formatCurrency(value)}
						/>
						<Tooltip
							content={
								<ChartTooltip
									formatter={(value, name) => [formatCurrency(value), name]}
								/>
							}
						/>
						<Bar
							dataKey="planejado"
							name="Planejado"
							fill={CHART_COLORS.chart1}
							radius={[3, 3, 0, 0]}
						/>
						<Bar
							dataKey="executado"
							name="Executado"
							fill={CHART_COLORS.chart2}
							radius={[3, 3, 0, 0]}
						/>
						<Bar
							dataKey="real"
							name="Real"
							fill={CHART_COLORS.chart3}
							radius={[3, 3, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
