import "dotenv/config";
import { writeFileSync } from "node:fs";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { createLocalPrisma } from "../../src/lib/prisma-local";

type Report = {
	mode: "dry-run" | "apply";
	workspaceId: string | null;
	counts: Record<string, number>;
	afterCounts: Record<string, number> | null;
	assignments: Record<string, number>;
	unassigned: Record<string, number>;
	afterUnassigned: Record<string, number> | null;
	divergences: Array<Record<string, string>>;
	legacyOwnerDrifts: Array<Record<string, string>>;
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

type WorkspaceClient = PrismaClient | Prisma.TransactionClient;

async function countUnassignedWorkspaceIds(client: WorkspaceClient) {
	const where = { workspaceId: null };
	const [
		users,
		invitations,
		companies,
		organizations,
		costCenters,
		works,
		workCreationIdempotencies,
		photoReports,
		imports,
		importBatches,
		budgetItems,
		budgetVersions,
		budgetIdentities,
		budgetReconciliations,
		budgetProjectionStates,
		budgetProjectionOutbox,
		contracts,
		contractArtifacts,
		contractMeasurements,
		contractPayments,
		contractAmendments,
		contractAmendmentMeasurements,
		suppliers,
	] = await Promise.all([
		client.user.count({ where }),
		client.userInvitation.count({ where }),
		client.company.count({ where }),
		client.organization.count({ where }),
		client.costCenter.count({ where }),
		client.constructionWork.count({ where }),
		client.workCreationIdempotency.count({ where }),
		client.photoReport.count({ where }),
		client.constructionImport.count({ where }),
		client.importBatch.count({ where }),
		client.constructionBudgetItem.count({ where }),
		client.budgetVersion.count({ where }),
		client.budgetItemIdentity.count({ where }),
		client.constructionBudgetReconciliation.count({ where }),
		client.budgetProjectionState.count({ where }),
		client.budgetProjectionOutbox.count({ where }),
		client.contract.count({ where }),
		client.contractInstrumentArtifact.count({ where }),
		client.contractMeasurement.count({ where }),
		client.contractPayment.count({ where }),
		client.constructionContractAmendment.count({ where }),
		client.contractAmendmentMeasurement.count({ where }),
		client.constructionSupplier.count({ where }),
	]);
	return {
		users,
		invitations,
		companies,
		organizations,
		costCenters,
		works,
		workCreationIdempotencies,
		photoReports,
		imports,
		importBatches,
		budgetItems,
		budgetVersions,
		budgetIdentities,
		budgetReconciliations,
		budgetProjectionStates,
		budgetProjectionOutbox,
		contracts,
		contractArtifacts,
		contractMeasurements,
		contractPayments,
		contractAmendments,
		contractAmendmentMeasurements,
		suppliers,
	};
}

function total(rows: Record<string, number>): number {
	return Object.values(rows).reduce((sum, value) => sum + value, 0);
}

async function main() {
	const apply = process.argv.includes("--apply");
	const outIndex = process.argv.indexOf("--out");
	const out = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
	const existing = await prisma.workspace.findFirst({
		orderBy: { createdAt: "asc" },
		select: { id: true },
	});
	const divergences: Array<Record<string, string>> = [];
	const legacyOwnerDrifts: Array<Record<string, string>> = [];

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
	const counts = await countTables();
	const unassigned = await countUnassignedWorkspaceIds(prisma);
	const workspaceId =
		existing?.id ?? (total(unassigned) > 0 ? "workspace-legacy-default" : null);
	const fallbackWorkspaceId = workspaceId ?? "workspace-legacy-default";
	const userWorkspace = new Map(
		users.map((user) => [user.id, user.workspaceId ?? fallbackWorkspaceId]),
	);
	const organizationWorkspace = new Map<string, string>();
	for (const organization of organizations) {
		const value =
			organization.workspaceId ??
			userWorkspace.get(organization.ownerId) ??
			fallbackWorkspaceId;
		organizationWorkspace.set(organization.id, value);
	}
	const costCenterWorkspace = new Map<string, string>();
	for (const center of costCenters) {
		const value =
			center.workspaceId ??
			organizationWorkspace.get(center.organizationId) ??
			fallbackWorkspaceId;
		costCenterWorkspace.set(center.id, value);
	}
	for (const work of works) {
		const expectedWorkspace =
			costCenterWorkspace.get(work.costCenterId) ?? fallbackWorkspaceId;
		const value = work.workspaceId ?? expectedWorkspace;
		if (work.workspaceId && work.workspaceId !== expectedWorkspace) {
			divergences.push({
				type: "WORK_WORKSPACE",
				id: work.id,
				current: work.workspaceId,
				expected: expectedWorkspace,
			});
		}
		const ownerWorkspace = userWorkspace.get(work.ownerId);
		if (ownerWorkspace && ownerWorkspace !== value) {
			legacyOwnerDrifts.push({
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
			`COMPANY:${row.workspaceId ?? fallbackWorkspaceId}:${row.name.trim().toLowerCase()}`,
			row.id,
		);
	for (const row of organizations)
		addDuplicate(
			`ORGANIZATION:${organizationWorkspace.get(row.id) ?? fallbackWorkspaceId}:${row.name.trim().toLowerCase()}`,
			row.id,
		);
	for (const row of works)
		addDuplicate(
			`WORK:${costCenterWorkspace.get(row.costCenterId) ?? fallbackWorkspaceId}:${row.code}`,
			row.id,
		);
	for (const row of suppliers)
		if (row.document)
			addDuplicate(
				`SUPPLIER:${row.workspaceId ?? fallbackWorkspaceId}:${row.document}`,
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

	const assignments = {
		users: users.filter((row) => !row.workspaceId).length,
		organizations: organizations.filter((row) => !row.workspaceId).length,
		costCenters: costCenters.filter((row) => !row.workspaceId).length,
		works: works.filter((row) => !row.workspaceId).length,
	};

	if (apply && workspaceId) {
		if (divergences.length > 0) {
			const json = JSON.stringify(
				{
					mode: "apply-preflight",
					workspaceId,
					counts,
					unassigned,
					divergences,
					legacyOwnerDrifts,
					completedAt: new Date().toISOString(),
				},
				null,
				2,
			);
			if (out) writeFileSync(out, json);
			console.error(json);
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
				await tx.workCreationIdempotency.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.photoReport.updateMany({
					where: { workId: work.id },
					data: { workspaceId: value },
				});
				await tx.contractInstrumentArtifact.updateMany({
					where: { contract: { workId: work.id } },
					data: { workspaceId: value },
				});
				await tx.contractAmendmentMeasurement.updateMany({
					where: { amendment: { contract: { workId: work.id } } },
					data: { workspaceId: value },
				});
			}
			// A producao atual e uma conta compartilhada. Qualquer registro legado
			// ainda sem pai resolvivel tambem pertence ao workspace padrao, evitando
			// deixar colunas nulas apos a migracao.
			await tx.constructionImport.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.importBatch.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.constructionBudgetItem.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.budgetVersion.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.budgetItemIdentity.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.constructionBudgetReconciliation.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.budgetProjectionState.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.budgetProjectionOutbox.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.contract.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.contractInstrumentArtifact.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.contractMeasurement.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.contractPayment.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.constructionContractAmendment.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.contractAmendmentMeasurement.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.workCreationIdempotency.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
			await tx.photoReport.updateMany({
				where: { workspaceId: null },
				data: { workspaceId },
			});
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
			const pending = await countUnassignedWorkspaceIds(tx);
			if (total(pending) > 0) {
				throw new Error(
					`Migracao bloqueada: ${total(pending)} registros permaneceram sem workspaceId`,
				);
			}
		});
	}

	const report: Report = {
		mode: apply ? "apply" : "dry-run",
		workspaceId,
		counts,
		afterCounts: apply ? await countTables() : null,
		assignments,
		unassigned,
		afterUnassigned: apply ? await countUnassignedWorkspaceIds(prisma) : null,
		divergences,
		legacyOwnerDrifts,
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
