import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
	label: string;
	onClick: () => void;
}

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	actions?: EmptyStateAction[];
}

export function EmptyState({
	icon,
	title,
	description,
	actions,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16">
			{icon && (
				<div className="mb-4 size-10 text-muted-foreground/50">{icon}</div>
			)}
			<p className="text-lg font-semibold">{title}</p>
			{description && (
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			)}
			{actions && actions.length > 0 && (
				<div className="mt-4 flex gap-2">
					{actions.map((action, i) => (
						<Button
							key={action.label}
							variant={i === 0 ? "default" : "outline"}
							onClick={action.onClick}
						>
							{action.label}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}
