import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
	label: string;
	to?: string;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
	return (
		<nav aria-label="Breadcrumb" className={className}>
			<ol className="flex items-center gap-1 text-sm text-muted-foreground">
				{items.map((item, i) => {
					const isLast = i === items.length - 1;
					return (
						<li key={item.label} className="flex items-center gap-1">
							{i > 0 && (
								<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
							)}
							{item.to && !isLast ? (
								<Link
									to={item.to}
									className="hover:text-foreground transition-colors"
								>
									{item.label}
								</Link>
							) : (
								<span className={isLast ? "font-medium text-foreground" : ""}>
									{item.label}
								</span>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
