import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateCardProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	actions?: ReactNode;
	variant?: "default" | "dashed";
}

const variantClasses = {
	default: "border border-primary/20 bg-primary/5",
	dashed: "border-2 border-dashed border-border bg-muted/50",
};

export function EmptyStateCard({
	icon: Icon,
	title,
	description,
	actions,
	variant = "default",
}: EmptyStateCardProps) {
	return (
		<Card className={variantClasses[variant]}>
			<CardContent className="flex flex-col items-center py-16 text-center">
				<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
					<Icon className="h-7 w-7 text-primary" />
				</div>
				<h3 className="text-lg font-semibold text-foreground">{title}</h3>
				{description && (
					<p className="mt-2 max-w-md text-sm text-muted-foreground">
						{description}
					</p>
				)}
				{actions && <div className="mt-4 flex gap-2">{actions}</div>}
			</CardContent>
		</Card>
	);
}
