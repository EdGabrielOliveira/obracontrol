import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiGrid({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3",
				className,
			)}
		>
			{children}
		</div>
	);
}
