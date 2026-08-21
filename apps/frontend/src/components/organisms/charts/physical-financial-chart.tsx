import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { BudgetViewResponse } from "@/types/budget";
import { formatCurrency } from "@/utils/format";
import {
	formatPeriodLabel,
	type SchedulePeriod,
} from "@/utils/schedule-period";
import { CHART_COLORS, CHART_THEME, DEFAULT_MARGIN } from "./chart-config";
import { ChartTooltip } from "./chart-tooltip";

interface PhysicalFinancialChartProps {
	data:
		| Pick<BudgetViewResponse["physicalFinancial"], "totals">
		| null
		| undefined;
	period: SchedulePeriod;
}

type PhysicalFinancialChartRow = {
	period: string;
	planned: number | null;
	measured: number | null;
	actual: number | null;
	plannedAccumulated: number | null;
	measuredAccumulated: number | null;
	actualAccumulated: number | null;
};

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
	notation: "compact",
});

function buildChartData(
	totals: NonNullable<PhysicalFinancialChartProps["data"]>["totals"],
	period: SchedulePeriod,
): PhysicalFinancialChartRow[] {
	return totals.months.map((key, i) => ({
		period: formatPeriodLabel(key, period),
		planned: totals.plannedByMonth[i] ?? null,
		measured: totals.measuredByMonth[i] ?? null,
		actual: totals.actualByMonth?.[i] ?? null,
		plannedAccumulated: totals.plannedAccumulated[i] ?? null,
		measuredAccumulated: totals.measuredAccumulated[i] ?? null,
		actualAccumulated: totals.actualAccumulated?.[i] ?? null,
	}));
}

function axisTickLabel(label: string, period: SchedulePeriod): string {
	if (period === "monthly") return label;

	const prefix = period === "weekly" ? "1ª semana " : "1ª quinzena ";
	return label.startsWith(prefix) ? label.slice(prefix.length) : "";
}

export function PhysicalFinancialChart({
	data,
	period,
}: PhysicalFinancialChartProps) {
	const totals = data?.totals;
	if (!totals || totals.months.length === 0) return null;

	const rows = buildChartData(totals, period);

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center justify-end gap-4 text-xs font-medium text-muted-foreground">
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
					Planejado Acum.
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-4)]" />
					Medido Acum.
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-5)]" />
					Realizado
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-6)]" />
					Realizado Acum.
				</span>
			</div>

			<div className="h-80 w-full min-w-0 bg-muted/40 py-4 pr-6">
				<ResponsiveContainer width="100%" height="100%">
					<ComposedChart data={rows} margin={DEFAULT_MARGIN}>
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
							interval={0}
							tickFormatter={(value) => axisTickLabel(String(value), period)}
						/>
						<YAxis
							tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
							axisLine={false}
							tickLine={false}
							tickFormatter={(value) =>
								compactCurrencyFormatter.format(Number(value))
							}
						/>
						<Tooltip
							content={
								<ChartTooltip
									formatter={(value, name) => [formatCurrency(value), name]}
								/>
							}
						/>
						<Bar
							dataKey="planned"
							name="Planejado"
							fill={CHART_COLORS.chart1}
							radius={[3, 3, 0, 0]}
						/>
						<Bar
							dataKey="measured"
							name="Medido"
							fill={CHART_COLORS.chart2}
							radius={[3, 3, 0, 0]}
						/>
						<Bar
							dataKey="actual"
							name="Realizado"
							fill={CHART_COLORS.chart5}
							radius={[3, 3, 0, 0]}
						/>
						<Line
							type="monotone"
							dataKey="plannedAccumulated"
							name="Planejado Acum."
							stroke={CHART_COLORS.chart3}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 3 }}
							connectNulls
						/>
						<Line
							type="monotone"
							dataKey="measuredAccumulated"
							name="Medido Acum."
							stroke={CHART_COLORS.chart4}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 3 }}
							connectNulls
						/>
						<Line
							type="monotone"
							dataKey="actualAccumulated"
							name="Realizado Acum."
							stroke={CHART_COLORS.chart6}
							strokeWidth={2}
							strokeDasharray="4 3"
							dot={false}
							activeDot={{ r: 3 }}
							connectNulls
						/>
					</ComposedChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
