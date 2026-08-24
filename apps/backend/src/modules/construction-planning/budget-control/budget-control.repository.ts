import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { mapSequentialBatches } from "../../../lib/map-sequential-batches";
import { prisma } from "../../../lib/prisma";
import type {
	BudgetBalanceRow,
	BudgetItemReferenceRow,
} from "./budget-control.types";

export type BudgetImpactKey = {
	sourceType: string;
	sourceId: string;
	componentId: string;
	impactType: string;
	budgetVersionItemId: string;
};

const IMPACT_STATUS_PENDING = "PENDING";
const SQLITE_BATCH_SIZE = 200;

export async function getBudgetItemReferences(
	ownerId: string,
	workId: string,
	budgetItemIds: string[],
	tx?: Prisma.TransactionClient,
): Promise<{ found: BudgetItemReferenceRow[]; missing: string[] }> {
	const ids = [...new Set(budgetItemIds)];
	const db = tx ?? prisma;
	const version = await db.budgetVersion.findFirst({
		where: { ownerId, workId, isActive: true },
		select: { id: true },
	});
	const work = await db.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { activeImportId: true },
	});
	if (!version) {
		const operationalIds = new Set(
			(
				await mapSequentialBatches(ids, SQLITE_BATCH_SIZE, (chunk) =>
					db.constructionBudgetItem.findMany({
						where: { id: { in: chunk }, ownerId, workId },
						select: { id: true },
					}),
				)
			)
				.flat()
				.map((item) => item.id),
		);
		return {
			found: [],
			missing: ids.filter((id) => !operationalIds.has(id)),
		};
	}

	const chunks = await mapSequentialBatches(
		ids,
		SQLITE_BATCH_SIZE,
		async (chunk) => {
			const items = await db.constructionBudgetItem.findMany({
				where: { id: { in: chunk }, ownerId, workId },
				select: { id: true, index: true },
			});
			const indexes = items.map((item) => item.index).filter(Boolean);
			const scopedIdentities = indexes.length
				? await db.budgetItemIdentity.findMany({
						where: { workId, index: { in: indexes }, ownerId },
						select: { id: true, index: true },
					})
				: [];
			const versionItems = await db.budgetVersionItem.findMany({
				where: {
					versionId: version.id,
					OR: [
						{ id: { in: chunk } },
						{ identityId: { in: scopedIdentities.map((i) => i.id) } },
					],
				},
				select: {
					id: true,
					index: true,
					identityId: true,
					quantity: true,
					unitCost: true,
				},
			});
			const operationalCandidates = await db.constructionBudgetItem.findMany({
				where: {
					ownerId,
					workId,
					...(work?.activeImportId ? { importId: work.activeImportId } : {}),
					OR: [
						{ id: { in: chunk } },
						...(versionItems.length > 0
							? [
									{
										identityId: {
											in: versionItems.map((item) => item.identityId),
										},
									},
									{ index: { in: versionItems.map((item) => item.index) } },
								]
							: []),
					],
				},
				select: { id: true, index: true, identityId: true },
			});
			const operationalByIdentity = new Map(
				operationalCandidates
					.filter((item) => item.identityId)
					.map((item) => [item.identityId as string, item.id]),
			);
			const operationalByIndex = new Map(
				operationalCandidates.map((item) => [item.index, item.id]),
			);
			const operationalById = new Map(
				operationalCandidates.map((item) => [item.id, item.id]),
			);
			const versionItemById = new Map(
				versionItems.map((item) => [item.id, item]),
			);
			const versionItemByIdentity = new Map(
				versionItems.map((item) => [item.identityId, item]),
			);
			const identityByIndex = new Map(
				scopedIdentities.map((identity) => [identity.index, identity]),
			);
			const found = new Map<string, BudgetItemReferenceRow>();
			for (const id of chunk) {
				const versionItem = versionItemById.get(id);
				if (!versionItem) continue;
				found.set(id, {
					budgetItemId: id,
					operationalBudgetItemId:
						operationalByIdentity.get(versionItem.identityId) ??
						operationalByIndex.get(versionItem.index) ??
						null,
					index: versionItem.index,
					identityId: versionItem.identityId,
					versionItemId: versionItem.id,
					quantity: versionItem.quantity,
					unitCost: versionItem.unitCost,
				});
			}
			for (const item of items) {
				if (versionItemById.has(item.id)) continue;
				const identity = identityByIndex.get(item.index);
				const versionItem = identity
					? versionItemByIdentity.get(identity.id)
					: undefined;
				if (!identity || !versionItem) continue;
				found.set(item.id, {
					budgetItemId: item.id,
					operationalBudgetItemId: operationalById.get(item.id) ?? item.id,
					index: item.index,
					identityId: identity.id,
					versionItemId: versionItem.id,
					quantity: versionItem.quantity,
					unitCost: versionItem.unitCost,
				});
			}
			const foundVersionItemIds = new Set(versionItems.map((item) => item.id));
			return {
				found,
				missing: chunk.filter(
					(id) =>
						!items.some((item) => item.id === id) &&
						!foundVersionItemIds.has(id),
				),
			};
		},
	);
	const foundById = new Map(
		chunks.flatMap((chunk) => [...chunk.found.entries()]),
	);
	return {
		found: ids.flatMap((id) => {
			const row = foundById.get(id);
			return row ? [row] : [];
		}),
		missing: chunks.flatMap((chunk) => chunk.missing),
	};
}

export async function getBalanceRows(
	ownerId: string,
	workId: string,
	references: BudgetItemReferenceRow[],
	tx?: Prisma.TransactionClient,
): Promise<BudgetBalanceRow[]> {
	if (references.length === 0) return [];
	const db = tx ?? prisma;
	const result = await mapSequentialBatches(
		references,
		SQLITE_BATCH_SIZE,
		async (batch) => {
			const identityIds = [...new Set(batch.map((ref) => ref.identityId))];
			const [ledgerRows, pendingRows] = await Promise.all([
				db.constructionLedgerEvent.groupBy({
					by: ["budgetItemIdentityId", "eventType", "sourceType"],
					where: { ownerId, workId, budgetItemIdentityId: { in: identityIds } },
					_sum: { amount: true },
				}),
				db.constructionBudgetImpact.findMany({
					where: {
						ownerId,
						workId,
						budgetItemIdentityId: { in: identityIds },
						status: IMPACT_STATUS_PENDING,
					},
					select: { budgetItemIdentityId: true, amount: true },
				}),
			]);
			const totalsByIdentity = new Map<
				string,
				{
					commitmentNet: Decimal;
					independentConsumed: Decimal;
					contractConsumed: Decimal;
				}
			>();
			for (const row of ledgerRows) {
				const current = totalsByIdentity.get(row.budgetItemIdentityId) ?? {
					commitmentNet: new Decimal(0),
					independentConsumed: new Decimal(0),
					contractConsumed: new Decimal(0),
				};
				const amount = row._sum?.amount ?? new Decimal(0);
				if (row.eventType === "COMMITMENT_INCREASE") {
					current.commitmentNet = current.commitmentNet.plus(amount);
				} else if (row.eventType === "COMMITMENT_REDUCTION") {
					current.commitmentNet = current.commitmentNet.minus(amount);
				} else if (row.eventType === "INCURRED_CREATE") {
					if (row.sourceType === "CONTRACT_MEASUREMENT") {
						current.contractConsumed = current.contractConsumed.plus(amount);
					} else {
						current.independentConsumed =
							current.independentConsumed.plus(amount);
					}
				} else if (row.eventType === "INCURRED_REVERSAL") {
					if (row.sourceType === "CONTRACT_MEASUREMENT") {
						current.contractConsumed = current.contractConsumed.minus(amount);
					} else {
						current.independentConsumed =
							current.independentConsumed.minus(amount);
					}
				}
				totalsByIdentity.set(row.budgetItemIdentityId, current);
			}
			const pendingByIdentity = new Map<string, Decimal>();
			for (const row of pendingRows) {
				pendingByIdentity.set(
					row.budgetItemIdentityId,
					(
						pendingByIdentity.get(row.budgetItemIdentityId) ?? new Decimal(0)
					).plus(row.amount),
				);
			}
			return batch.map((ref) => {
				const totals = totalsByIdentity.get(ref.identityId) ?? {
					commitmentNet: new Decimal(0),
					independentConsumed: new Decimal(0),
					contractConsumed: new Decimal(0),
				};
				return {
					budgetItemId: ref.budgetItemId,
					identityId: ref.identityId,
					versionItemId: ref.versionItemId,
					commitmentNet: totals.commitmentNet,
					independentConsumed: totals.independentConsumed,
					contractConsumed: totals.contractConsumed,
					pendingImpact:
						pendingByIdentity.get(ref.identityId) ?? new Decimal(0),
				};
			});
		},
	);
	return result.flat();
}

export type BudgetImpactRow = {
	id: string;
	ownerId: string;
	workId: string;
	budgetItemIdentityId: string;
	budgetVersionItemId: string;
	sourceType: string;
	sourceId: string;
	componentId: string;
	impactType: string;
	status: string;
	quantity: Prisma.Decimal | null;
	budgetUnitCostSnapshot: Prisma.Decimal | null;
	operationUnitCost: Prisma.Decimal | null;
	amount: Prisma.Decimal;
	approvalRequestId: string | null;
	parentImpactId: string | null;
	effectiveAt: Date | null;
	reversedAt: Date | null;
	createdAt: Date;
};

export async function findImpactByKey(
	tx: Prisma.TransactionClient,
	key: BudgetImpactKey,
): Promise<BudgetImpactRow | null> {
	return tx.constructionBudgetImpact.findFirst({
		where: {
			...key,
			reversedAt: null,
			status: { not: "REJECTED" },
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function findActiveImpactsBySource(
	tx: Prisma.TransactionClient,
	ownerId: string,
	workId: string,
	sourceType: string,
	sourceId: string,
): Promise<BudgetImpactRow[]> {
	return tx.constructionBudgetImpact.findMany({
		where: { ownerId, workId, sourceType, sourceId, reversedAt: null },
		orderBy: { createdAt: "asc" },
	});
}

export async function createImpact(
	tx: Prisma.TransactionClient,
	data: {
		ownerId: string;
		workId: string;
		budgetItemIdentityId: string;
		budgetVersionItemId: string;
		sourceType: string;
		sourceId: string;
		componentId: string;
		impactType: string;
		status: string;
		quantity: Decimal | null;
		budgetUnitCostSnapshot: Decimal | null;
		operationUnitCost: Decimal | null;
		amount: Decimal;
		approvalRequestId?: string | null;
		parentImpactId?: string | null;
		effectiveAt?: Date | null;
	},
): Promise<BudgetImpactRow> {
	return tx.constructionBudgetImpact.create({ data });
}

export async function findImpactById(
	ownerId: string,
	impactId: string,
	tx?: Prisma.TransactionClient,
): Promise<BudgetImpactRow | null> {
	const db = tx ?? prisma;
	return db.constructionBudgetImpact.findFirst({
		where: { id: impactId, ownerId },
	});
}

export async function setImpactStatus(
	tx: Prisma.TransactionClient,
	impactId: string,
	status: string,
	extra: Partial<{
		effectiveAt: Date;
		reversedAt: Date;
	}> = {},
): Promise<BudgetImpactRow | null> {
	return tx.constructionBudgetImpact.update({
		where: { id: impactId },
		data: { status, ...extra },
	});
}
