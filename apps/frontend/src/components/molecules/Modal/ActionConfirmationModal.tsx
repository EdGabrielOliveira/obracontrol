import type { ReactNode } from "react";
import { Modal } from "@/components/molecules/Modal/Modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconColor = "default" | "success" | "destructive" | "warning" | "info";

const ICON_COLOR_CLASSES: Record<IconColor, string> = {
	default: "bg-primary/10 text-primary",
	success: "bg-success/10 text-success",
	destructive: "bg-destructive/10 text-destructive",
	warning: "bg-warning/10 text-warning",
	info: "bg-info/10 text-info",
};

type AlertVariant = "default" | "destructive" | "warning" | "info";

const ALERT_CLASSES: Record<AlertVariant, string> = {
	default: "border-border bg-muted/50",
	destructive:
		"border-destructive/20 bg-destructive/5 text-destructive [&>svg]:text-destructive",
	warning: "status-warning [&>svg]:text-warning",
	info: "status-info [&>svg]:text-info",
};

type ActionConfirmationModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
	iconColor?: IconColor;
	children?: ReactNode;
	alert?: {
		message: string;
		variant?: AlertVariant;
		icon?: React.ComponentType<{ className?: string }>;
	};
	cancelLabel?: string;
	onCancel?: () => void;
	confirmLabel: string;
	onConfirm: () => void;
	confirmVariant?: "default" | "destructive" | "success" | "warning";
	confirmDisabled?: boolean;
	confirmIsLoading?: boolean;
	confirmIcon?: React.ComponentType<{ className?: string }>;
};

const CONFIRM_VARIANT_CLASSES: Record<string, string> = {
	default: "",
	destructive: "",
	success: "bg-success text-white hover:bg-success/90",
	warning: "bg-warning text-white hover:bg-warning/90",
};

const BUTTON_VARIANT_MAP: Record<
	string,
	"destructive" | "default" | "outline"
> = {
	destructive: "destructive",
	success: "default",
	warning: "default",
	default: "default",
};

export function ActionConfirmationModal({
	isOpen,
	onClose,
	title,
	description,
	icon: Icon,
	iconColor = "default",
	children,
	alert,
	cancelLabel = "Cancelar",
	onCancel,
	confirmLabel,
	onConfirm,
	confirmVariant = "default",
	confirmDisabled = false,
	confirmIsLoading = false,
	confirmIcon: ConfirmIcon,
}: ActionConfirmationModalProps) {
	const AlertIcon = alert?.icon;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={title}
			description={description}
		>
			<div className="flex flex-col gap-4">
				<div className="flex items-start gap-3">
					<div
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded-xl",
							ICON_COLOR_CLASSES[iconColor],
						)}
					>
						<Icon className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold text-foreground">{title}</p>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{description}
						</p>
					</div>
				</div>

				{children}

				{alert && (
					<Alert
						className={cn(
							"flex items-start gap-3 rounded-xl border p-4",
							ALERT_CLASSES[alert.variant ?? "default"],
						)}
					>
						{AlertIcon && <AlertIcon className="mt-0.5 size-4 shrink-0" />}
						<AlertDescription className="text-sm">
							{alert.message}
						</AlertDescription>
					</Alert>
				)}
			</div>

			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border/50 pt-4 mt-2">
				<Button
					variant="outline"
					className="w-full sm:w-auto"
					onClick={onCancel ?? onClose}
					disabled={confirmIsLoading}
				>
					{cancelLabel}
				</Button>
				<Button
					variant={BUTTON_VARIANT_MAP[confirmVariant]}
					className={cn(
						"w-full sm:w-auto",
						CONFIRM_VARIANT_CLASSES[confirmVariant],
					)}
					onClick={onConfirm}
					disabled={confirmDisabled || confirmIsLoading}
				>
					{confirmIsLoading ? (
						<span className="flex items-center gap-2">
							<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							{confirmLabel}
						</span>
					) : (
						<>
							{ConfirmIcon && <ConfirmIcon className="size-4" />}
							{confirmLabel}
						</>
					)}
				</Button>
			</div>
		</Modal>
	);
}
