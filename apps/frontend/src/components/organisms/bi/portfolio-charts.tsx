import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { EmptyState } from "@/atoms/empty-state";
import {
	CHART_COLORS,
	CHART_STATUS_COLORS,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import type { MultiworksBIResponse } from "@/types/bi";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

export type ScatterPoint = {
	workId: string;
	name: string;
	spi: number;
	cpi: number;
	measuredPercentage: number;
};

export function buildScatterSeries(works: MultiworksBIResponse["works"]) {
	const points: ScatterPoint[] = [];
	for (const work of works) {
		if (
			work.schedulePerformanceIndex != null &&
			work.costPerformanceIndex != null
		) {
			points.push({
				workId: work.workId,
				name: work.name,
				spi: work.schedulePerformanceIndex,
				cpi: work.costPerformanceIndex,
				measuredPercentage: work.measuredPercentage,
			});
		}
	}
	return {
		healthy: points.filter((p) => p.spi >= 1 && p.cpi >= 1),
		delayed: points.filter((p) => p.spi < 1 && p.cpi >= 1),
		overBudget: points.filter((p) => p.spi >= 1 && p.cpi < 1),
		critical: points.filter((p) => p.spi < 1 && p.cpi < 1),
	};
}

const PORTFOLIO_LEGEND = [
	{ label: "Valor Planejado", className: "bg-[var(--color-chart-1)]" },
	{ label: "Valor Agregado", className: "bg-[var(--color-chart-2)]" },
	{ label: "Custo Real", className: "bg-[var(--color-chart-3)]" },
];

export function CustoPorObraChart({
	data,
}: {
	data: MultiworksBIResponse["portfolioChart"];
}) {
	if (data.length === 0) {
		return (
			<EmptyState
				title="Nenhum dado de portfólio disponível"
				description="Os dados comparativos por obra serão exibidos aqui quando houver informações de portfólio."
			/>
		);
	}
	return (
		<div className="min-w-0">
			<div className="mb-4 flex flex-wrap items-center justify-end gap-4 text-xs font-medium text-muted-foreground">
				{PORTFOLIO_LEGEND.map((item) => (
					<span key={item.label} className="flex items-center gap-2">
						<span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
						{item.label}
					</span>
				))}
			</div>
			<div className="max-h-[520px] overflow-y-auto pr-1">
				<ResponsiveContainer
					width="100%"
					height={Math.max(data.length * 44 + 20, 260)}
				>
					<BarChart
						data={data}
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
							dataKey="workName"
							width={190}
							tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
							axisLine={false}
							tickLine={false}
						/>
						<Tooltip
							content={
								<ChartTooltip
									formatter={(value: number, name: string) => [
										formatCurrency(value),
										name,
									]}
								/>
							}
						/>
						<Bar
							dataKey="plannedValue"
							name="Valor Planejado"
							fill={CHART_COLORS.chart1}
							radius={[0, 4, 4, 0]}
							maxBarSize={18}
						/>
						<Bar
							dataKey="earnedValue"
							name="Valor Agregado"
							fill={CHART_COLORS.chart2}
							radius={[0, 4, 4, 0]}
							maxBarSize={18}
						/>
						<Bar
							dataKey="actualCost"
							name="Custo Real"
							fill={CHART_COLORS.chart3}
							radius={[0, 4, 4, 0]}
							maxBarSize={18}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

const SCATTER_LEGEND = [
	{ label: "Saudável", className: "bg-status-success" },
	{ label: "Atraso", className: "bg-status-warning" },
	{ label: "Estouro", className: "bg-status-warning" },
	{ label: "Crítico", className: "bg-status-danger" },
];

export function SpiCpiScatterChart({
	works,
}: {
	works: MultiworksBIResponse["works"];
}) {
	const series = useMemo(() => buildScatterSeries(works), [works]);
	const total =
		series.healthy.length +
		series.delayed.length +
		series.overBudget.length +
		series.critical.length;

	if (total === 0) {
		return (
			<EmptyState
				title="Nenhum dado de SPI/CPI disponível"
				description="Os índices de desempenho serão exibidos aqui quando houver dados de cronograma e custo."
			/>
		);
	}
	return (
		<div className="min-w-0">
			<div className="mb-4 flex flex-wrap items-center justify-end gap-4 text-xs font-medium text-muted-foreground">
				{SCATTER_LEGEND.map((item) => (
					<span key={item.label} className="flex items-center gap-2">
						<span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
						{item.label}
					</span>
				))}
			</div>
			<ResponsiveContainer width="100%" height={300}>
				<ScatterChart margin={DEFAULT_MARGIN}>
					<CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
					<XAxis
						type="number"
						dataKey="spi"
						name="SPI"
						domain={[0, "auto"]}
						tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
						axisLine={false}
						tickLine={false}
					/>
					<YAxis
						type="number"
						dataKey="cpi"
						name="CPI"
						domain={[0, "auto"]}
						tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
						axisLine={false}
						tickLine={false}
					/>
					<ZAxis range={[64, 64]} />
					<ReferenceLine
						x={1}
						stroke={CHART_THEME.gridColor}
						strokeDasharray="4 4"
					/>
					<ReferenceLine
						y={1}
						stroke={CHART_THEME.gridColor}
						strokeDasharray="4 4"
					/>
					<Tooltip
						content={<ScatterTooltip />}
						cursor={{ strokeDasharray: "3 3" }}
					/>
					<Scatter
						data={series.healthy}
						fill={CHART_STATUS_COLORS.healthy}
						name="Saudável"
					/>
					<Scatter
						data={series.delayed}
						fill={CHART_STATUS_COLORS.delayed}
						name="Atraso"
					/>
					<Scatter
						data={series.overBudget}
						fill={CHART_STATUS_COLORS.overBudget}
						name="Estouro"
					/>
					<Scatter
						data={series.critical}
						fill={CHART_STATUS_COLORS.critical}
						name="Crítico"
					/>
				</ScatterChart>
			</ResponsiveContainer>
		</div>
	);
}

interface ScatterTooltipPayload {
	payload: {
		name: string;
		cpi: number;
		spi: number;
		measuredPercentage: number;
	};
}

function ScatterTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: ScatterTooltipPayload[];
}) {
	if (!active || !payload?.length) return null;
	const entry = payload[0].payload;
	return (
		<div className="rounded-lg border bg-card px-3 py-2 shadow-md">
			<p className="mb-1 text-sm font-medium">{entry.name}</p>
			<div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
				<p>
					CPI:{" "}
					<span className="font-medium tabular-nums">
						{entry.cpi.toFixed(2)}
					</span>
				</p>
				<p>
					SPI:{" "}
					<span className="font-medium tabular-nums">
						{entry.spi.toFixed(2)}
					</span>
				</p>
				<p>
					% Medido:{" "}
					<span className="font-medium tabular-nums">
						{formatRatioAsPercentage(entry.measuredPercentage)}
					</span>
				</p>
			</div>
		</div>
	);
}
