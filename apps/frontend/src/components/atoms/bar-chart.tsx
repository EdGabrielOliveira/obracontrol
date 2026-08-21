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
	CHART_COLORS_ARRAY,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import { formatCurrency, formatCurrencyTick } from "@/utils/format";

interface BarChartComponentProps {
	data: Record<string, unknown>[];
	height?: number;

	currency?: boolean;
}

export function BarChartComponent({
	data,
	height = 250,
	currency = false,
}: BarChartComponentProps) {
	if (!data || data.length === 0) return null;

	const keys = Object.keys(data[0] || {}).filter((k) => k !== "name");

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} margin={DEFAULT_MARGIN}>
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
					tickFormatter={currency ? formatCurrencyTick : undefined}
					tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
					axisLine={false}
					tickLine={false}
				/>
				<Tooltip
					content={
						<ChartTooltip
							formatter={
								currency ? (v: number) => [formatCurrency(v), ""] : undefined
							}
						/>
					}
				/>
				{keys.map((key, i) => (
					<Bar
						key={key}
						dataKey={key}
						fill={CHART_COLORS_ARRAY[i % CHART_COLORS_ARRAY.length]}
						radius={[4, 4, 0, 0]}
						maxBarSize={48}
					/>
				))}
			</BarChart>
		</ResponsiveContainer>
	);
}
