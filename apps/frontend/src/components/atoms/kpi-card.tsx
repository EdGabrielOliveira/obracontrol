import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type KpiTone = "default" | "success" | "danger" | "warning";
type KpiStatus = "available" | "unavailable";

interface KpiCardProps {
	title: string;
	value: string | number;
	tooltip?: string;
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
	tooltip,
	status = "available",
	tone = "default",
	sparkline,
}: KpiCardProps) {
	if (status === "unavailable") {
		return (
			<Card className="card-shadow">
				<CardContent className="p-4">
					<KpiTitle title={title} tooltip={tooltip} />
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
				<KpiTitle title={title} tooltip={tooltip} />
				<p className={`mt-1 text-2xl font-bold ${toneClasses[tone]}`}>
					{value}
				</p>
				{sparkline && <div className="mt-2 h-8 w-full">{sparkline}</div>}
			</CardContent>
		</Card>
	);
}

function KpiTitle({ title, tooltip }: { title: string; tooltip?: string }) {
	return (
		<div className="flex items-center gap-1.5">
			<CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{title}
			</CardTitle>
			{tooltip ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={`Como é calculado: ${title}`}
						>
							<Info className="h-3.5 w-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent className="max-w-xs leading-relaxed">
						{tooltip}
					</TooltipContent>
				</Tooltip>
			) : null}
		</div>
	);
}
