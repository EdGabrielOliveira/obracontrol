import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { SCurvePoint } from "@/types/bi";
import { formatRatioAsPercentage } from "@/utils/format";
import { CHART_COLORS, CHART_THEME, DEFAULT_MARGIN } from "./chart-config";
import { ChartTooltip } from "./chart-tooltip";
import { buildSCurveChartData } from "./scurve-chart-data";

interface SCurveChartProps {
	points: SCurvePoint[];
}

export function SCurveChart({ points }: SCurveChartProps) {
	const data = buildSCurveChartData(points);

	if (data.length === 0) return null;

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-foreground">
						Evolução acumulada
					</p>
					<p className="text-xs text-muted-foreground">
						Planejado, medido e tendencia da obra.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
					<span className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-1)]" />
						Planejado
					</span>
					<span className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-2)]" />
						Medido
					</span>
					<span className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-3)]" />
						Tendência
					</span>
				</div>
			</div>

			<div className="h-96 w-full min-w-0 bg-muted/40 py-4 pr-6">
				<ResponsiveContainer width="100%" height={352}>
					<LineChart data={data} margin={DEFAULT_MARGIN}>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke={CHART_THEME.gridColor}
							vertical={false}
						/>
						<XAxis
							dataKey="period"
							tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
							axisLine={false}
							tickLine={false}
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
						<Line
							type="monotone"
							dataKey="plannedAccumulated"
							name="Planejado"
							stroke={CHART_COLORS.chart1}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 3 }}
						/>
						<Line
							type="monotone"
							dataKey="measuredAccumulated"
							name="Medido"
							stroke={CHART_COLORS.chart2}
							strokeWidth={4}
							dot={{ r: 3, strokeWidth: 2, fill: "var(--color-background)" }}
							activeDot={{ r: 5 }}
							connectNulls
						/>
						<Line
							type="monotone"
							dataKey="trendProjected"
							name="Tendência"
							stroke={CHART_COLORS.chart3}
							strokeWidth={2}
							strokeDasharray="5 5"
							dot={false}
							activeDot={{ r: 3 }}
							connectNulls
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
