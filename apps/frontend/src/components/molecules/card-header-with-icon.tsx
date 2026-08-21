import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardHeaderWithIconProps {
	icon: LucideIcon;
	title: string;
	description: string;
	actions?: ReactNode;
	className?: string;
}

export function CardHeaderWithIcon({
	icon: Icon,
	title,
	description,
	actions,
	className,
}: CardHeaderWithIconProps) {
	return (
		<div
			data-slot="card-header-with-icon"
			className={cn("flex items-start gap-4 px-6", className)}
		>
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
				<Icon className="h-5 w-5 text-primary" />
			</div>
			<div className="flex min-w-0 flex-1 items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold leading-none text-foreground">
						{title}
					</h3>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{actions && <div className="shrink-0">{actions}</div>}
			</div>
		</div>
	);
}
