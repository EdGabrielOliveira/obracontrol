/**
 * Preflight da remediacao da auditoria (somente leitura).
 *
 * Spec: docs/superpowers/specs/2026-08-10-audit-remediation-design.md#162-preflight-obrigatorio
 * Plano: docs/superpowers/plans/2026-08-10-audit-remediation-implementation-plan.md (BASE-02)
 *
 * Garantias:
 * - nenhum write: apenas findMany/groupBy/count;
 * - determinismo: todas as consultas ordenadas por id; saida JSON sem
 *   timestamps; Decimal serializado como string com precisao fixa;
 * - privacidade: nunca exporta blob (contractTemplateBlob), credencial,
 *   token ou email.
 *
 * Uso:
 *   bun prisma/scripts/audit-remediation-preflight.ts [--out-dir <dir>]
 *
 * Exit code: 0 sem bloqueio; 1 com linhas bloqueantes; 2 em erro de execucao.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

export const PREFLIGHT_REPORT_VERSION = "1";

/** Tolerancia monetaria D-04: divergencia acima de R$ 0,01 bloqueia a linha. */
export const COST_DIVERGENCE_TOLERANCE = "0.01";

export interface PreflightRow {
	[key: string]: string | null;
}

export interface PreflightSection {
	id: string;
	label: string;
	blocking: boolean;
	rows: PreflightRow[];
}

export interface PreflightReport {
	reportVersion: string;
	sections: PreflightSection[];
	summary: {
		totalRows: number;
		blockingRows: number;
		blockingSectionIds: string[];
	};
}

export interface PreflightOptions {
	prisma: PrismaClient;
}

/** Serializa Decimal como string com precisao fixa (nunca `number`). */
export function decimalString(value: Decimal.Value | null): string | null {
	if (value === null || value === undefined) return null;
	return new Decimal(value).toFixed(4);
}

export function buildReportSummary(
	report: Omit<PreflightReport, "summary">,
): PreflightReport["summary"] {
	let totalRows = 0;
	let blockingRows = 0;
	const blockingSectionIds: string[] = [];
	for (const section of report.sections) {
		totalRows += section.rows.length;
		if (section.blocking && section.rows.length > 0) {
			blockingRows += section.rows.length;
			blockingSectionIds.push(section.id);
		}
	}
	return { totalRows, blockingRows, blockingSectionIds };
}

export function hasBlockingRows(report: PreflightReport): boolean {
	return report.summary.blockingRows > 0;
}

function section(
	id: string,
	label: string,
	blocking: boolean,
	rows: PreflightRow[],
): PreflightSection {
	rows.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
	return { id, label, blocking, rows };
}

async function collectOrganizationsWithoutCompany(
	prisma: PrismaClient,
): Promise<PreflightRow[]> {
	const rows = await prisma.organization.findMany({
		where: { companyId: null },
		select: { id: true, name: true, ownerId: true },
		orderBy: { id: "asc" },
	});
	return rows.map((row) => ({
		id: row.id,
		organizationId: row.id,
		name: row.name,
		ownerId: row.ownerId,
	}));
}

async function collectCompaniesWithoutValidDocx(
	prisma: PrismaClient,
): Promise<PreflightRow[]> {
	const withBlob = await prisma.company.findMany({
		where: { contractTemplateBlob: { not: null } },
		select: { id: true },
	});
	const withBlobIds = new Set(withBlob.map((row) => row.id));
	const rows = await prisma.company.findMany({
		select: {
			id: true,
			name: true,
			ownerId: true,
			contractTemplate: true,
			contractTemplateType: true,
		},
		orderBy: { id: "asc" },
	});
	const invalid: PreflightRow[] = [];
	for (const row of rows) {
		const hasBlob = withBlobIds.has(row.id);
		if (!(hasBlob && row.contractTemplateType === "DOCX")) {
			invalid.push({
				id: row.id,
				companyId: row.id,
				name: row.name,
				ownerId: row.ownerId,
				templateType: row.contractTemplateType ?? null,
				hasBlob: hasBlob ? "true" : "false",
			});
		}
	}
	return invalid;
}

async function collectCostSections(prisma: PrismaClient) {
	const costs = await prisma.constructionActualCost.findMany({
		select: {
			id: true,
			workId: true,
			ownerId: true,
			amount: true,
			budgetItemId: true,
		},
		orderBy: { id: "asc" },
	});
	const allocations = await prisma.actualCostAllocation.findMany({
		select: { actualCostId: true, value: true },
		orderBy: [{ actualCostId: "asc" }, { id: "asc" }],
	});
	const sumByCost = new Map<string, Decimal>();
	const countByCost = new Map<string, number>();
	for (const allocation of allocations) {
		const current = sumByCost.get(allocation.actualCostId) ?? new Decimal(0);
		sumByCost.set(
			allocation.actualCostId,
			current.plus(new Decimal(allocation.value as Decimal.Value)),
		);
		countByCost.set(
			allocation.actualCostId,
			(countByCost.get(allocation.actualCostId) ?? 0) + 1,
		);
	}

	const withoutResolvableItem: PreflightRow[] = [];
	const withMultipleAllocations: PreflightRow[] = [];
	const withDivergentAllocations: PreflightRow[] = [];
	for (const cost of costs) {
		const allocationCount = countByCost.get(cost.id) ?? 0;
		if (cost.budgetItemId === null && allocationCount === 0) {
			withoutResolvableItem.push({
				id: cost.id,
				actualCostId: cost.id,
				workId: cost.workId,
				ownerId: cost.ownerId,
				amount: decimalString(cost.amount),
			});
		}
		if (allocationCount > 1) {
			withMultipleAllocations.push({
				id: cost.id,
				actualCostId: cost.id,
				workId: cost.workId,
				ownerId: cost.ownerId,
				allocationCount: String(allocationCount),
			});
		}
		const allocationSum = sumByCost.get(cost.id);
		if (allocationSum !== undefined) {
			const difference = cost.amount.minus(allocationSum);
			if (difference.abs().gt(COST_DIVERGENCE_TOLERANCE)) {
				withDivergentAllocations.push({
					id: cost.id,
					actualCostId: cost.id,
					workId: cost.workId,
					ownerId: cost.ownerId,
					amount: decimalString(cost.amount),
					allocationsSum: decimalString(allocationSum),
					difference: decimalString(difference),
				});
			}
		}
	}
	return {
		withoutResolvableItem,
		withMultipleAllocations,
		withDivergentAllocations,
	};
}

async function collectOrphanWorkMemberships(prisma: PrismaClient) {
	const memberships = await prisma.workMembership.findMany({
		where: { revokedAt: null },
		select: { id: true, userId: true, workId: true },
		orderBy: { id: "asc" },
	});
	const activeCenterMemberships = await prisma.costCenterMembership.findMany({
		where: { revokedAt: null },
		select: { userId: true, costCenterId: true },
	});
	const activePairs = new Set(
		activeCenterMemberships.map((row) => `${row.userId}|${row.costCenterId}`),
	);
	const works = await prisma.constructionWork.findMany({
		select: { id: true, costCenterId: true },
		orderBy: { id: "asc" },
	});
	const workById = new Map(works.map((work) => [work.id, work]));

	const rows: PreflightRow[] = [];
	for (const membership of memberships) {
		const work = workById.get(membership.workId);
		if (!work) continue;
		const pair = `${membership.userId}|${work.costCenterId}`;
		if (!activePairs.has(pair)) {
			rows.push({
				id: membership.id,
				membershipId: membership.id,
				userId: membership.userId,
				workId: membership.workId,
				costCenterId: work.costCenterId,
			});
		}
	}
	return rows;
}

interface OwnerMismatchResource {
	resourceType: string;
	resources: { id: string; workId: string | null; ownerId: string }[];
}

async function collectOwnerMismatches(prisma: PrismaClient) {
	const resources: OwnerMismatchResource[] = [
		{
			resourceType: "ACTUAL_COST",
			resources: await prisma.constructionActualCost.findMany({
				select: { id: true, workId: true, ownerId: true },
			}),
		},
		{
			resourceType: "CONTRACT",
			resources: await prisma.contract.findMany({
				select: { id: true, workId: true, ownerId: true },
			}),
		},
		{
			resourceType: "CONTRACT_REQUEST",
			resources: await prisma.contractRequest.findMany({
				select: { id: true, workId: true, ownerId: true },
			}),
		},
		{
			resourceType: "CONTRACT_REQUEST_PROPOSAL",
			resources: await prisma.contractRequestProposal.findMany({
				select: { id: true, workId: true, ownerId: true },
			}),
		},
		{
			resourceType: "QUOTATION",
			resources: await prisma.quotation.findMany({
				select: { id: true, workId: true, ownerId: true },
			}),
		},
		{
			resourceType: "WORK_SUPPLIER",
			resources: await prisma.constructionWorkSupplier.findMany({
				select: { id: true, workId: true, ownerId: true },
			}),
		},
		{
			resourceType: "IMPORT_BATCH",
			resources: await prisma.importBatch.findMany({
				where: { workId: { not: null } },
				select: { id: true, workId: true, ownerId: true },
			}),
		},
	];
	const works = await prisma.constructionWork.findMany({
		select: { id: true, ownerId: true },
	});
	const workOwnerById = new Map(works.map((work) => [work.id, work.ownerId]));

	const rows: PreflightRow[] = [];
	for (const group of resources) {
		for (const resource of group.resources) {
			if (resource.workId === null) continue;
			const workOwnerId = workOwnerById.get(resource.workId);
			if (workOwnerId !== undefined && workOwnerId !== resource.ownerId) {
				rows.push({
					id: `${group.resourceType}:${resource.id}`,
					resourceType: group.resourceType,
					resourceId: resource.id,
					workId: resource.workId,
					resourceOwnerId: resource.ownerId,
					workOwnerId,
				});
			}
		}
	}
	rows.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
	return rows;
}

async function collectOriginContractAnomalies(prisma: PrismaClient) {
	const quotationsWithContract = await prisma.quotation.findMany({
		where: { contractId: { not: null } },
		select: { id: true, contractId: true },
		orderBy: { id: "asc" },
	});
	const requestContracts = await prisma.contractRequest.findMany({
		where: { contractId: { not: null } },
		select: { id: true, contractId: true },
		orderBy: { id: "asc" },
	});

	const quotationByContract = new Map<string, string[]>();
	for (const quotation of quotationsWithContract) {
		const key = quotation.contractId as string;
		const list = quotationByContract.get(key) ?? [];
		list.push(quotation.id);
		quotationByContract.set(key, list);
	}

	const rows: PreflightRow[] = [];
	for (const [contractId, originIds] of quotationByContract) {
		originIds.sort();
		if (originIds.length > 1) {
			for (const originId of originIds) {
				rows.push({
					id: `QUOTATION:${originId}:${contractId}`,
					originType: "QUOTATION",
					originId,
					contractId,
					originCount: String(originIds.length),
				});
			}
		}
	}
	for (const request of requestContracts) {
		const key = request.contractId as string;
		const originIds = quotationByContract.get(key) ?? [];
		if (originIds.length > 0) {
			rows.push({
				id: `CONTRACT:${key}`,
				contractId: key,
				requestId: request.id,
				quotationIds: originIds.join(","),
			});
		}
	}
	rows.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
	return rows;
}

async function collectInstrumentsWithoutArtifact(prisma: PrismaClient) {
	// Release A: a tabela de artefato (ContractInstrumentArtifact) ainda nao
	// existe; qualquer instrumentGeneratedAt sem artefato e bloqueio (DOC-02).
	const rows = await prisma.contract.findMany({
		where: { instrumentGeneratedAt: { not: null } },
		select: {
			id: true,
			workId: true,
			ownerId: true,
			instrumentGeneratedAt: true,
		},
		orderBy: { id: "asc" },
	});
	return rows.map((row) => ({
		id: row.id,
		contractId: row.id,
		workId: row.workId,
		ownerId: row.ownerId,
		instrumentGeneratedAt: row.instrumentGeneratedAt?.toISOString() ?? null,
	}));
}

export async function runAuditRemediationPreflight(
	options: PreflightOptions,
): Promise<PreflightReport> {
	const { prisma } = options;
	const sections: PreflightSection[] = [
		section(
			"organizationsWithoutCompany",
			"Organizacoes sem empresa (companyId nulo)",
			true,
			await collectOrganizationsWithoutCompany(prisma),
		),
		section(
			"companiesWithoutValidDocx",
			"Empresas sem template DOCX valido",
			true,
			await collectCompaniesWithoutValidDocx(prisma),
		),
		...Object.entries(await collectCostSections(prisma)).map(
			([key, rows]): PreflightSection => {
				const meta: Record<string, { id: string; label: string }> = {
					withoutResolvableItem: {
						id: "costsWithoutResolvableItem",
						label:
							"Custos sem item resolvivel (sem budgetItemId e sem alocacoes)",
					},
					withMultipleAllocations: {
						id: "costsWithMultipleAllocations",
						label: "Custos com multiplas alocacoes",
					},
					withDivergentAllocations: {
						id: "costsWithDivergentAllocations",
						label: "Custos com soma de alocacoes divergente (acima de R$ 0,01)",
					},
				};
				const definition = meta[key];
				return section(definition.id, definition.label, true, rows);
			},
		),
		section(
			"orphanWorkMemberships",
			"Work memberships ativas sem membership ativa no centro pai",
			true,
			await collectOrphanWorkMemberships(prisma),
		),
		section(
			"ownerMismatches",
			"Recursos com owner diferente do owner da obra",
			true,
			await collectOwnerMismatches(prisma),
		),
		section(
			"originContractAnomalies",
			"Cotacoes/solicitacoes com mais de um contrato resultante ou contrato com multiplas origens",
			true,
			await collectOriginContractAnomalies(prisma),
		),
		section(
			"instrumentsWithoutArtifact",
			"Contratos marcados como instrumento gerado sem artefato",
			true,
			await collectInstrumentsWithoutArtifact(prisma),
		),
	];

	const report: PreflightReport = {
		reportVersion: PREFLIGHT_REPORT_VERSION,
		sections,
		summary: buildReportSummary({
			reportVersion: PREFLIGHT_REPORT_VERSION,
			sections,
		}),
	};
	return report;
}

export function serializeReportJson(report: PreflightReport): string {
	return JSON.stringify(report, null, 2);
}

const CSV_HEADERS: Record<string, string[]> = {
	organizationsWithoutCompany: ["organizationId", "name", "ownerId"],
	companiesWithoutValidDocx: [
		"companyId",
		"name",
		"ownerId",
		"templateType",
		"hasBlob",
	],
	costsWithoutResolvableItem: ["actualCostId", "workId", "ownerId", "amount"],
	costsWithMultipleAllocations: [
		"actualCostId",
		"workId",
		"ownerId",
		"allocationCount",
	],
	costsWithDivergentAllocations: [
		"actualCostId",
		"workId",
		"ownerId",
		"amount",
		"allocationsSum",
		"difference",
	],
	orphanWorkMemberships: ["membershipId", "userId", "workId", "costCenterId"],
	ownerMismatches: [
		"resourceType",
		"resourceId",
		"workId",
		"resourceOwnerId",
		"workOwnerId",
	],
	originContractAnomalies: [
		"originType",
		"originId",
		"contractId",
		"requestId",
		"quotationIds",
		"originCount",
	],
	instrumentsWithoutArtifact: [
		"contractId",
		"workId",
		"ownerId",
		"instrumentGeneratedAt",
	],
};

function escapeCsv(value: string): string {
	if (/[;"\n\r]/.test(value)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

export function serializeReportCsvs(
	report: PreflightReport,
): Map<string, string> {
	const csvs = new Map<string, string>();
	for (const csvSection of report.sections) {
		const headers = CSV_HEADERS[csvSection.id];
		if (!headers) continue;
		const lines = [headers.join(";")];
		for (const row of csvSection.rows) {
			lines.push(
				headers.map((header) => escapeCsv(row[header] ?? "")).join(";"),
			);
		}
		// BOM UTF-8 para Excel abrir com acentuacao correta.
		csvs.set(csvSection.id, `\uFEFF${lines.join("\r\n")}\r\n`);
	}
	return csvs;
}

async function main() {
	const args = process.argv.slice(2);
	const outDirIndex = args.indexOf("--out-dir");
	const outDir =
		outDirIndex >= 0 && args[outDirIndex + 1]
			? args[outDirIndex + 1]
			: "preflight-output";

	const prisma = new PrismaClient();
	try {
		const report = await runAuditRemediationPreflight({ prisma });
		process.stdout.write(`${serializeReportJson(report)}\n`);
		mkdirSync(outDir, { recursive: true });
		for (const [fileName, content] of serializeReportCsvs(report)) {
			writeFileSync(join(outDir, `${fileName}.csv`), content);
		}
		process.stderr.write(
			`Preflight: ${report.summary.totalRows} linhas, ${report.summary.blockingRows} bloqueantes ` +
				`(secoes: ${report.summary.blockingSectionIds.join(", ") || "nenhuma"}). ` +
				`CSVs em ${outDir}.\n`,
		);
		process.exit(hasBlockingRows(report) ? 1 : 0);
	} catch (error) {
		console.error("Preflight falhou:", error);
		process.exit(2);
	} finally {
		await prisma.$disconnect();
	}
}

if (import.meta.main) {
	main();
}
