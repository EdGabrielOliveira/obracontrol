import {
	CalendarClock,
	PiggyBank,
	Ruler,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkBIResponse } from "@/types/bi";
import {
	classifyBalance,
	classifyIndex,
	HEALTH_TONE,
} from "@/utils/evm-health";
import {
	formatCurrency,
	formatRatioAsPercentage,
} from "@/utils/format";

interface WorkKPICardsProps {
	summary: WorkBIResponse["summary"];
}

interface KPIItem {
	label: string;
	value: string;
	icon: React.ComponentType<{ className?: string }>;
	tone: "good" | "attention" | "critical" | "unknown";
}

export function buildKPIs(summary: WorkBIResponse["summary"]): KPIItem[] {
	const noInformation = "Sem informações";
	const completeness = summary.dataCompleteness;
	const hasProjectionData =
		completeness.hasBudget &&
		completeness.hasMeasurements &&
		completeness.hasActualCosts;
	const valueOrPlaceholder = (
		available: boolean,
		value: number | null | undefined,
		format: (value: number) => string,
	) =>
		available && value != null && Number.isFinite(value)
			? format(value)
			: noInformation;
	const spiTone = classifyIndex(summary.schedulePerformanceIndex);
	const cpiTone = classifyIndex(summary.costPerformanceIndex);
	const balanceTone = classifyBalance(summary.balance);

	return [
		{
			label: "SPI (Prazo)",
			value: valueOrPlaceholder(
				completeness.hasBaselineSchedule && completeness.hasMeasurements,
				summary.schedulePerformanceIndex,
				(value) => value.toFixed(2),
			),
			icon: CalendarClock,
			tone: spiTone,
		},
		{
			label: "CPI (Custo)",
			value: valueOrPlaceholder(
				completeness.hasMeasurements && completeness.hasActualCosts,
				summary.costPerformanceIndex,
				(value) => value.toFixed(2),
			),
			icon: Wallet,
			tone: cpiTone,
		},
		{
			label: "SV (Variação Prazo)",
			value: valueOrPlaceholder(
				completeness.hasBaselineSchedule && completeness.hasMeasurements,
				summary.scheduleVariance,
				formatCurrency,
			),
			icon: TrendingUp,
			tone: spiTone,
		},
		{
			label: "CV (Variação Custo)",
			value: valueOrPlaceholder(
				completeness.hasMeasurements && completeness.hasActualCosts,
				summary.costVariance,
				formatCurrency,
			),
			icon: TrendingDown,
			tone: cpiTone,
		},
		{
			label: "% Conclusão",
			value: completeness.hasMeasurements
				? formatRatioAsPercentage(summary.measuredPercentage)
				: noInformation,
			icon: Ruler,
			tone: spiTone,
		},
		{
			label: "Saldo",
			value: completeness.hasBudget
				? formatCurrency(summary.balance)
				: noInformation,
			icon: PiggyBank,
			tone: balanceTone,
		},
		{
			label: "EAC (Projeção)",
			value: valueOrPlaceholder(
				hasProjectionData,
				summary.selectedEac,
				formatCurrency,
			),
			icon: Wallet,
			tone:
				summary.selectedEac != null && summary.selectedEac > summary.bac
					? "critical"
					: "good",
		},
		{
			label: "ETC (Faltam)",
			value: valueOrPlaceholder(hasProjectionData, summary.etc, formatCurrency),
			icon: TrendingDown,
			tone: "unknown",
		},
		{
			label: "VAC (Projeção)",
			value: valueOrPlaceholder(hasProjectionData, summary.vac, formatCurrency),
			icon: TrendingUp,
			tone: summary.vac != null && summary.vac < 0 ? "critical" : "good",
		},
		{
			label: "TCPI (Necessário)",
			value: valueOrPlaceholder(
				hasProjectionData,
				summary.tcpi,
				(value) => value.toFixed(2),
			),
			icon: Ruler,
			tone: summary.tcpi != null && summary.tcpi > 1 ? "critical" : "good",
		},
	];
}

export function WorkKPICards({ summary }: WorkKPICardsProps) {
	const kpis = buildKPIs(summary);

	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
			{kpis.map((kpi) => {
				const visual = HEALTH_TONE[kpi.tone];
				return (
					<Card key={kpi.label} className="card-shadow">
						<CardContent className="flex flex-col gap-2 p-4">
							<div className="flex items-center gap-2">
								<kpi.icon className={`h-4 w-4 ${visual.icon}`} />
								<span className="text-xs font-medium text-muted-foreground">
									{kpi.label}
								</span>
							</div>
							<span className={`text-lg font-bold ${visual.text}`}>
								{kpi.value}
							</span>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
