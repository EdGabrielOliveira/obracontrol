import type { ReactNode } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

type KpiTone = "default" | "success" | "danger" | "warning";
type KpiStatus = "available" | "unavailable";

interface KpiCardProps {
	title: string;
	value: string | number;
	status?: KpiStatus;
	tone?: KpiTone;
	sparkline?: ReactNode;
}

const toneClasses: Record<KpiTone, string> = {
	default: "text-foreground",
	success: "text-primary",
	danger: "text-destructive",
	warning: "text-warning",
};

export function KpiCard({
	title,
	value,
	status = "available",
	tone = "default",
	sparkline,
}: KpiCardProps) {
	if (status === "unavailable") {
		return (
			<Card className="card-shadow">
				<CardContent className="p-4">
					<CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{title}
					</CardTitle>
					<p className="mt-1 text-sm text-muted-foreground italic">
						Indisponível
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="card-shadow">
			<CardContent className="p-4">
				<CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{title}
				</CardTitle>
				<p className={`mt-1 text-2xl font-bold ${toneClasses[tone]}`}>
					{value}
				</p>
				{sparkline && <div className="mt-2 h-8 w-full">{sparkline}</div>}
			</CardContent>
		</Card>
	);
}
