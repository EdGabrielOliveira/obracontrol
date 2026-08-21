const STATUS_CONFIG = {
	DONE: {
		color: "bg-status-success",
		border: "border-success/40",
		ghost: "bg-success/10",
	},
	IN_PROGRESS: {
		color: "bg-info",
		border: "border-info/40",
		ghost: "bg-info/10",
	},
	NOT_STARTED: {
		color: "bg-muted",
		border: "border-border",
		ghost: "bg-muted/50",
	},
} as const;

const DEFAULT_STATUS = {
	color: "bg-muted",
	border: "border-border",
	ghost: "bg-muted/50",
} as const;

type StatusConfig = (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG];

export function getStatusStyles(status: string): StatusConfig {
	return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? DEFAULT_STATUS;
}

export function getStatusColor(status: string): string {
	return getStatusStyles(status).color;
}

export function getStatusBorderColor(status: string): string {
	return getStatusStyles(status).border;
}

export function getStatusGhostColor(status: string): string {
	return getStatusStyles(status).ghost;
}
