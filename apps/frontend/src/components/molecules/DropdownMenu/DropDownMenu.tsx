import { Link } from "@tanstack/react-router";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DropDownMenuVariant =
	| "default"
	| "destructive"
	| "alert"
	| "positive";

export type DropDownMenuLinkItem = {
	label: string;
	icon: React.ReactNode;
	to: string;
	params?: unknown;
	search?: unknown;
	onClick?: () => void;
	variant?: DropDownMenuVariant;
};

export type DropDownMenuActionItem = {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	params?: never;
	variant?: DropDownMenuVariant;
};

export type DropDownMenuItem = DropDownMenuLinkItem | DropDownMenuActionItem;

type DropDownMenuProps = {
	targetMenu: React.ReactNode;
	menuItems: (DropDownMenuItem | false | null | undefined)[];
	ariaLabel?: string;
};

const variantClasses = {
	default: "text-foreground hover:bg-muted",
	destructive: "text-destructive hover:bg-destructive/10",
	alert: "text-warning hover:bg-warning/10",
	positive: "text-success hover:bg-success/10",
};

export function DropDownMenu({
	targetMenu,
	menuItems,
	ariaLabel = "Ações",
}: DropDownMenuProps) {
	const visibleItems = menuItems.filter((item): item is DropDownMenuItem =>
		Boolean(item),
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant={"outline"} size={"icon"} aria-label={ariaLabel}>
					{targetMenu}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{visibleItems.map((item) => {
					const variantClass = variantClasses[item.variant || "default"];

					if ("to" in item) {
						return (
							<DropdownMenuItem
								asChild
								key={item.label}
								className="cursor-pointer"
							>
								<Link
									to={item.to as string}
									params={item.params as never}
									search={item.search as never}
									onClick={item.onClick}
									className={cn("flex w-full items-center", variantClass)}
								>
									{item.icon}
									{item.label}
								</Link>
							</DropdownMenuItem>
						);
					}

					return (
						<DropdownMenuItem
							key={item.label}
							onClick={item.onClick}
							className={cn("cursor-pointer", variantClass)}
						>
							{item.icon}
							{item.label}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
