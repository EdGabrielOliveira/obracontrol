import type { StatusTone } from "@/components/atoms/status-badge";

export type HealthTone = "good" | "attention" | "critical" | "unknown";

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

export function classifyBalance(value: number): "good" | "critical" {
	return value < 0 ? "critical" : "good";
}
