import type { Prisma } from "@prisma/client";
import { buildPaginatedResponse } from "../../lib/pagination";
import { prisma } from "../../lib/prisma";
import { resolveAuditNavigationTarget } from "./audit-navigation";

function auditDateBoundary(value: string, endOfDay: boolean): Date {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
	}
	return new Date(value);
}

export type WorkAuditQuery = {
	page: number;
	limit: number;
	entityType?: string;
	entityTypes?: string;
	action?: string;
	actions?: string;
	userId?: string;
	userSearch?: string;
	fromDate?: string;
	toDate?: string;
};

export type WorkAuditRow = {
	id: string;
	userId: string;
	action: string;
	entityType: string;
	entityId: string;
	entityDescription: string | null;
	previousState: unknown;
	newState: unknown;
	metadata: unknown;
	createdAt: Date;
	user: { id: string; name: string; email: string };
};

export async function resolveWorkEntityIds(
	ownerId: string,
	workId: string,
): Promise<string[]> {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true },
	});
	if (!work) return [];

	const [
		budgetItems,
		workMeasurements,
		constructionMeasurements,
		actualCosts,
		scheduleRevisions,
		imports,
		contracts,
	] = await Promise.all([
		prisma.constructionBudgetItem.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
		prisma.workMeasurement.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
		prisma.constructionMeasurement.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
		prisma.constructionActualCost.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
		prisma.constructionScheduleRevision.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
		prisma.constructionImport.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
		prisma.contract.findMany({
			where: { workId, ownerId },
			select: { id: true },
		}),
	]);

	const contractIds = contracts.map((c) => c.id);

	let contractMeasurements: { id: string }[] = [];
	let contractPayments: { id: string }[] = [];
	let contractAmendments: { id: string }[] = [];
	if (contractIds.length > 0) {
		[contractMeasurements, contractPayments, contractAmendments] =
			await Promise.all([
				prisma.contractMeasurement.findMany({
					where: { contractId: { in: contractIds }, ownerId },
					select: { id: true },
				}),
				prisma.contractPayment.findMany({
					where: { contractId: { in: contractIds }, ownerId },
					select: { id: true },
				}),
				prisma.constructionContractAmendment.findMany({
					where: { contractId: { in: contractIds }, ownerId },
					select: { id: true },
				}),
			]);
	}

	const directIds = [
		work.id,
		...budgetItems.map((r) => r.id),
		...workMeasurements.map((r) => r.id),
		...constructionMeasurements.map((r) => r.id),
		...actualCosts.map((r) => r.id),
		...scheduleRevisions.map((r) => r.id),
		...imports.map((r) => r.id),
		...contracts.map((r) => r.id),
	];

	const [approvalRequests, governanceRecords] = await Promise.all([
		prisma.approvalRequest.findMany({
			where: { ownerId },
			select: {
				id: true,
				resourceType: true,
				resourceId: true,
				payloadJson: true,
			},
		}),
		prisma.governanceRecord.findMany({
			where: { ownerId, entityId: { in: directIds } },
			select: { id: true },
		}),
	]);

	const approvalIds = approvalRequests
		.filter((row) => {
			const payload = row.payloadJson as { workId?: unknown } | null;
			const payloadWorkId =
				typeof payload?.workId === "string" ? payload.workId : null;
			return (
				payloadWorkId === workId ||
				(row.resourceType === "WORK" && row.resourceId === workId)
			);
		})
		.map((row) => row.id);

	return [
		...new Set([
			...directIds,
			...contractMeasurements.map((r) => r.id),
			...contractPayments.map((r) => r.id),
			...contractAmendments.map((r) => r.id),
			...approvalIds,
			...governanceRecords.map((r) => r.id),
		]),
	];
}

export async function listWorkAudit(
	ownerId: string,
	workId: string,
	query: WorkAuditQuery,
) {
	const entityIds = await resolveWorkEntityIds(ownerId, workId);
	if (entityIds.length === 0) {
		return buildPaginatedResponse([], 0, query.page, query.limit);
	}

	const entityTypeValues = query.entityTypes?.split(",").filter(Boolean) ?? [];
	const actionValues = query.actions?.split(",").filter(Boolean) ?? [];
	const where: Prisma.AuditLogWhereInput = {
		ownerId,
		entityId: { in: entityIds },
		...(query.entityType
			? { entityType: query.entityType }
			: entityTypeValues.length
				? { entityType: { in: entityTypeValues } }
				: {}),
		...(query.action
			? { action: query.action }
			: actionValues.length
				? { action: { in: actionValues } }
				: {}),
		...(query.userId ? { userId: query.userId } : {}),
		...(query.userSearch
			? {
					user: {
						OR: [
							{ name: { contains: query.userSearch } },
							{ email: { contains: query.userSearch } },
						],
					},
				}
			: {}),
		...(query.fromDate || query.toDate
			? {
					createdAt: {
						...(query.fromDate
							? { gte: auditDateBoundary(query.fromDate, false) }
							: {}),
						...(query.toDate
							? { lte: auditDateBoundary(query.toDate, true) }
							: {}),
					},
				}
			: {}),
	};

	const [data, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
		}),
		prisma.auditLog.count({ where }),
	]);

	return buildPaginatedResponse(
		data.map((row) => ({
			...row,
			navigationTarget: resolveAuditNavigationTarget({
				entityType: row.entityType,
				entityId: row.entityId,
				workId,
			}),
		})),
		total,
		query.page,
		query.limit,
	);
}
