import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
	children: ReactNode;
	className?: string;
	contentClassName?: string;
	DesktopHeader?: ReactNode;
	MobileHeader?: ReactNode;
}

export function PageContainer({
	children,
	className,
	contentClassName,
	DesktopHeader,
	MobileHeader,
}: PageContainerProps) {
	return (
		<div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8", className)}>
			{DesktopHeader && <div>{DesktopHeader}</div>}
			{MobileHeader && <div>{MobileHeader}</div>}
			<div className={cn("", contentClassName)}>{children}</div>
		</div>
	);
}
