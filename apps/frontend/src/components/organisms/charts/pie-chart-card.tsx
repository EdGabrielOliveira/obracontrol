import type { LucideIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

interface PieChartCardProps {
	title: string;
	description?: string;
	icon?: LucideIcon;
	data: Array<{ name: string; value: number }>;
	colors?: string[];
	height?: number;
	innerRadius?: number;
	outerRadius?: number;
	centerLabel?: string;
	formatter?: (value: number, name: string) => [string, string];
}

export function PieChartCard({
	title,
	description,
	icon,
	data,
	colors,
	height = 300,
	innerRadius = 60,
	outerRadius = 100,
	centerLabel,
	formatter,
}: PieChartCardProps) {
	const sliceColors = data.map(
		(_, index) => colors?.[index] ?? `hsl(var(--chart-${(index % 5) + 1}))`,
	);
	const chartConfig = Object.fromEntries(
		data.map((entry, index) => [
			entry.name,
			{
				label: entry.name,
				color: sliceColors[index],
			},
		]),
	) satisfies ChartConfig;

	const total = data.reduce((sum, entry) => sum + entry.value, 0);

	return (
		<div className="flex flex-col items-center">
			{icon ? (
				<CardHeaderWithIcon
					icon={icon}
					title={title}
					description={description ?? ""}
				/>
			) : (
				<div className="mb-2">
					<p className="text-sm font-semibold text-foreground">{title}</p>
					{description && (
						<p className="text-xs text-muted-foreground">{description}</p>
					)}
				</div>
			)}
			<div
				className="relative mx-auto aspect-square max-h-[250px]"
				style={{ height }}
			>
				<ChartContainer config={chartConfig} className="h-full w-full">
					<PieChart accessibilityLayer>
						<ChartTooltip
							content={
								<ChartTooltipContent
									nameKey="name"
									formatter={
										formatter
											? (value, name) => {
													const result = formatter(
														value as number,
														name as string,
													);
													return result;
												}
											: undefined
									}
									hideLabel
								/>
							}
						/>
						<Pie
							data={data}
							dataKey="value"
							nameKey="name"
							innerRadius={innerRadius}
							outerRadius={outerRadius}
							paddingAngle={2}
							strokeWidth={0}
						>
							{data.map((entry, index) => (
								<Cell
									key={`${entry.name}-${entry.value}`}
									fill={sliceColors[index]}
								/>
							))}
						</Pie>
						<ChartLegend
							content={<ChartLegendContent nameKey="name" />}
							className="-mt-4 flex-wrap gap-2 [&>svg]:h-3 [&>svg]:w-3"
						/>
					</PieChart>
				</ChartContainer>
				{centerLabel && (
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
						<span className="text-3xl font-bold text-foreground">
							{formatter
								? formatter(total, "total")[0]
								: total.toLocaleString()}
						</span>
						<span className="text-sm text-muted-foreground">{centerLabel}</span>
					</div>
				)}
			</div>
		</div>
	);
}
