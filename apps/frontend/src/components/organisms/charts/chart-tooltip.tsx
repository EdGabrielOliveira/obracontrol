import { CHART_COLORS_ARRAY, CHART_THEME } from "./chart-config";

interface ChartTooltipProps {
	active?: boolean;
	payload?: Array<{
		name: string;
		value: number;
		color?: string;
		dataKey?: string;
	}>;
	label?: string;
	formatter?: (value: number, name: string) => [string, string];
}

export function ChartTooltip({
	active,
	payload,
	label,
	formatter,
}: ChartTooltipProps) {
	if (!active || !payload?.length) return null;

	return (
		<div
			className="rounded-lg border bg-card px-3 py-2 shadow-md"
			style={{
				borderColor: CHART_THEME.tooltipBorder,
				backgroundColor: CHART_THEME.tooltipBg,
			}}
		>
			{label && (
				<p className="mb-1 text-sm font-medium text-muted-foreground">
					{label}
				</p>
			)}
			<div className="flex flex-col gap-1">
				{payload.map((entry, index) => {
					const color =
						entry.color ||
						CHART_COLORS_ARRAY[index % CHART_COLORS_ARRAY.length];
					const [displayValue, displayName] = formatter
						? formatter(entry.value, entry.name)
						: [entry.value.toLocaleString(), entry.name];

					return (
						<div
							key={entry.dataKey ?? index}
							className="flex items-center gap-2 text-sm"
						>
							<span
								className="h-2 w-2 shrink-0 rounded-full"
								style={{ backgroundColor: color }}
							/>
							<span className="text-muted-foreground">{displayName}:</span>
							<span className="font-medium">{displayValue}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
