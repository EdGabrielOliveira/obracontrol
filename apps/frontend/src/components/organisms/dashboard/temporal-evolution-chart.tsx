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
import { formatRatioAsPercentage } from "@/utils/format";

interface TemporalEvolutionChartProps {
	data: MultiworksBIResponse["scheduleByWork"];
}

type ChartRow = {
	name: string;
	planejado: number;
	medido: number;
};

function buildChartData(
	data: MultiworksBIResponse["scheduleByWork"],
): ChartRow[] {
	return data
		.filter(
			(item) => item.plannedPercentage != null || item.measuredPercentage > 0,
		)
		.map((item) => ({
			name: item.name,
			planejado: item.plannedPercentage ?? 0,
			medido: item.measuredPercentage,
		}));
}

export function TemporalEvolutionChart({ data }: TemporalEvolutionChartProps) {
	const chartData = buildChartData(data);

	if (chartData.length === 0) return null;

	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="mb-4">
				<p className="text-sm font-semibold text-foreground">
					Evolução Temporal
				</p>
				<p className="text-xs text-muted-foreground">
					Percentual planejado versus medido por obra.
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground mb-4">
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-1)]" />
					Planejado
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-2)]" />
					Medido
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
							tickFormatter={(value) => formatRatioAsPercentage(Number(value))}
						/>
						<Tooltip
							content={
								<ChartTooltip
									formatter={(value, name) => [
										formatRatioAsPercentage(value),
										name,
									]}
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
							dataKey="medido"
							name="Medido"
							fill={CHART_COLORS.chart2}
							radius={[3, 3, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
