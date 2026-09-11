import type { StatusTone } from "@/components/atoms/status-badge";

export type HealthTone = "good" | "attention" | "critical" | "unknown";
export type KpiTone = "default" | "success" | "warning" | "danger";

export const HEALTH_TONE: Record<
	HealthTone,
	{
		badge: StatusTone | undefined;
		card: string;
		text: string;
		icon: string;
		bar: string;
	}
> = {
	good: {
		badge: "success",
		card: "status-success",
		text: "text-success",
		icon: "bg-success/10 text-success",
		bar: "bg-status-success",
	},
	attention: {
		badge: "warning",
		card: "status-warning",
		text: "text-warning",
		icon: "bg-warning/10 text-warning",
		bar: "bg-status-warning",
	},
	critical: {
		badge: "danger",
		card: "status-danger",
		text: "text-destructive",
		icon: "bg-destructive/10 text-destructive",
		bar: "bg-status-danger",
	},
	unknown: {
		badge: "neutral",
		card: "border-border bg-card",
		text: "text-muted-foreground",
		icon: "bg-muted text-muted-foreground",
		bar: "bg-muted",
	},
};

export function classifyIndex(value: number | null | undefined): HealthTone {
	if (value == null) return "unknown";
	if (value >= 1) return "good";
	if (value >= 0.9) return "attention";
	return "critical";
}

/**
 * Classifica IDC/IDP para uso direto nos cards da visão geral.
 * >= 1: positivo, >= 0,90: atenção, abaixo de 0,90: negativo.
 */
export function classifyKpiIndex(value: number | null | undefined): KpiTone {
	const tone = classifyIndex(value);
	if (tone === "good") return "success";
	if (tone === "attention") return "warning";
	if (tone === "critical") return "danger";
	return "default";
}

export function classifyKpiBalance(value: number | null | undefined): KpiTone {
	if (value == null) return "default";
	if (value > 0) return "success";
	if (value < 0) return "danger";
	return "default";
}

export function classifyKpiEac(
	eac: number | null | undefined,
	bac: number | null | undefined,
): KpiTone {
	if (eac == null || bac == null) return "default";
	return eac > bac ? "danger" : "success";
}

export function classifyBalance(value: number): "good" | "critical" {
	return value < 0 ? "critical" : "good";
}
