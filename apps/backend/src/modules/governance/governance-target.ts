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

export type GovernanceTarget = {
	workId: string;
};

export async function resolveGovernanceTarget(
	entityType: string,
	entityId: string,
): Promise<GovernanceTarget | null> {
	if (!WORK_SCOPED_ENTITY_TYPES.has(entityType)) return null;
	if (!entityId.trim()) return null;
	const work = await prisma.constructionWork.findUnique({
		where: { id: entityId },
		select: { id: true },
	});
	return work ? { workId: work.id } : null;
}
