import { describe, expect, it, spyOn } from "bun:test";
import { inflateRawSync, inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRef, PDFStream } from "pdf-lib";
import type { ExecutionViewResponse } from "../../../../src/modules/construction-planning/bi/execution-view.service";
import * as managementRepo from "../../../../src/modules/construction-planning/management.repository";
import { generateWorkExecutionPdf } from "../../../../src/modules/construction-planning/pdf/execution-report";
import { pdfReportService } from "../../../../src/modules/construction-planning/statistics/pdf-report.service";
import * as orgRepo from "../../../../src/modules/organizations/repository";

const mockWorkReport = {
	work: { id: "w-1", name: "Obra Teste", code: "OB-001" },
	costCenter: { id: "cc-1", name: "CC Teste" },
	budget: {
		total: 100000,
		itemsCount: 10,
		byStatus: { active: 5, done: 3, notStarted: 2 },
	},
	measurements: { total: 50000, count: 3, percentage: 0.5 },
	costs: { total: 30000, balance: 70000 },
	evm: {
		plannedValue: 90000,
		earnedValue: 50000,
		actualCost: 30000,
		scheduleVariance: 10000,
		costVariance: 20000,
		schedulePerformanceIndex: 1.25,
		costPerformanceIndex: 1.375,
		currentBudgetBalance: 70000,
		projectedBudgetBalance: 60000,
	},
	qualityIssues: [],
};

const mockDashboard = {
	budgeted: 100000,
	spent: 30000,
	balance: 70000,
	executionPercentage: 30,
	costsByCategory: [],
	supplierBreakdown: [],
};

const mockSchedule = {
	stages: [],
	totals: {
		months: [],
		plannedByMonth: [],
		measuredByMonth: [],
		actualByMonth: [],
		plannedAccumulated: [],
		measuredAccumulated: [],
		actualAccumulated: [],
	},
};

const mockManagementContext = {
	report: mockWorkReport,
	dashboard: mockDashboard,
	schedule: mockSchedule,
	resolved: { mode: "LIVE" },
};

function decodeContent(stream: PDFStream): string {
	const raw = (stream as unknown as { contents: Uint8Array }).contents;
	try {
		return inflateSync(raw).toString("latin1");
	} catch {
		try {
			return inflateRawSync(raw).toString("latin1");
		} catch {
			return Buffer.from(raw).toString("latin1");
		}
	}
}

function decodeHexStrings(content: string): string {
	return content.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => {
		const bytes = new Uint8Array(hex.length / 2);
		for (let i = 0; i < bytes.length; i++) {
			bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
		}
		return new TextDecoder("windows-1252").decode(bytes);
	});
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
	const doc = await PDFDocument.load(bytes);
	let text = "";
	for (const page of doc.getPages()) {
		const contents = page.node.Contents();
		if (!contents) continue;
		const items =
			contents instanceof PDFArray ? contents.asArray() : [contents];
		for (const item of items) {
			const stream = item instanceof PDFRef ? doc.context.lookup(item) : item;
			if (!(stream instanceof PDFStream)) continue;
			text += decodeHexStrings(decodeContent(stream));
		}
	}
	return text;
}

const mockCCReport = {
	costCenter: { id: "cc-1", name: "CC Teste" },
	works: [
		{
			id: "w-1",
			name: "Obra 1",
			code: "OB-001",
			status: "EM_ANDAMENTO",
			budgeted: 50000,
			spent: 20000,
		},
	],
	summary: {
		totalWorks: 1,
		totalBudgeted: 50000,
		totalSpent: 20000,
		balance: 30000,
	},
};

const mockOrgReport = {
	organization: { id: "org-1", name: "Org Teste" },
	costCenters: [
		{ id: "cc-1", name: "CC Teste", works: 1, budgeted: 50000, spent: 20000 },
	],
	summary: {
		totalCostCenters: 1,
		totalWorks: 1,
		totalBudgeted: 50000,
		totalSpent: 20000,
		balance: 30000,
	},
};

describe("pdf report service", () => {
	it("gera pdf de obra", async () => {
		spyOn(managementRepo, "getWorkReport").mockResolvedValue(
			mockWorkReport as never,
		);

		const response = await pdfReportService.generateWorkPdf("owner-1", "w-1");

		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-obra-OB-001.pdf",
		);
	});

	it("gera pdf de centro de custo", async () => {
		spyOn(managementRepo, "getCostCenterReport").mockResolvedValue(
			mockCCReport as never,
		);

		const response = await pdfReportService.generateCostCenterPdf(
			"owner-1",
			"cc-1",
		);

		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-cc-CC Teste.pdf",
		);
	});

	it("gera pdf de organizacao", async () => {
		spyOn(orgRepo, "getOrganizationReport").mockResolvedValue(
			mockOrgReport as never,
		);

		const response = await pdfReportService.generateOrganizationPdf(
			"owner-1",
			"org-1",
		);

		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-org-Org Teste.pdf",
		);
	});

	it("lanca 404 quando obra nao encontrada", async () => {
		spyOn(managementRepo, "getWorkReport").mockResolvedValue(null as never);

		await expect(
			pdfReportService.generateWorkPdf("owner-1", "missing"),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("gera pdf de execucao com corte/fonte e metricas indisponiveis sem zero artificial", async () => {
		const view: ExecutionViewResponse = {
			work: { id: "w-1", code: "OB-001", name: "Obra Teste" },
			sourceMode: "LIVE",
			budgetVersionId: "bv-1",
			snapshotVersion: null,
			asOfDate: "2026-01-15",
			generatedAt: "2026-08-06T10:00:00.000Z",
			qualityIssues: [],
			financial: {
				grossMargin: {
					budgeted: null,
					realized: null,
					variance: null,
					completeness: "UNAVAILABLE",
				},
				grossProfit: {
					budgeted: null,
					realized: null,
					variance: null,
					completeness: "UNAVAILABLE",
				},
				billing: {
					budgeted: 1000,
					realized: 400,
					variance: 600,
					completeness: "COMPLETE",
				},
				costs: {
					budgeted: 1000,
					realized: 600,
					variance: 400,
					completeness: "COMPLETE",
				},
				issues: [
					{
						code: "PENDING_DEFINITION",
						message:
							'Formula "Margem bruta" aguardando decisao de metrica macro (DEC-MET).',
					},
				],
			},
			contracts: [
				{
					contractId: "ct-1",
					code: "CT-001",
					supplierName: "Fornecedor A",
					contractValue: 5000,
					amendmentNet: 500,
					status: "EM_ANDAMENTO",
					linkedBudgetItems: [],
					financial: {
						grossMargin: {
							budgeted: null,
							realized: null,
							variance: null,
							completeness: "UNAVAILABLE",
						},
						grossProfit: {
							budgeted: null,
							realized: null,
							variance: null,
							completeness: "UNAVAILABLE",
						},
						billing: {
							budgeted: null,
							realized: null,
							variance: null,
							completeness: "UNAVAILABLE",
						},
						costs: {
							budgeted: null,
							realized: null,
							variance: null,
							completeness: "UNAVAILABLE",
						},
						issues: [],
					},
				},
			],
			schedule: {
				baselineVersionId: null,
				baselineLabel: null,
				revisionCount: 0,
				latestRevisionDate: null,
				revisedEndAt: null,
				maxDeltaDays: null,
				items: 1,
				deviations: [
					{
						id: "dev-1",
						workId: "w-1",
						budgetItemId: "bi-1",
						scheduleItemId: "si-1",
						index: "1.1",
						description: "Fundacoes",
						plannedStart: "2026-01-01",
						plannedEnd: "2026-01-31",
						realizedStart: null,
						realizedEnd: null,
						varianceDays: 5,
						status: "DELAYED",
						cause: null,
						action: null,
						responsibleId: null,
						dueDate: null,
						evidence: null,
					},
				],
			},
		};

		const response = await generateWorkExecutionPdf(
			"owner-1",
			"w-1",
			undefined,
			async () => view,
		);

		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-execucao-OB-001.pdf",
		);

		const text = await extractPdfText(
			new Uint8Array(await response.arrayBuffer()),
		);
		expect(text).toContain("2026-01-15");
		expect(text).toContain("LIVE");
		expect(text).toContain("Indisponivel");
		expect(text).toContain("CT-001");
		expect(text).toContain("1.1");
		expect(text).not.toContain("R$ 0,00");
	});

	it("gera pdf gerencial com indicadores IDC/IDP reais", async () => {
		spyOn(managementRepo, "getWorkManagementReportContext").mockResolvedValue(
			mockManagementContext as never,
		);

		const response = await pdfReportService.generateWorkManagementPdf(
			"owner-1",
			"w-1",
		);

		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-gerencial-OB-001.pdf",
		);

		const text = await extractPdfText(
			new Uint8Array(await response.arrayBuffer()),
		);
		expect(text).toContain("1,25 Tj");
		expect(text).toContain("1,375 Tj");
		expect(text).not.toContain("—");
	});

	it("gera pdf gerencial com indicadores indisponiveis como em dash", async () => {
		spyOn(managementRepo, "getWorkManagementReportContext").mockResolvedValue({
			...mockManagementContext,
			report: {
				...mockWorkReport,
				evm: {
					...mockWorkReport.evm,
					schedulePerformanceIndex: null,
					costPerformanceIndex: null,
				},
			},
		} as never);

		const response = await pdfReportService.generateWorkManagementPdf(
			"owner-1",
			"w-1",
		);

		const text = await extractPdfText(
			new Uint8Array(await response.arrayBuffer()),
		);
		expect(text).not.toContain("1,25 Tj");
		expect(text).not.toContain("1,375 Tj");
		expect(text.match(/—/g)?.length ?? 0).toBe(2);
	});

	it("lanca 404 quando obra nao encontrada no pdf gerencial", async () => {
		spyOn(managementRepo, "getWorkManagementReportContext").mockResolvedValue(
			null as never,
		);

		await expect(
			pdfReportService.generateWorkManagementPdf("owner-1", "missing"),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("lanca 404 quando centro de custo nao encontrado", async () => {
		spyOn(managementRepo, "getCostCenterReport").mockResolvedValue(
			null as never,
		);

		await expect(
			pdfReportService.generateCostCenterPdf("owner-1", "missing"),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("lanca 404 quando organizacao nao encontrada", async () => {
		spyOn(orgRepo, "getOrganizationReport").mockResolvedValue(null as never);

		await expect(
			pdfReportService.generateOrganizationPdf("owner-1", "missing"),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("REL-002: PDF de contrato e relatorio gerencial, nao instrumento", async () => {
		spyOn(managementRepo, "getContractReport").mockResolvedValue({
			contract: {
				title: "Contrato de Fundacao",
				code: "CT-001",
				supplierName: "Fornecedor A",
			},
			value: {
				contract: 10000,
				services: 10000,
				measured: 2000,
				paid: 1500,
				balance: 8000,
				amendment: 0,
			},
			penalty: { percent: 20, value: 2000 },
			measurementsCount: 1,
			paymentsCount: 1,
			summary: [],
		} as never);

		const response = await pdfReportService.generateContractReportPdf(
			"owner-1",
			"ct-1",
		);

		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-contrato-Contrato de Fundacao.pdf",
		);

		const text = await extractPdfText(
			new Uint8Array(await response.arrayBuffer()),
		);
		expect(text).toContain("Relatório Gerencial");
		expect(text).toContain("CT-001");
		expect(text).not.toContain("Cláusula");
	});

	it("CON-005 (DEC-001): PDF de contrato exibe multa de 20% sobre a empreitada", async () => {
		spyOn(managementRepo, "getContractReport").mockResolvedValue({
			contract: {
				title: "Contrato Penalidade",
				code: "CT-PEN",
				supplierName: "Fornecedor A",
				contractValue: 10000,
			},
			value: {
				contract: 10000,
				services: 10000,
				measured: 2000,
				paid: 1500,
				balance: 8000,
				amendment: 0,
			},
			penalty: { percent: 20, value: 2000 },
			measurementsCount: 1,
			paymentsCount: 1,
			summary: [],
		} as never);

		const response = await pdfReportService.generateContractReportPdf(
			"owner-1",
			"ct-pen",
		);

		const text = await extractPdfText(
			new Uint8Array(await response.arrayBuffer()),
		);
		// 20% de 10000 = 2000 (secao 14.3).
		expect(text).toContain("Multa contratual");
		expect(text).toContain("20%");
		expect(text).toContain("2.000,00");
	});
});
