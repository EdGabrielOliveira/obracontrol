import type { NotificationPage, NotificationView } from "@/types/notifications";
import { api } from "./api";

export async function listNotifications(
	status?: "PENDING" | "READ" | "DISMISSED",
) {
	const params = { page: 1, limit: 50, ...(status ? { status } : {}) };
	const { data } = await api.get<NotificationPage>(
		"/governance/notifications",
		{ params },
	);
	return data;
}

export async function getUnreadNotificationCount() {
	const notifications = await listNotifications("PENDING");
	return notifications.total;
}

export async function markNotificationRead(id: string) {
	const { data } = await api.post<NotificationView>(
		`/governance/notifications/${encodeURIComponent(id)}/read`,
	);
	return data;
}

export async function dismissNotification(id: string) {
	const { data } = await api.post<NotificationView>(
		`/governance/notifications/${encodeURIComponent(id)}/dismiss`,
	);
	return data;
}
