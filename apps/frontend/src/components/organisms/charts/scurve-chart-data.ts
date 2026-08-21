import type { SCurvePoint } from "@/types/bi";

export type SCurveChartRow = {
	period: string;
	plannedAccumulated: number;
	measuredAccumulated: number | null;
	trendProjected: number | null;
};

export function buildSCurveChartData(points: SCurvePoint[]): SCurveChartRow[] {
	return points.map((point) => ({
		period: point.period,
		plannedAccumulated: point.plannedAccumulated,
		measuredAccumulated: point.measuredAccumulated,
		trendProjected: point.trendProjected,
	}));
}
