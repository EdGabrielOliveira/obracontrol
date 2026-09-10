import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	actions?: ReactNode;
	variant?: "plain" | "default" | "dashed";
}

const variantClasses = {
	default: "border border-primary/20 bg-primary/5",
	dashed: "border-2 border-dashed border-border bg-muted/50",
} as const;

export function EmptyState({
	icon,
	title,
	description,
	actions,
	variant = "plain",
}: EmptyStateProps) {
	const renderedActions = actions ? (
		<div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>
	) : null;

	const content = (
		<div
			className={
				variant === "plain"
					? "flex flex-col items-center justify-center py-12 text-center"
					: "flex flex-col items-center py-16 text-center"
			}
		>
			{icon &&
				(variant === "plain" ? (
					<div className="mb-3 size-10 text-muted-foreground/50">{icon}</div>
				) : (
					<div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/10">
						{icon}
					</div>
				))}
			<p
				className={
					variant === "plain"
						? "text-sm font-semibold text-foreground"
						: "text-lg font-semibold text-foreground"
				}
			>
				{title}
			</p>
			{description && (
				<p className="mt-1 max-w-md text-sm text-muted-foreground">
					{description}
				</p>
			)}
			{renderedActions}
		</div>
	);

	return variant === "plain" ? (
		content
	) : (
		<Card className={variantClasses[variant]}>
			<CardContent>{content}</CardContent>
		</Card>
	);
}
