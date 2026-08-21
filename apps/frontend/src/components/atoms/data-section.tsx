import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataSectionProps {
	title?: string;
	description?: string;
	icon?: LucideIcon;
	children: ReactNode;
	className?: string;
}

export function DataSection({
	title,
	description,
	icon,
	children,
	className,
}: DataSectionProps) {
	return (
		<Card className={className}>
			{title &&
				(icon ? (
					<CardHeaderWithIcon
						icon={icon}
						title={title}
						description={description ?? ""}
					/>
				) : (
					<CardHeader>
						<CardTitle className="text-base">{title}</CardTitle>
					</CardHeader>
				))}
			<CardContent>{children}</CardContent>
		</Card>
	);
}
