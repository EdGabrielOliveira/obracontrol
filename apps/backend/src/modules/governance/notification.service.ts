import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type NotificationInput = {
	recipientId: string;
	eventType: string;
	referenceId: string;
	version?: number;
	title: string;
	body?: string | null;
};

export type NotificationView = {
	id: string;
	eventType: string;
	referenceId: string;
	version: number;
	title: string;
	body: string | null;
	status: "PENDING" | "READ" | "DISMISSED";
	createdAt: string;
};

function toView(
	row: Prisma.NotificationGetPayload<Record<string, never>>,
): NotificationView {
	return {
		id: row.id,
		eventType: row.eventType,
		referenceId: row.referenceId,
		version: row.version,
		title: row.title,
		body: row.body,
		status: row.status as NotificationView["status"],
		createdAt: row.createdAt.toISOString(),
	};
}

export const notificationService = {
	async create(input: NotificationInput, tx?: Prisma.TransactionClient) {
		const db = tx ?? prisma;
		const existing = await db.notification.findUnique({
			where: {
				recipientId_eventType_referenceId_version: {
					recipientId: input.recipientId,
					eventType: input.eventType,
					referenceId: input.referenceId,
					version: input.version ?? 1,
				},
			},
		});
		if (existing) return toView(existing);

		const created = await db.notification.create({
			data: {
				recipientId: input.recipientId,
				eventType: input.eventType,
				referenceId: input.referenceId,
				version: input.version ?? 1,
				title: input.title,
				body: input.body ?? null,
				status: "PENDING",
			},
		});
		return toView(created);
	},

	async list(
		recipientId: string,
		filters: {
			status?: "PENDING" | "READ" | "DISMISSED";
			page?: number;
			limit?: number;
		} = {},
	) {
		const page = filters.page ?? 1;
		const limit = Math.min(filters.limit ?? 20, 100);
		const where: Prisma.NotificationWhereInput = { recipientId };
		if (filters.status) where.status = filters.status;

		const [data, total] = await Promise.all([
			prisma.notification.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.notification.count({ where }),
		]);

		return {
			data: data.map(toView),
			total,
			page,
			limit,
		};
	},

	async markRead(recipientId: string, notificationId: string) {
		const notification = await prisma.notification.findFirst({
			where: { id: notificationId, recipientId },
		});
		if (!notification) return null;
		const updated = await prisma.notification.update({
			where: { id: notificationId },
			data: { status: "READ", readAt: new Date() },
		});
		return toView(updated);
	},

	async markDismissed(recipientId: string, notificationId: string) {
		const notification = await prisma.notification.findFirst({
			where: { id: notificationId, recipientId },
		});
		if (!notification) return null;
		const updated = await prisma.notification.update({
			where: { id: notificationId },
			data: { status: "DISMISSED", dismissedAt: new Date() },
		});
		return toView(updated);
	},

	async pendingCount(recipientId: string) {
		return prisma.notification.count({
			where: { recipientId, status: "PENDING" },
		});
	},
};
