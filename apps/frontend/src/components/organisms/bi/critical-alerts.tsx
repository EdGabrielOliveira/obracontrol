import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import type { MultiworksBIResponse } from "@/types/bi";
import { classifyIndex, type HealthTone } from "@/utils/evm-health";

const MAX_ALERTS = 10;

interface CriticalAlertsProps {
	works: MultiworksBIResponse["works"];
}

export type AlertItem = {
	workId: string;
	workName: string;
	metric: "SPI" | "CPI";
	value: number;
	tone: Extract<HealthTone, "attention" | "critical">;
};

const toneRank: Record<HealthTone, number> = {
	critical: 0,
	attention: 1,
	good: 2,
	unknown: 3,
};

export function buildAlertItems(
	works: MultiworksBIResponse["works"],
): AlertItem[] {
	const items: AlertItem[] = [];
	for (const work of works) {
		const candidates: AlertItem[] = [];
		for (const [metric, value] of [
			["SPI", work.schedulePerformanceIndex],
			["CPI", work.costPerformanceIndex],
		] as const) {
			const tone = classifyIndex(value);
			if (tone === "attention" || tone === "critical") {
				candidates.push({
					workId: work.workId,
					workName: work.name,
					metric,
					value: value as number,
					tone,
				});
			}
		}
		if (candidates.length > 0) {
			items.push(
				candidates.reduce((worst, candidate) =>
					toneRank[candidate.tone] < toneRank[worst.tone] ||
					(toneRank[candidate.tone] === toneRank[worst.tone] &&
						candidate.value < worst.value)
						? candidate
						: worst,
				),
			);
		}
	}
	return items.sort(
		(a, b) => toneRank[a.tone] - toneRank[b.tone] || a.value - b.value,
	);
}

export function CriticalAlerts({ works }: CriticalAlertsProps) {
	const alerts = buildAlertItems(works).slice(0, MAX_ALERTS);

	if (alerts.length === 0) return null;

	return (
		<div className="status-danger rounded-xl py-3 pb-0">
			<CardHeaderWithIcon
				icon={AlertTriangle}
				title={`Alertas de desempenho (${alerts.length})`}
				description="Obras com indicadores críticos"
			/>
			<div className="flex flex-wrap gap-2 px-6 pb-4">
				{alerts.map((alert) => (
					<Link
						key={`${alert.workId}-${alert.metric}`}
						to="/app/obras/$workId"
						params={{ workId: alert.workId }}
						className={`link-navigation rounded-full mt-2 px-3 py-1 text-xs font-bold transition-opacity hover:opacity-80 ${
							alert.tone === "critical" ? "status-danger" : "status-warning"
						}`}
					>
						{alert.workName} · {alert.metric} {alert.value.toFixed(2)}
					</Link>
				))}
			</div>
		</div>
	);
}
