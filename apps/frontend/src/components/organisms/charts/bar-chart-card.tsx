import type { LucideIcon } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	CHART_COLORS_ARRAY,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "./chart-config";
import { ChartTooltip } from "./chart-tooltip";

interface BarChartCardProps {
	title: string;
	description?: string;
	icon?: LucideIcon;
	data: Record<string, unknown>[];
	dataKey: string;
	xAxisKey?: string;
	color?: string;
	height?: number;
	formatter?: (value: number, name: string) => [string, string];
	layout?: "horizontal" | "vertical";
}

export function BarChartCard({
	title,
	description,
	icon,
	data,
	dataKey,
	xAxisKey = "name",
	color,
	height = 300,
	formatter,
	layout = "vertical",
}: BarChartCardProps) {
	const barColor = color || CHART_COLORS_ARRAY[0];
	const horizontal = layout === "horizontal";

	return (
		<Card>
			{icon ? (
				<CardHeaderWithIcon
					icon={icon}
					title={title}
					description={description ?? ""}
				/>
			) : (
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					{description && <CardDescription>{description}</CardDescription>}
				</CardHeader>
			)}
			<CardContent className="min-w-0">
				<ResponsiveContainer width="100%" height={height}>
					<BarChart
						data={data}
						margin={DEFAULT_MARGIN}
						layout={horizontal ? "vertical" : "horizontal"}
					>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke={CHART_THEME.gridColor}
							vertical={horizontal}
						/>
						<XAxis
							dataKey={horizontal ? dataKey : xAxisKey}
							type={horizontal ? "number" : "category"}
							tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
							axisLine={false}
							tickLine={false}
						/>
						<YAxis
							dataKey={horizontal ? xAxisKey : undefined}
							type={horizontal ? "category" : "number"}
							tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
							axisLine={false}
							tickLine={false}
						/>
						<Tooltip content={<ChartTooltip formatter={formatter} />} />
						<Bar
							dataKey={dataKey}
							fill={barColor}
							radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
							maxBarSize={48}
						/>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
