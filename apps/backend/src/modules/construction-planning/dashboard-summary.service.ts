import { prisma } from "../../lib/prisma";
import {
	getAccessibleCostCenterIds,
	getAccessibleOrgIds,
} from "../../lib/scope-access";
import { computeWorkSummary } from "./bi/work-summary";
import { normalizeWorkOperationalStatus } from "./works/work-operational-status";
import { getAllWorksWithItems } from "./works/works.repository";

export async function getDashboardSummary(ownerId: string) {
	const [organizationIds, costCenterIds, suppliers, works] = await Promise.all([
		getAccessibleOrgIds(ownerId),
		getAccessibleCostCenterIds(ownerId),
		prisma.constructionSupplier.count({ where: { ownerId } }),
		getAllWorksWithItems(ownerId),
	]);
	const accessibleWorkIds = works.map((work) => work.id);
	const [pendingContracts, pendingApprovals, pendingCosts] = await Promise.all([
		prisma.contractRequest.count({
			where: {
				ownerId,
				workId: { in: accessibleWorkIds },
				status: { notIn: ["CONTRATADA", "ACEITA", "CANCELADA"] },
			},
		}),
		prisma.approvalRequest.count({ where: { ownerId, status: "PENDING" } }),
		prisma.constructionActualCost.count({
			where: {
				ownerId,
				workId: { in: accessibleWorkIds },
				paymentStatus: "OPEN",
			},
		}),
	]);

	const byStatus = {
		DRAFT: 0,
		NOT_STARTED: 0,
		IN_PROGRESS: 0,
		DONE: 0,
		SUSPENDED: 0,
		IGNORED: 0,
	};
	let worksAtRisk = 0;
	for (const work of works) {
		const summary = computeWorkSummary({
			id: work.id,
			code: work.code,
			name: work.name,
			costCenterId: work.costCenterId,
			clientName: work.clientName,
			plannedStart: work.plannedStart,
			plannedEnd: work.plannedEnd,
			baseDate: work.baseDate,
			createdAt: work.createdAt,
			lastImportAt: work.imports[0]?.createdAt ?? work.createdAt,
			activeChildren: work,
		});
		const status = normalizeWorkOperationalStatus(work.operationalStatus);
		byStatus[status] += 1;
		if (summary.scheduleRisk === "BEHIND" || summary.costRisk === "OVER_COST") {
			worksAtRisk += 1;
		}
	}

	return {
		organizations: organizationIds.length,
		costCenters: costCenterIds.length,
		suppliers,
		works: { total: works.length, byStatus },
		pendingContracts,
		pendingApprovals,
		worksAtRisk,
		pendingCosts,
	};
}
