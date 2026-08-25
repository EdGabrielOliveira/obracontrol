import "dotenv/config";
import { writeFileSync } from "node:fs";
import type { PrismaClient } from "../../generated/prisma/client";
import { createLocalPrisma } from "../../src/lib/prisma-local";

type Report = {
	mode: "dry-run" | "apply";
	workspaceId: string;
	counts: Record<string, number>;
	afterCounts: Record<string, number> | null;
	assignments: Record<string, number>;
	divergences: Array<Record<string, string>>;
	completedAt: string;
};

const prisma: PrismaClient = createLocalPrisma();

async function countTables() {
	const [
		users,
		companies,
		organizations,
		costCenters,
		works,
		imports,
		budgetItems,
		contracts,
		suppliers,
	] = await Promise.all([
		prisma.user.count(),
		prisma.company.count(),
		prisma.organization.count(),
		prisma.costCenter.count(),
		prisma.constructionWork.count(),
		prisma.constructionImport.count(),
		prisma.constructionBudgetItem.count(),
		prisma.contract.count(),
		prisma.constructionSupplier.count(),
	]);
	return {
		users,
		companies,
		organizations,
		costCenters,
		works,
		imports,
		budgetItems,
		contracts,
		suppliers,
	};
}

async function main() {
	const apply = process.argv.includes("--apply");
	const outIndex = process.argv.indexOf("--out");
	const out = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
	const existing = await prisma.workspace.findFirst({
		orderBy: { createdAt: "asc" },
		select: { id: true },
	});
	const workspaceId = existing?.id ?? "workspace-legacy-default";
	const divergences: Array<Record<string, string>> = [];

	const [users, organizations, costCenters, works, companies, suppliers] =
		await Promise.all([
			prisma.user.findMany({ select: { id: true, workspaceId: true } }),
			prisma.organization.findMany({
				select: { id: true, name: true, ownerId: true, workspaceId: true },
			}),
			prisma.costCenter.findMany({
				select: { id: true, organizationId: true, workspaceId: true },
			}),
			prisma.constructionWork.findMany({
				select: {
					id: true,
					code: true,
					ownerId: true,
					costCenterId: true,
					workspaceId: true,
				},
			}),
			prisma.company.findMany({
				select: { id: true, name: true, workspaceId: true },
			}),
			prisma.constructionSupplier.findMany({
				select: { id: true, document: true, workspaceId: true },
			}),
		]);
	const userWorkspace = new Map(
		users.map((user) => [user.id, user.workspaceId ?? workspaceId]),
	);
	const organizationWorkspace = new Map<string, string>();
	for (const organization of organizations) {
		const value =
			organization.workspaceId ??
			userWorkspace.get(organization.ownerId) ??
			workspaceId;
		organizationWorkspace.set(organization.id, value);
	}
	const costCenterWorkspace = new Map<string, string>();
	for (const center of costCenters) {
		const value =
			center.workspaceId ??
			organizationWorkspace.get(center.organizationId) ??
			workspaceId;
		costCenterWorkspace.set(center.id, value);
	}
	for (const work of works) {
		const value =
			work.workspaceId ??
			costCenterWorkspace.get(work.costCenterId) ??
			workspaceId;
		if (work.workspaceId && work.workspaceId !== value) {
			divergences.push({
				type: "WORK_WORKSPACE",
				id: work.id,
				current: work.workspaceId,
				expected: value,
			});
		}
		const ownerWorkspace = userWorkspace.get(work.ownerId);
		if (ownerWorkspace && ownerWorkspace !== value) {
			divergences.push({
				type: "WORK_OWNER_LEGACY_DRIFT",
				id: work.id,
				ownerWorkspace,
				workspace: value,
			});
		}
	}
	const duplicateKeys = new Map<string, string[]>();
	const addDuplicate = (key: string, id: string) => {
		const ids = duplicateKeys.get(key) ?? [];
		ids.push(id);
		duplicateKeys.set(key, ids);
	};
	for (const row of companies)
		addDuplicate(
			`COMPANY:${row.workspaceId ?? workspaceId}:${row.name.trim().toLowerCase()}`,
			row.id,
		);
	for (const row of organizations)
		addDuplicate(
			`ORGANIZATION:${organizationWorkspace.get(row.id) ?? workspaceId}:${row.name.trim().toLowerCase()}`,
			row.id,
		);
	for (const row of works)
		addDuplicate(
			`WORK:${costCenterWorkspace.get(row.costCenterId) ?? workspaceId}:${row.code}`,
			row.id,
		);
	for (const row of suppliers)
		if (row.document)
			addDuplicate(
				`SUPPLIER:${row.workspaceId ?? workspaceId}:${row.document}`,
				row.id,
			);
	for (const [key, ids] of duplicateKeys) {
		if (ids.length > 1)
			divergences.push({
				type: "DUPLICATE_WORKSPACE_KEY",
				key,
				ids: ids.sort().join(","),
			});
	}

	const counts = await countTables();
	const assignments = {
		users: users.filter((row) => !row.workspaceId).length,
		organizations: organizations.filter((row) => !row.workspaceId).length,
		costCenters: costCenters.filter((row) => !row.workspaceId).length,
		works: works.filter((row) => !row.workspaceId).length,
	};

	if (apply) {
		if (divergences.length > 0) {
			throw new Error(
				`Migracao bloqueada: ${divergences.length} divergencias precisam ser resolvidas no dry-run`,
			);
		}
		await prisma.$transaction(async (tx) => {
			if (!existing) {
				await tx.workspace.create({
					data: { id: workspaceId, name: "Conta legada" },
				});
			}
			for (const user of users) {
				if (!user.workspaceId)
					await tx.user.update({
						where: { id: user.id },
						data: { workspaceId },
					});
			}
			for (const organization of organizations) {
				await tx.organization.update({
					where: { id: organization.id },
					data: {
						workspaceId:
							organizationWorkspace.get(organization.id) ?? workspaceId,
					},
				});
			}
			for (const center of costCenters) {
				await tx.costCenter.update({
					where: { id: center.id },
					data: {
						workspaceId: costCenterWorkspace.get(center.id) ?? workspaceId,
					},
				});
			}
			for (const work of works) {
				const value = costCenterWorkspace.get(work.costCenterId) ?? workspaceId;
				await tx.constructionWork.update({
					where: { id: work.id },
					data: { workspaceId: value },
				});
				await tx.constructionImport.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.importBatch.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.constructionBudgetItem.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.budgetVersion.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.budgetItemIdentity.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.constructionBudgetReconciliation.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.budgetProjectionState.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.budgetProjectionOutbox.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.contract.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.contractMeasurement.updateMany({
					where: { contract: { workId: work.id } },
					data: { workspaceId: value },
				});
				await tx.contractPayment.updateMany({
					where: { contract: { workId: work.id } },
					data: { workspaceId: value },
				});
				await tx.constructionContractAmendment.updateMany({
					where: { contract: { workId: work.id } },
					data: { workspaceId: value },
				});
			}
			await tx.company.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.constructionSupplier.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.userInvitation.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
		});
	}

	const report: Report = {
		mode: apply ? "apply" : "dry-run",
		workspaceId,
		counts,
		afterCounts: apply ? await countTables() : null,
		assignments,
		divergences,
		completedAt: new Date().toISOString(),
	};
	const json = JSON.stringify(report, null, 2);
	if (out) writeFileSync(out, json);
	console.log(json);
}

try {
	await main();
} finally {
	await prisma.$disconnect();
}
