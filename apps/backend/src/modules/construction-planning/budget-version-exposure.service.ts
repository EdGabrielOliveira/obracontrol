import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { mapSequentialBatches } from "../../lib/map-sequential-batches";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import type { BudgetExposure } from "./budget-version-comparison";

export async function loadBudgetExposure(
	actorId: string,
	workId: string,
): Promise<ReadonlyMap<string, BudgetExposure>> {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}

	const resourceOwnerId = scope.resourceOwnerId;
	const version = await prisma.budgetVersion.findFirst({
		where: { ownerId: resourceOwnerId, workId, isActive: true },
		select: { id: true },
	});
	if (!version) return new Map();

	const items = await prisma.budgetVersionItem.findMany({
		where: { versionId: version.id },
		select: { id: true, identityId: true, index: true },
	});
	if (items.length === 0) return new Map();

	const impactBatches = await mapSequentialBatches(
		items.map((item) => item.identityId),
		200,
		(identityIds) =>
			prisma.constructionBudgetImpact.findMany({
				where: {
					ownerId: resourceOwnerId,
					workId,
					budgetItemIdentityId: { in: [...new Set(identityIds)] },
					reversedAt: null,
					status: { not: "REJECTED" },
				},
				select: {
					budgetItemIdentityId: true,
					sourceType: true,
					impactType: true,
					quantity: true,
				},
			}),
	);
	const impacts = impactBatches.flat();

	const indexByIdentityId = new Map(
		items.map((item) => [item.identityId, item.index]),
	);
	const exposureByIndex = new Map<string, BudgetExposure>();

	for (const impact of impacts) {
		const index = indexByIdentityId.get(impact.budgetItemIdentityId);
		if (!index) continue;
		const quantity = impact.quantity ?? new Decimal(0);
		const current = exposureByIndex.get(index) ?? {
			contractedQuantity: new Decimal(0),
			measuredQuantity: new Decimal(0),
			executedQuantity: new Decimal(0),
			paidQuantity: new Decimal(0),
		};
		if (impact.impactType === "COMMITMENT") {
			current.contractedQuantity = current.contractedQuantity.plus(quantity);
		} else if (
			impact.sourceType === "WORK_MEASUREMENT" ||
			impact.sourceType === "CONTRACT_MEASUREMENT"
		) {
			current.measuredQuantity = current.measuredQuantity.plus(quantity);
			current.executedQuantity = current.executedQuantity.plus(quantity);
		}
		exposureByIndex.set(index, current);
	}

	return exposureByIndex;
}
