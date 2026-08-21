import type { Prisma } from "@prisma/client";
import { redact } from "./redact";

export type AuditEventInput = {
	userId: string;
	ownerId: string;
	action: string;
	entityType: string;
	entityId: string;
	entityDescription?: string | null;
	previousState?: Record<string, unknown> | null;
	newState?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
};

export type AuditClient = {
	auditLog: Pick<Prisma.AuditLogDelegate, "create">;
};

function toJson(
	value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
	if (value === null || value === undefined) return undefined;
	return value as Prisma.InputJsonValue;
}

type AuditLogRecord = Awaited<ReturnType<Prisma.AuditLogDelegate["create"]>>;

export const auditWriter = {
	async write(
		client: AuditClient,
		event: AuditEventInput,
	): Promise<AuditLogRecord> {
		return client.auditLog.create({
			data: {
				userId: event.userId,
				ownerId: event.ownerId,
				action: event.action,
				entityType: event.entityType,
				entityId: event.entityId,
				entityDescription: event.entityDescription ?? null,
				previousState: toJson(redact(event.previousState)),
				newState: toJson(redact(event.newState)),
				metadata: toJson(redact(event.metadata)),
			},
		});
	},
};

export function writeAudit(
	client: AuditClient,
	event: AuditEventInput,
): Promise<AuditLogRecord> {
	return auditWriter.write(client, event);
}
