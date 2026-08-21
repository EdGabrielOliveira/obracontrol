import { useMemo } from "react";
import {
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
	CHART_STATUS_COLORS,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import type { CostByStage } from "@/types/bi";

type StagePoint = {
	stageId: string;
	name: string;
	spi: number;
	cpi: number;
};

function buildStagePoints(stages: CostByStage[]): {
	healthy: StagePoint[];
	delayed: StagePoint[];
	overBudget: StagePoint[];
	critical: StagePoint[];
} {
	const points: StagePoint[] = [];
	for (const stage of stages) {
		if (
			stage.schedulePerformanceIndex != null &&
			stage.costPerformanceIndex != null
		) {
			points.push({
				stageId: stage.stageId,
				name: stage.stageName,
				spi: stage.schedulePerformanceIndex,
				cpi: stage.costPerformanceIndex,
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

interface StageScatterTooltipPayload {
	payload: { name: string; cpi: number; spi: number };
}

function StageScatterTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: StageScatterTooltipPayload[];
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
			</div>
		</div>
	);
}

export function StageSpiCpiScatterChart({ stages }: { stages: CostByStage[] }) {
	const series = useMemo(() => buildStagePoints(stages), [stages]);
	const total =
		series.healthy.length +
		series.delayed.length +
		series.overBudget.length +
		series.critical.length;

	if (total === 0) {
		return (
			<EmptyState
				title="Nenhum dado de SPI/CPI por etapa"
				description="Os índices por etapa aparecerão quando houver cronograma, medições e custos nas etapas."
			/>
		);
	}

	return (
		<div className="min-w-0">
			<div className="mb-4 flex flex-wrap items-center justify-end gap-4 text-xs font-medium text-muted-foreground">
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-status-success" />
					Saudável
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-status-warning" />
					Atraso
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-status-warning" />
					Estouro
				</span>
				<span className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-status-danger" />
					Crítico
				</span>
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
						content={<StageScatterTooltip />}
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
