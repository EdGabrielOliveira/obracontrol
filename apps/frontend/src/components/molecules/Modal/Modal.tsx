import type * as React from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useBreakpoint } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	description: string;
	children: React.ReactNode;
	classNameModal?: string;
	classNameDrawer?: string;
	classNameDrawerContent?: string;
};

export function Modal({
	isOpen,
	onClose,
	title,
	description,
	children,
	classNameModal,
	classNameDrawer,
	classNameDrawerContent,
}: ModalProps) {
	const { isMobileOrTablet } = useBreakpoint();

	if (!isMobileOrTablet) {
		return (
			<Dialog open={isOpen} onOpenChange={onClose}>
				<DialogContent
					className={cn("overflow-y-auto h-auto max-h-[90vh]", classNameModal)}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					{children}
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer
			open={isOpen}
			onOpenChange={onClose}
			repositionInputs={false}
			direction="bottom"
		>
			<DrawerContent
				className={cn(
					"px-4 pb-4 max-h-[85vh] overflow-y-auto",
					classNameDrawer,
					classNameDrawerContent,
				)}
			>
				<DrawerHeader className="text-left">
					<DrawerTitle>{title}</DrawerTitle>
					<DrawerDescription>{description}</DrawerDescription>
				</DrawerHeader>
				{children}
			</DrawerContent>
		</Drawer>
	);
}
