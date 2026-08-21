import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/lib/audit-labels";
import type { AuditLogEntry, AuditLogFilter } from "@/types/audit";
import type { PaginatedResponse } from "@/types/shared";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import { api } from "./api";

export async function listAuditLogs(filters: AuditLogFilter = {}) {
	const { data } = await api.get<PaginatedResponse<AuditLogEntry>>(
		"/audit-logs",
		{
			params: sanitizeQueryParams({
				...filters,
				page: filters.page ?? 1,
				limit: filters.limit ?? 50,
			} as Record<string, unknown>),
		},
	);
	return data;
}

export async function getWorkAudit(
	workId: string,
	filters: Omit<AuditLogFilter, "entityId"> = {},
) {
	const { data } = await api.get<PaginatedResponse<AuditLogEntry>>(
		`/audit-logs/work/${encodeURIComponent(workId)}`,
		{
			params: sanitizeQueryParams({
				...filters,
				page: filters.page ?? 1,
				limit: filters.limit ?? 50,
			} as Record<string, unknown>),
		},
	);
	return data;
}

export const AUDIT_ENTITY_TYPE_OPTIONS: { value: string; label: string }[] = [
	{ value: "", label: "Todos" },
	...Object.entries(AUDIT_ENTITY_LABELS).map(([value, meta]) => ({
		value,
		label: meta.label,
	})),
].sort((a, b) => a.label.localeCompare(b.label));

export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
	{ value: "", label: "Todas" },
	...Object.entries(AUDIT_ACTION_LABELS).map(([value, meta]) => ({
		value,
		label: meta.label,
	})),
];
