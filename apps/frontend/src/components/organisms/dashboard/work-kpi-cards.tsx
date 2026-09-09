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
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

interface WorkKPICardsProps {
	summary: WorkBIResponse["summary"];
	indicators: WorkBIResponse["indicators"];
}

interface KPIItem {
	label: string;
	value: string;
	icon: React.ComponentType<{ className?: string }>;
	tone: "good" | "attention" | "critical" | "unknown";
}

export function buildKPIs(
	summary: WorkBIResponse["summary"],
	indicators: WorkBIResponse["indicators"],
): KPIItem[] {
	const noInformation = "Sem informações";
	const availableValue = (key: keyof typeof indicators): number | null => {
		const indicator = indicators[key];
		return indicator.status === "AVAILABLE" &&
			indicator.value != null &&
			Number.isFinite(indicator.value)
			? indicator.value
			: null;
	};
	const indicatorAvailable = (key: keyof typeof indicators) =>
		availableValue(key) != null;
	const valueOrPlaceholder = (
		key: keyof typeof indicators,
		format: (value: number) => string,
	) => {
		const value = availableValue(key);
		return value != null ? format(value) : noInformation;
	};
	const toneForIndex = (
		key: "schedulePerformanceIndex" | "costPerformanceIndex",
	) => {
		const value = availableValue(key);
		return value != null ? classifyIndex(value) : "unknown";
	};
	const spiTone = toneForIndex("schedulePerformanceIndex");
	const cpiTone = toneForIndex("costPerformanceIndex");
	const selectedEac = availableValue("selectedEac");
	const bac = availableValue("bac");
	const vac = availableValue("vac");
	const tcpi = availableValue("tcpi");
	const balanceTone = classifyBalance(summary.balance);

	return [
		{
			label: "SPI (Prazo)",
			value: valueOrPlaceholder("schedulePerformanceIndex", (value) =>
				value.toFixed(2),
			),
			icon: CalendarClock,
			tone: spiTone,
		},
		{
			label: "CPI (Custo)",
			value: valueOrPlaceholder("costPerformanceIndex", (value) =>
				value.toFixed(2),
			),
			icon: Wallet,
			tone: cpiTone,
		},
		{
			label: "SV (Variação Prazo)",
			value: valueOrPlaceholder("scheduleVariance", formatCurrency),
			icon: TrendingUp,
			tone: spiTone,
		},
		{
			label: "CV (Variação Custo)",
			value: valueOrPlaceholder("costVariance", formatCurrency),
			icon: TrendingDown,
			tone: cpiTone,
		},
		{
			label: "% Conclusão",
			value: indicatorAvailable("earnedValue")
				? formatRatioAsPercentage(summary.measuredPercentage)
				: noInformation,
			icon: Ruler,
			tone: spiTone,
		},
		{
			label: "Saldo",
			value: valueOrPlaceholder("currentBudgetBalance", formatCurrency),
			icon: PiggyBank,
			tone: balanceTone,
		},
		{
			label: "EAC (Projeção)",
			value: valueOrPlaceholder("selectedEac", formatCurrency),
			icon: Wallet,
			tone:
				selectedEac == null || bac == null
					? "unknown"
					: selectedEac > bac
						? "critical"
						: "good",
		},
		{
			label: "ETC (Faltam)",
			value: valueOrPlaceholder("etc", formatCurrency),
			icon: TrendingDown,
			tone: "unknown",
		},
		{
			label: "VAC (Projeção)",
			value: valueOrPlaceholder("vac", formatCurrency),
			icon: TrendingUp,
			tone: vac == null ? "unknown" : vac < 0 ? "critical" : "good",
		},
		{
			label: "TCPI (Necessário)",
			value: valueOrPlaceholder("tcpi", (value) => value.toFixed(2)),
			icon: Ruler,
			tone: tcpi == null ? "unknown" : tcpi > 1 ? "critical" : "good",
		},
	];
}

export function WorkKPICards({ summary, indicators }: WorkKPICardsProps) {
	const kpis = buildKPIs(summary, indicators);

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
