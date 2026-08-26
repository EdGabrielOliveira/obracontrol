import { prisma } from "../../lib/prisma";

const WORK_SCOPED_ENTITY_TYPES = new Set([
	"WORK",
	"BUDGET",
	"CONTRACT",
	"SCHEDULE",
	"WORK_MEASUREMENTS",
	"WORK_COSTS",
	"WORK_IMPORTS",
]);

const RESOURCE_ENTITY_TYPES = new Set([
	"WORK_STATUS",
	"CONTRACT_STATUS",
	"COST_STATUS",
	"WORK_MEASUREMENT_STATUS",
	"CONTRACT_MEASUREMENT_STATUS",
]);

export type GovernanceTarget = {
	workId: string;
	resourceOwnerId?: string;
	workspaceId?: string | null;
};

export async function resolveGovernanceTarget(
	entityType: string,
	entityId: string,
): Promise<GovernanceTarget | null> {
	if (!entityId.trim()) return null;
	if (WORK_SCOPED_ENTITY_TYPES.has(entityType)) {
		const work = await prisma.constructionWork.findUnique({
			where: { id: entityId },
			select: { id: true },
		});
		return work ? { workId: work.id } : null;
	}
	if (!RESOURCE_ENTITY_TYPES.has(entityType)) return null;
	if (entityType === "WORK_STATUS") {
		const work = await prisma.constructionWork.findUnique({
			where: { id: entityId },
			select: { id: true, ownerId: true, workspaceId: true },
		});
		return work
			? {
					workId: work.id,
					resourceOwnerId: work.ownerId,
					workspaceId: work.workspaceId,
				}
			: null;
	}
	const resource = await (async () => {
		switch (entityType) {
			case "CONTRACT_STATUS":
				return prisma.contract.findUnique({
					where: { id: entityId },
					select: {
						ownerId: true,
						workspaceId: true,
						work: { select: { id: true, ownerId: true, workspaceId: true } },
					},
				});
			case "COST_STATUS":
				return prisma.constructionActualCost.findUnique({
					where: { id: entityId },
					select: {
						work: { select: { id: true, ownerId: true, workspaceId: true } },
					},
				});
			case "WORK_MEASUREMENT_STATUS":
				return prisma.constructionMeasurement.findUnique({
					where: { id: entityId },
					select: {
						work: { select: { id: true, ownerId: true, workspaceId: true } },
					},
				});
			case "CONTRACT_MEASUREMENT_STATUS":
				return prisma.contractMeasurement.findUnique({
					where: { id: entityId },
					select: {
						contract: {
							select: {
								work: {
									select: { id: true, ownerId: true, workspaceId: true },
								},
							},
						},
					},
				});
		}
		return null;
	})();
	const work =
		resource && "work" in resource
			? resource.work
			: resource && "contract" in resource
				? resource.contract?.work
				: null;
	return work
		? {
				workId: work.id,
				resourceOwnerId: work.ownerId,
				workspaceId: work.workspaceId,
			}
		: null;
}
