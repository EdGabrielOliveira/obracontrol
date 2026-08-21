export const CHART_COLORS = {
	chart1: "var(--color-chart-1)",
	chart2: "var(--color-chart-2)",
	chart3: "var(--color-chart-3)",
	chart4: "var(--color-chart-4)",
	chart5: "var(--color-chart-5)",
	chart6: "var(--color-chart-6)",
} as const;

export const CHART_COLORS_ARRAY = [
	CHART_COLORS.chart1,
	CHART_COLORS.chart2,
	CHART_COLORS.chart3,
	CHART_COLORS.chart4,
	CHART_COLORS.chart5,
	CHART_COLORS.chart6,
];

export const CHART_STATUS_COLORS = {
	healthy: CHART_COLORS.chart2,
	delayed: CHART_COLORS.chart3,
	overBudget: CHART_COLORS.chart4,
	critical: CHART_COLORS.chart5,
} as const;

export const CHART_THEME = {
	backgroundColor: "transparent",
	textColor: "var(--color-foreground)",
	gridColor: "var(--color-border)",
	tooltipBg: "var(--color-card)",
	tooltipBorder: "var(--color-border)",
} as const;

export const DEFAULT_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 };

export type ChartColorKey = keyof typeof CHART_COLORS;
