import type { Prisma } from "@prisma/client";
import { writeAudit } from "../../lib/audit-writer";
import { buildPaginatedResponse } from "../../lib/pagination";
import { prisma } from "../../lib/prisma";
import { resolveAuditNavigationTarget } from "./audit-navigation";
import {
	listWorkAudit,
	resolveWorkEntityIds,
	type WorkAuditQuery,
} from "./work-audit.repository";

function auditDateBoundary(value: string, endOfDay: boolean): Date {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
	}
	return new Date(value);
}

export type AuditAction =
	| "CREATE"
	| "UPDATE"
	| "DELETE"
	| "APPROVE"
	| "REJECT"
	| "SUBMIT"
	| "RESTORE"
	| "REPROCESS"
	| "EXPORT"
	| "INSTRUMENT_DOWNLOADED";

export const AUDIT_ACTION_CATALOG = {
	QUOTATION_NEGOTIATED: "QUOTATION_NEGOTIATED",
	QUOTATION_REQUOTED: "QUOTATION_REQUOTED",
	CONTRACT_REQUEST_SELECTED: "CONTRACT_REQUEST_SELECTED",
	CONTRACT_REQUEST_FINALIZED: "CONTRACT_REQUEST_FINALIZED",
	APPROVAL_REVERSED: "APPROVAL_REVERSED",
	CONTRACT_AMENDMENT_CREATED: "CONTRACT_AMENDMENT_CREATED",
	INSTRUMENT_GENERATED: "INSTRUMENT_GENERATED",
	INSTRUMENT_DOWNLOADED: "INSTRUMENT_DOWNLOADED",
	COMMENT_CREATED: "COMMENT_CREATED",
} as const;

export type AuditEntityType =
	| "WORK_MEASUREMENT"
	| "BUDGET_ITEM"
	| "ACTUAL_COST"
	| "ORGANIZATION"
	| "COST_CENTER"
	| "WORK"
	| "CONTRACT"
	| "CONTRACT_MEASUREMENT"
	| "WORK_MEMBERSHIP"
	| "CONSTRUCTION_MEASUREMENT"
	| "EXPORT";

export interface AuditInput {
	userId: string;
	ownerId: string;
	action: AuditAction;
	entityType: AuditEntityType | string;
	entityId: string;
	entityDescription?: string | null;
	previousState?: Record<string, unknown> | null;
	newState?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
}

export interface AuditFilter {
	ownerId: string;
	entityType?: string;
	entityTypes?: string;
	entityId?: string;
	userId?: string;
	userSearch?: string;
	action?: string;
	actions?: string;
	fromDate?: string;
	toDate?: string;
	companyId?: string;
	organizationId?: string;
	costCenterId?: string;
	workId?: string;
	entityDescriptionPrefix?: string;
	page?: number;
	limit?: number;
}

class AuditService {
	async log(input: AuditInput, tx?: Prisma.TransactionClient) {
		return writeAudit(tx ?? prisma, input);
	}

	async list(filters: AuditFilter) {
		const page = filters.page ?? 1;
		const limit = Math.min(filters.limit ?? 50, 100);
		const skip = (page - 1) * limit;

		const entityTypeValues =
			filters.entityTypes?.split(",").filter(Boolean) ?? [];
		const actionValues = filters.actions?.split(",").filter(Boolean) ?? [];
		const where: Prisma.AuditLogWhereInput = { ownerId: filters.ownerId };
		const scopedEntityIds = await this.resolveScopeEntityIds(filters);
		if (scopedEntityIds) {
			if (scopedEntityIds.length === 0) {
				return buildPaginatedResponse([], 0, page, limit);
			}
			where.entityId = { in: scopedEntityIds };
		}
		if (filters.entityType) where.entityType = filters.entityType;
		else if (entityTypeValues.length)
			where.entityType = { in: entityTypeValues };
		if (filters.entityId) where.entityId = filters.entityId;
		if (filters.userId) where.userId = filters.userId;
		if (filters.userSearch) {
			where.user = {
				OR: [
					{ name: { contains: filters.userSearch } },
					{ email: { contains: filters.userSearch } },
				],
			};
		}
		if (filters.action) where.action = filters.action;
		else if (actionValues.length) where.action = { in: actionValues };
		if (filters.fromDate || filters.toDate) {
			where.createdAt = {
				...(filters.fromDate
					? { gte: auditDateBoundary(filters.fromDate, false) }
					: {}),
				...(filters.toDate
					? { lte: auditDateBoundary(filters.toDate, true) }
					: {}),
			};
		}
		if (filters.entityDescriptionPrefix) {
			where.entityDescription = { startsWith: filters.entityDescriptionPrefix };
		}

		const [data, total] = await Promise.all([
			prisma.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					user: { select: { id: true, name: true, email: true } },
				},
			}),
			prisma.auditLog.count({ where }),
		]);

		return buildPaginatedResponse(
			data.map((row) => ({
				...row,
				navigationTarget: resolveAuditNavigationTarget(row),
			})),
			total,
			page,
			limit,
		);
	}

	private async resolveScopeEntityIds(filters: AuditFilter) {
		if (
			!filters.companyId &&
			!filters.organizationId &&
			!filters.costCenterId &&
			!filters.workId
		) {
			return null;
		}

		const organizations = await prisma.organization.findMany({
			where: {
				ownerId: filters.ownerId,
				...(filters.companyId ? { companyId: filters.companyId } : {}),
				...(filters.organizationId ? { id: filters.organizationId } : {}),
				...(filters.costCenterId || filters.workId
					? {
							costCenters: {
								some: {
									...(filters.costCenterId ? { id: filters.costCenterId } : {}),
									...(filters.workId
										? { works: { some: { id: filters.workId } } }
										: {}),
								},
							},
						}
					: {}),
			},
			select: { id: true },
		});
		const organizationIds = organizations.map((row) => row.id);
		if (
			(filters.companyId || filters.organizationId) &&
			organizationIds.length === 0
		) {
			return [];
		}
		const costCenters = await prisma.costCenter.findMany({
			where: {
				ownerId: filters.ownerId,
				...(filters.costCenterId ? { id: filters.costCenterId } : {}),
				...(filters.workId ? { works: { some: { id: filters.workId } } } : {}),
				...(organizationIds.length
					? { organizationId: { in: organizationIds } }
					: {}),
			},
			select: { id: true },
		});
		const costCenterIds = costCenters.map((row) => row.id);
		const works = await prisma.constructionWork.findMany({
			where: {
				ownerId: filters.ownerId,
				...(filters.workId ? { id: filters.workId } : {}),
				...(costCenterIds.length
					? { costCenterId: { in: costCenterIds } }
					: {}),
			},
			select: { id: true },
		});

		const entityIds = new Set<string>([...organizationIds, ...costCenterIds]);
		for (const work of works) {
			for (const id of await resolveWorkEntityIds(filters.ownerId, work.id)) {
				entityIds.add(id);
			}
		}
		return [...entityIds];
	}

	async listForWork(ownerId: string, workId: string, query: WorkAuditQuery) {
		const page = Math.max(1, query.page || 1);
		const limit = Math.min(query.limit || 50, 100);
		return listWorkAudit(ownerId, workId, {
			page,
			limit,
			entityType: query.entityType,
			entityTypes: query.entityTypes,
			action: query.action,
			actions: query.actions,
			userId: query.userId,
			userSearch: query.userSearch,
			fromDate: query.fromDate,
			toDate: query.toDate,
		});
	}
}

export const auditService = new AuditService();
