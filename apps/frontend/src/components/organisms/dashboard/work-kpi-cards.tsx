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
	formatNullableCurrency,
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
	const spiTone = classifyIndex(summary.schedulePerformanceIndex);
	const cpiTone = classifyIndex(summary.costPerformanceIndex);
	const balanceTone = classifyBalance(summary.balance);

	return [
		{
			label: "SPI (Prazo)",
			value: summary.schedulePerformanceIndex?.toFixed(2) ?? "N/A",
			icon: CalendarClock,
			tone: spiTone,
		},
		{
			label: "CPI (Custo)",
			value: summary.costPerformanceIndex?.toFixed(2) ?? "N/A",
			icon: Wallet,
			tone: cpiTone,
		},
		{
			label: "SV (Variação Prazo)",
			value: formatNullableCurrency(summary.scheduleVariance),
			icon: TrendingUp,
			tone: spiTone,
		},
		{
			label: "CV (Variação Custo)",
			value: formatNullableCurrency(summary.costVariance),
			icon: TrendingDown,
			tone: cpiTone,
		},
		{
			label: "% Conclusão",
			value: formatRatioAsPercentage(summary.measuredPercentage),
			icon: Ruler,
			tone: spiTone,
		},
		{
			label: "Saldo",
			value: formatCurrency(summary.balance),
			icon: PiggyBank,
			tone: balanceTone,
		},
		{
			label: "EAC (Projeção)",
			value: formatNullableCurrency(summary.selectedEac),
			icon: Wallet,
			tone:
				summary.selectedEac != null && summary.selectedEac > summary.bac
					? "critical"
					: "good",
		},
		{
			label: "ETC (Faltam)",
			value: formatNullableCurrency(summary.etc),
			icon: TrendingDown,
			tone: "unknown",
		},
		{
			label: "VAC (Projeção)",
			value: formatNullableCurrency(summary.vac),
			icon: TrendingUp,
			tone: summary.vac != null && summary.vac < 0 ? "critical" : "good",
		},
		{
			label: "TCPI (Necessário)",
			value: summary.tcpi?.toFixed(2) ?? "N/A",
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
