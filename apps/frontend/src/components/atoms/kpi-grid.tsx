import type { ReactNode } from "react";

export function KpiGrid({ children }: { children: ReactNode }) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
			{children}
		</div>
	);
}
