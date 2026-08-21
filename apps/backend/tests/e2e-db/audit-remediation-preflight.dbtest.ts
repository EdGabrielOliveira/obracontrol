import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	hasBlockingRows,
	type PreflightReport,
	runAuditRemediationPreflight,
	serializeReportCsvs,
	serializeReportJson,
} from "../../prisma/scripts/audit-remediation-preflight";
import { prisma } from "../../src/lib/prisma";
import {
	CC_A,
	OWNER_A,
	OWNER_B,
	resetAndSeedDatabase,
	WORK_A,
} from "./setup.dbtest";

const ORPHAN_USER = "preflight-user-orphan";
const ORPHAN_OK_USER = "preflight-user-ok";
const ORPHAN_WORK = "preflight-work-orphan";

const FIXTURE_ORG = "preflight-org-no-company";
const FIXTURE_COMPANY_DOCX = "preflight-company-docx";
const FIXTURE_COST_UNRESOLVABLE = "preflight-cost-unresolvable";
const FIXTURE_COST_MULTI = "preflight-cost-multi";
const FIXTURE_COST_DIVERGENT = "preflight-cost-divergent";
const FIXTURE_COST_CLEAN = "preflight-cost-clean";
const FIXTURE_COST_OWNER_MISMATCH = "preflight-cost-owner-mismatch";
const FIXTURE_CONTRACT_SHARED = "preflight-contract-shared";
const FIXTURE_REQUEST_SHARED = "preflight-request-shared";
const FIXTURE_QUOTATION_1 = "preflight-quotation-1";
const FIXTURE_QUOTATION_2 = "preflight-quotation-2";
const FIXTURE_CONTRACT_INSTRUMENT = "preflight-contract-instrument";

function rowsOf(report: PreflightReport, sectionId: string) {
	const section = report.sections.find(
		(candidate) => candidate.id === sectionId,
	);
	return section ? section.rows : [];
}

function rowIds(report: PreflightReport, sectionId: string): string[] {
	return rowsOf(report, sectionId).map((row) => row.id ?? "");
}

describe("BASE-02 preflight somente leitura", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();

		await prisma.user.create({
			data: {
				id: ORPHAN_USER,
				email: "preflight-orphan@e2e.obra.bi",
				name: "Preflight Orphan",
				role: "SUPERVISOR",
			},
		});
		await prisma.user.create({
			data: {
				id: ORPHAN_OK_USER,
				email: "preflight-ok@e2e.obra.bi",
				name: "Preflight Ok",
				role: "SUPERVISOR",
			},
		});
		await prisma.organization.create({
			data: {
				id: FIXTURE_ORG,
				ownerId: OWNER_A,
				name: "Preflight Org Sem Empresa",
			},
		});
		await prisma.company.create({
			data: {
				id: FIXTURE_COMPANY_DOCX,
				ownerId: OWNER_A,
				name: "Preflight DOCX Valido",
				document: "11.222.333/0001-44",
				contractTemplate: "modelo.docx",
				contractTemplateType: "DOCX",
				contractTemplateBlob: Buffer.from("PK\u0003\u0004preflight-docx"),
			},
		});
		await prisma.constructionWork.create({
			data: {
				id: ORPHAN_WORK,
				ownerId: OWNER_A,
				code: "PREFLIGHT-ORPHAN-1",
				name: "Preflight Work Sem Centro Ativo",
				costCenterId: CC_A,
			},
		});
		await prisma.workMembership.create({
			data: {
				id: "preflight-membership-orphan",
				workId: ORPHAN_WORK,
				userId: ORPHAN_USER,
				role: "SUPERVISOR",
			},
		});
		await prisma.workMembership.create({
			data: {
				id: "preflight-membership-ok",
				workId: ORPHAN_WORK,
				userId: ORPHAN_OK_USER,
				role: "SUPERVISOR",
			},
		});
		await prisma.costCenterMembership.create({
			data: {
				id: "preflight-cc-membership-ok",
				costCenterId: CC_A,
				userId: ORPHAN_OK_USER,
				role: "SUPERVISOR",
			},
		});

		const item = await prisma.constructionBudgetItem.findFirst({
			where: { ownerId: OWNER_A, workId: WORK_A },
			orderBy: { createdAt: "asc" },
			select: { id: true },
		});
		if (!item)
			throw new Error("seed sem item de orcamento para fixtures de custo");

		const costCommon = {
			ownerId: OWNER_A,
			workId: WORK_A,
			category: "OUTROS",
			costType: "DESPESA",
			appropriationStatus: "APPROPRIATED",
		} as const;

		await prisma.constructionActualCost.create({
			data: {
				...costCommon,
				id: FIXTURE_COST_UNRESOLVABLE,
				amount: 100,
				budgetItemId: null,
			},
		});
		await prisma.constructionActualCost.create({
			data: {
				...costCommon,
				id: FIXTURE_COST_MULTI,
				amount: 100,
				budgetItemId: null,
			},
		});
		await prisma.constructionActualCost.create({
			data: {
				...costCommon,
				id: FIXTURE_COST_DIVERGENT,
				amount: 100,
				budgetItemId: null,
			},
		});
		await prisma.constructionActualCost.create({
			data: {
				...costCommon,
				id: FIXTURE_COST_CLEAN,
				amount: 100,
				budgetItemId: item.id,
			},
		});
		await prisma.constructionActualCost.create({
			data: {
				id: FIXTURE_COST_OWNER_MISMATCH,
				ownerId: OWNER_B,
				workId: WORK_A,
				amount: 10,
				category: "OUTROS",
				costType: "DESPESA",
				appropriationStatus: "APPROPRIATED",
			},
		});

		const allocationCommon = {
			budgetItemId: item.id,
			ownerId: OWNER_A,
			basis: "VALUE",
			percentage: 0,
		} as const;
		await prisma.actualCostAllocation.create({
			data: {
				...allocationCommon,
				id: "preflight-alloc-multi-1",
				actualCostId: FIXTURE_COST_MULTI,
				value: 60,
			},
		});
		await prisma.actualCostAllocation.create({
			data: {
				...allocationCommon,
				id: "preflight-alloc-multi-2",
				actualCostId: FIXTURE_COST_MULTI,
				value: 40,
			},
		});
		await prisma.actualCostAllocation.create({
			data: {
				...allocationCommon,
				id: "preflight-alloc-divergent",
				actualCostId: FIXTURE_COST_DIVERGENT,
				value: 95,
			},
		});
		await prisma.actualCostAllocation.create({
			data: {
				...allocationCommon,
				id: "preflight-alloc-clean",
				actualCostId: FIXTURE_COST_CLEAN,
				value: 100,
			},
		});

		await prisma.contract.create({
			data: {
				id: FIXTURE_CONTRACT_SHARED,
				ownerId: OWNER_A,
				workId: WORK_A,
				code: "PREFLIGHT-SHARED-1",
				supplierName: "Fornecedor Preflight",
				contractValue: 10,
			},
		});
		await prisma.quotation.create({
			data: {
				id: FIXTURE_QUOTATION_1,
				ownerId: OWNER_A,
				workId: WORK_A,
				title: "Preflight Cotacao 1",
				status: "CONTRATADA",
				contractId: FIXTURE_CONTRACT_SHARED,
			},
		});
		await prisma.quotation.create({
			data: {
				id: FIXTURE_QUOTATION_2,
				ownerId: OWNER_A,
				workId: WORK_A,
				title: "Preflight Cotacao 2",
				status: "CONTRATADA",
				contractId: FIXTURE_CONTRACT_SHARED,
			},
		});
		await prisma.contractRequest.create({
			data: {
				id: FIXTURE_REQUEST_SHARED,
				ownerId: OWNER_A,
				workId: WORK_A,
				title: "Preflight Solicitacao Compartilhada",
				serviceType: "OBRA",
				contractId: FIXTURE_CONTRACT_SHARED,
			},
		});
		await prisma.contract.create({
			data: {
				id: FIXTURE_CONTRACT_INSTRUMENT,
				ownerId: OWNER_A,
				workId: WORK_A,
				code: "PREFLIGHT-INSTRUMENT-1",
				supplierName: "Fornecedor Preflight",
				contractValue: 10,
				instrumentGeneratedAt: new Date("2026-01-01T12:00:00.000Z"),
				instrumentGeneratedBy: "seed",
				instrumentTemplateVersion: "1",
			},
		});
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("identifica cada grupo de anomalia com as linhas esperadas", async () => {
		const report = await runAuditRemediationPreflight({ prisma });

		const orgIds = rowIds(report, "organizationsWithoutCompany");
		expect(orgIds).toContain(FIXTURE_ORG);

		const docxIds = rowIds(report, "companiesWithoutValidDocx");
		expect(docxIds).not.toContain(FIXTURE_COMPANY_DOCX);

		const unresolvable = rowIds(report, "costsWithoutResolvableItem");
		expect(unresolvable).toContain(FIXTURE_COST_UNRESOLVABLE);
		expect(unresolvable).not.toContain(FIXTURE_COST_MULTI);
		expect(unresolvable).not.toContain(FIXTURE_COST_CLEAN);

		const multi = rowIds(report, "costsWithMultipleAllocations");
		expect(multi).toContain(FIXTURE_COST_MULTI);
		expect(multi).not.toContain(FIXTURE_COST_CLEAN);

		const divergent = rowIds(report, "costsWithDivergentAllocations");
		expect(divergent).toContain(FIXTURE_COST_DIVERGENT);
		expect(divergent).not.toContain(FIXTURE_COST_MULTI);
		expect(divergent).not.toContain(FIXTURE_COST_CLEAN);
		const divergentRow = rowsOf(report, "costsWithDivergentAllocations").find(
			(row) => row.actualCostId === FIXTURE_COST_DIVERGENT,
		);
		expect(divergentRow?.amount).toBe("100.0000");
		expect(divergentRow?.allocationsSum).toBe("95.0000");
		expect(divergentRow?.difference).toBe("5.0000");

		const orphan = rowIds(report, "orphanWorkMemberships");
		expect(orphan).toContain("preflight-membership-orphan");
		expect(orphan).not.toContain("preflight-membership-ok");

		const mismatches = rowsOf(report, "ownerMismatches");
		const costMismatch = mismatches.find(
			(row) => row.resourceId === FIXTURE_COST_OWNER_MISMATCH,
		);
		expect(costMismatch).toBeDefined();
		expect(costMismatch?.resourceType).toBe("ACTUAL_COST");
		expect(costMismatch?.resourceOwnerId).toBe(OWNER_B);
		expect(costMismatch?.workOwnerId).toBe(OWNER_A);

		const originRows = rowsOf(report, "originContractAnomalies");
		const quotationRows = originRows.filter(
			(row) =>
				row.originType === "QUOTATION" &&
				row.contractId === FIXTURE_CONTRACT_SHARED,
		);
		expect(quotationRows).toHaveLength(2);
		expect(quotationRows.map((row) => row.originCount)).toEqual(["2", "2"]);
		const sharedContract = originRows.find(
			(row) =>
				row.contractId === FIXTURE_CONTRACT_SHARED &&
				row.requestId !== undefined,
		);
		expect(sharedContract?.requestId).toBe(FIXTURE_REQUEST_SHARED);
		expect(sharedContract?.quotationIds).toBe(
			`${FIXTURE_QUOTATION_1},${FIXTURE_QUOTATION_2}`,
		);

		const instruments = rowIds(report, "instrumentsWithoutArtifact");
		expect(instruments).toContain(FIXTURE_CONTRACT_INSTRUMENT);
	});

	it("e determinista: duas execucoes geram o mesmo JSON ordenado", async () => {
		const first = await runAuditRemediationPreflight({ prisma });
		const second = await runAuditRemediationPreflight({ prisma });
		expect(serializeReportJson(first)).toBe(serializeReportJson(second));
	});

	it("nao escreve no banco", async () => {
		const countsBefore = {
			company: await prisma.company.count(),
			organization: await prisma.organization.count(),
			constructionActualCost: await prisma.constructionActualCost.count(),
			actualCostAllocation: await prisma.actualCostAllocation.count(),
			workMembership: await prisma.workMembership.count(),
			costCenterMembership: await prisma.costCenterMembership.count(),
			contract: await prisma.contract.count(),
			quotation: await prisma.quotation.count(),
			importBatch: await prisma.importBatch.count(),
			constructionWork: await prisma.constructionWork.count(),
		};
		await runAuditRemediationPreflight({ prisma });
		const countsAfter = {
			company: await prisma.company.count(),
			organization: await prisma.organization.count(),
			constructionActualCost: await prisma.constructionActualCost.count(),
			actualCostAllocation: await prisma.actualCostAllocation.count(),
			workMembership: await prisma.workMembership.count(),
			costCenterMembership: await prisma.costCenterMembership.count(),
			contract: await prisma.contract.count(),
			quotation: await prisma.quotation.count(),
			importBatch: await prisma.importBatch.count(),
			constructionWork: await prisma.constructionWork.count(),
		};
		expect(countsAfter).toEqual(countsBefore);
	});

	it("nao exporta blob, credencial, token ou email", async () => {
		const report = await runAuditRemediationPreflight({ prisma });
		const json = serializeReportJson(report);
		expect(json).not.toContain("contractTemplateBlob");
		expect(json).not.toContain("password");
		expect(json).not.toContain("token");
		expect(json).not.toContain("@");
	});

	it("serializa CSVs com BOM, cabecalhos estaveis e linhas acionaveis", async () => {
		const report = await runAuditRemediationPreflight({ prisma });
		const csvs = serializeReportCsvs(report);
		const orphanCsv = csvs.get("orphanWorkMemberships");
		expect(
			orphanCsv?.startsWith(
				"\uFEFFmembershipId;userId;workId;costCenterId\r\n",
			),
		).toBe(true);
		expect(orphanCsv).toContain("preflight-membership-orphan");
		expect(orphanCsv).not.toContain("preflight-membership-ok");
		const orgCsv = csvs.get("organizationsWithoutCompany");
		expect(orgCsv).toContain(FIXTURE_ORG);
	});

	it("reporta bloqueio quando ha linhas bloqueantes", async () => {
		const report = await runAuditRemediationPreflight({ prisma });
		expect(hasBlockingRows(report)).toBe(true);
		expect(report.summary.blockingRows).toBeGreaterThan(0);
		expect(report.summary.blockingSectionIds).toContain(
			"organizationsWithoutCompany",
		);
	});
});
