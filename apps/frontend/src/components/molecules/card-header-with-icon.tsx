import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CardHeaderWithIconProps {
	icon: LucideIcon;
	title: string;
	description: string;
	tooltip?: string;
	actions?: ReactNode;
	className?: string;
}

export function CardHeaderWithIcon({
	icon: Icon,
	title,
	description,
	tooltip,
	actions,
	className,
}: CardHeaderWithIconProps) {
	return (
		<div
			data-slot="card-header-with-icon"
			className={cn("flex items-start gap-4 px-6", className)}
		>
			<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
				<Icon className="h-5 w-5 text-primary" />
			</div>
			<div className="flex min-w-0 flex-1 items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1.5">
						<h3 className="text-sm font-semibold leading-none text-foreground">
							{title}
						</h3>
						{tooltip ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label={`Mais informações sobre ${title}`}
									>
										<Info className="h-3.5 w-3.5" />
									</button>
								</TooltipTrigger>
								<TooltipContent className="max-w-sm leading-relaxed">
									{tooltip}
								</TooltipContent>
							</Tooltip>
						) : null}
					</div>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{actions && <div className="shrink-0">{actions}</div>}
			</div>
		</div>
	);
}
