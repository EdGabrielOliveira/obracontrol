export type NotificationStatus = "PENDING" | "READ" | "DISMISSED";

export type NotificationView = {
	id: string;
	eventType: string;
	referenceId: string;
	version: number;
	title: string;
	body: string | null;
	status: NotificationStatus;
	createdAt: string;
};

export type NotificationPage = {
	data: NotificationView[];
	total: number;
	page: number;
	limit: number;
};
