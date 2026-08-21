import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS_ARRAY } from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import type { MultiworksBIResponse, WorkBIResponse } from "@/types/bi";
import { formatCurrency } from "@/utils/format";

interface CostPieChartProps {
	data: MultiworksBIResponse["costsByWork"] | WorkBIResponse["costByStage"];
	title?: string;
}

type ChartRow = {
	name: string;
	value: number;
};

function isCostByStage(
	data: MultiworksBIResponse["costsByWork"] | WorkBIResponse["costByStage"],
): data is WorkBIResponse["costByStage"] {
	return Array.isArray(data) && data.length > 0 && "stageName" in data[0];
}

function buildChartData(
	data: MultiworksBIResponse["costsByWork"] | WorkBIResponse["costByStage"],
): ChartRow[] {
	if (isCostByStage(data)) {
		return data.map((item) => ({
			name: item.stageName,
			value: Number(item.executedValue) ?? 0,
		}));
	}
	return data.map((item) => ({
		name: item.name,
		value: Number(item.executedValue) ?? 0,
	}));
}

const RADIAN = Math.PI / 180;

function renderCustomLabel(props: {
	cx?: number;
	cy?: number;
	midAngle?: number;
	innerRadius?: number;
	outerRadius?: number;
	percent?: number;
}) {
	const cx = props.cx ?? 0;
	const cy = props.cy ?? 0;
	const midAngle = props.midAngle ?? 0;
	const innerRadius = props.innerRadius ?? 0;
	const outerRadius = props.outerRadius ?? 0;
	const percent = props.percent ?? 0;

	const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
	const x = cx + radius * Math.cos(-midAngle * RADIAN);
	const y = cy + radius * Math.sin(-midAngle * RADIAN);

	if (percent < 0.05) return null;

	return (
		<text
			x={x}
			y={y}
			fill="white"
			textAnchor="middle"
			dominantBaseline="central"
			fontSize={12}
			fontWeight={600}
		>
			{`${(percent * 100).toFixed(0)}%`}
		</text>
	);
}

export function CostPieChart({
	data,
	title = "Distribuição de Custos",
}: CostPieChartProps) {
	const chartData = buildChartData(data).filter((item) => item.value > 0);

	if (chartData.length === 0) return null;

	const total = chartData.reduce((sum, item) => sum + item.value, 0);

	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="mb-4">
				<p className="text-sm font-semibold text-foreground">{title}</p>
				<p className="text-xs text-muted-foreground">
					Total: {formatCurrency(total)}
				</p>
			</div>
			<div className="flex flex-wrap gap-4">
				<div className="h-64 w-64 min-w-0">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={chartData}
								cx="50%"
								cy="50%"
								innerRadius={60}
								outerRadius={100}
								paddingAngle={2}
								dataKey="value"
								labelLine={false}
								label={renderCustomLabel}
							>
								{chartData.map((item, index) => (
									<Cell
										key={item.name}
										fill={CHART_COLORS_ARRAY[index % CHART_COLORS_ARRAY.length]}
									/>
								))}
							</Pie>
							<Tooltip
								content={
									<ChartTooltip
										formatter={(value) => [formatCurrency(value), "Valor"]}
									/>
								}
							/>
						</PieChart>
					</ResponsiveContainer>
				</div>
				<div className="flex flex-col gap-2 text-xs">
					{chartData.map((item, index) => (
						<div key={item.name} className="flex items-center gap-2">
							<span
								className="h-3 w-3 rounded-full"
								style={{
									backgroundColor:
										CHART_COLORS_ARRAY[index % CHART_COLORS_ARRAY.length],
								}}
							/>
							<span className="text-muted-foreground truncate max-w-[150px]">
								{item.name}
							</span>
							<span className="font-medium ml-auto">
								{formatCurrency(item.value)}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
