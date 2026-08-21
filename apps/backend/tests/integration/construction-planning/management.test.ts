import { describe, expect, it, mock } from "bun:test";
import { assertJsonResponse, TEST_OWNER, TEST_WORK_ID } from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: mock(async () => ({ id: "audit-1" })) },
		user: {
			findUnique: mock(async () => ({ id: TEST_OWNER, role: "GERENTE" })),
		},
		constructionWork: {
			findUnique: mock(async () => ({
				id: TEST_WORK_ID,
				costCenterId: "e2e-cc-test",
			})),
		},
		costCenter: {
			findUnique: mock(async () => ({
				id: "e2e-cc-test",
				organizationId: "org-1",
			})),
		},
		organization: {
			findUnique: mock(async () => ({
				id: "org-1",
				ownerId: TEST_OWNER,
			})),
		},
		organizationMembership: {
			findMany: mock(async () => [{ organizationId: "org-1" }]),
		},
		costCenterMembership: {
			findMany: mock(async () => [{ costCenterId: "e2e-cc-test" }]),
		},
		workMembership: {
			findMany: mock(async () => []),
		},
		contract: {
			findUnique: mock(async ({ where }: { where: { id: string } }) =>
				where.id === "e2e-contract-1"
					? { id: "e2e-contract-1", workId: TEST_WORK_ID }
					: null,
			),
		},
	},
}));

const getContractReport = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		contract: {
			id: "e2e-contract-1",
			code: "CT-001",
			supplierName: "Fornecedor",
			title: "Contrato",
			status: "EM_ANDAMENTO",
		},
		value: {
			contract: 100000,
			services: 95000,
			measured: 25000,
			percentage: 0.25,
			paid: 25000,
			balance: 75000,
		},
		penalty: { percent: 20, value: 20000 },
		measurementsCount: 2,
		paymentsCount: 1,
	}),
);

mock.module(
	"../../../src/modules/construction-planning/management.repository",
	() => ({
		getWorkManagementDashboard: mock(async () => ({
			budgeted: 50000,
			spent: 12500,
			balance: 37500,
			executionPercentage: 25,
			costsByCategory: [
				{ category: "MATERIAL", amount: 7500, percentage: 0.6 },
			],
			supplierBreakdown: [
				{
					supplierName: "Fornecedor A",
					totalAmount: 7500,
					paidAmount: 5000,
					openAmount: 2500,
				},
			],
			sourceMode: "LIVE",
			snapshot: null,
		})),
		getPhysicalFinancialSchedule: mock(async () => ({
			stages: [],
			totals: {
				months: [],
				plannedByMonth: [],
				measuredByMonth: [],
				plannedAccumulated: [],
				measuredAccumulated: [],
			},
		})),
		getWorkReport: mock(async () => ({
			work: { id: TEST_WORK_ID, name: "Obra E2E", code: "E2E-001" },
			costCenter: { id: "cc-1", name: "CC Teste" },
			budget: {
				total: 50000,
				itemsCount: 5,
				byStatus: { active: 3, done: 1, notStarted: 1 },
			},
			measurements: { total: 12500, count: 2, percentage: 0.25 },
			costs: { total: 10000, balance: 40000 },
			evm: {
				plannedValue: 40000,
				earnedValue: 12500,
				actualCost: 10000,
				scheduleVariance: -5000,
				costVariance: 2500,
				schedulePerformanceIndex: 0.9,
				costPerformanceIndex: 1.25,
				currentBudgetBalance: 40000,
				projectedBudgetBalance: 35000,
			},
			qualityIssues: [],
			sourceMode: "LIVE",
			snapshot: null,
		})),
		getWorkManagementReportContext: mock(async () => ({
			resolved: { mode: "LIVE" },
			report: {
				work: { id: TEST_WORK_ID, name: "Obra E2E", code: "E2E-001" },
				costCenter: { id: "cc-1", name: "CC Teste" },
				budget: {
					total: 50000,
					itemsCount: 5,
					byStatus: { active: 3, done: 1, notStarted: 1 },
				},
				measurements: { total: 12500, count: 2, percentage: 0.25 },
				costs: { total: 10000, balance: 40000 },
				evm: {
					plannedValue: 40000,
					earnedValue: 12500,
					actualCost: 10000,
					scheduleVariance: -5000,
					costVariance: 2500,
					schedulePerformanceIndex: 0.9,
					costPerformanceIndex: 1.25,
					currentBudgetBalance: 40000,
					projectedBudgetBalance: 35000,
				},
				qualityIssues: [],
				sourceMode: "LIVE",
				snapshot: null,
			},
			dashboard: {
				budgeted: 50000,
				spent: 12500,
				balance: 37500,
				executionPercentage: 25,
				costsByCategory: [
					{ category: "MATERIAL", amount: 7500, percentage: 0.6 },
				],
				supplierBreakdown: [
					{
						supplierName: "Fornecedor A",
						totalAmount: 7500,
						paidAmount: 5000,
						openAmount: 2500,
					},
				],
				sourceMode: "LIVE",
				snapshot: null,
			},
			schedule: {
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
			},
		})),
		getContractReport,
		getCostCenterReport: mock(async () => ({
			costCenter: { id: "e2e-cc-test", name: "CC Teste" },
			works: [
				{
					id: TEST_WORK_ID,
					name: "Obra E2E",
					code: "E2E-001",
					status: "IN_PROGRESS",
					budgeted: 50000,
					spent: 10000,
				},
			],
			summary: {
				totalWorks: 1,
				totalBudgeted: 50000,
				totalSpent: 10000,
				balance: 40000,
			},
		})),
	}),
);

mock.module(
	"../../../src/modules/construction-planning/works/works.repository",
	() => ({
		createWorkManual: mock(async () => ({ id: TEST_WORK_ID })),
		deleteWork: mock(async () => null),
		deleteWorkCascade: mock(async () => null),
		findWorkByOwnerAndCode: mock(async () => null),
		getAllWorksWithItems: mock(async () => []),
		getWorkById: mock(async () => ({ id: TEST_WORK_ID, ownerId: TEST_OWNER })),
		getWorkOrThrow: mock(async () => ({
			id: TEST_WORK_ID,
			ownerId: TEST_OWNER,
		})),
		getWorkWithItems: mock(async () => null),
		getWorksByCostCenter: mock(async () => []),
		getWorksByOrganization: mock(async () => []),
		listWorks: mock(async () => ({ data: [], total: 0, page: 1, limit: 10 })),
		updateWork: mock(async () => null),
	}),
);

describe("Management & Reports E2E", () => {
	it("GET /construction/works/:workId/management - dashboard gestao", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/management`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("budgeted");
		expect(body).toHaveProperty("costsByCategory");
		expect(body.sourceMode).toBe("LIVE");
		expect(body.snapshot).toBeNull();
	});

	it("GET /construction/works/:workId/schedule/physical-financial - cronograma FF", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/schedule/physical-financial`,
			),
		);

		assertJsonResponse(response, 200);
	});

	it("GET schedule/physical-financial - aceita period weekly", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/schedule/physical-financial?period=weekly`,
			),
		);

		assertJsonResponse(response, 200);
	});

	it("GET schedule/physical-financial - rejeita period invalido", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/schedule/physical-financial?period=yearly`,
			),
		);

		assertJsonResponse(response, 400);
	});

	it("GET schedule/physical-financial - aceita asOfDate valida e rejeita data futura com 422", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/schedule/physical-financial?asOfDate=2026-01-15`,
			),
		);

		assertJsonResponse(response, 200);

		const future = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/schedule/physical-financial?asOfDate=2099-01-01`,
			),
		);

		expect(future.status).toBe(422);
		expect((await future.json()).message).toBe(
			"Data de corte futura nao permitida",
		);
	});

	it("GET management - aceita asOfDate valida e rejeita data futura com 422", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/management?asOfDate=2026-01-15`,
			),
		);

		assertJsonResponse(response, 200);

		const future = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/management?asOfDate=2099-01-01`,
			),
		);

		expect(future.status).toBe(422);
		expect((await future.json()).message).toBe(
			"Data de corte futura nao permitida",
		);
	});

	it("GET reports/work - rejeita asOfDate com formato invalido com 400", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/work/${TEST_WORK_ID}?asOfDate=2026-01-99`,
			),
		);

		expect(response.status).toBe(400);
	});

	it("GET reports PDFs - aceita asOfDate valida", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const workPdf = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/work/${TEST_WORK_ID}/pdf?asOfDate=2026-01-15`,
			),
		);
		expect(workPdf.status).toBe(200);
		expect(workPdf.headers.get("content-type")).toContain("application/pdf");

		const managementPdf = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/work/${TEST_WORK_ID}/management/pdf?asOfDate=2026-01-15`,
			),
		);
		expect(managementPdf.status).toBe(200);
		expect(managementPdf.headers.get("content-type")).toContain(
			"application/pdf",
		);
	});

	it("GET /construction/reports/work/:workId - relatorio obra", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(`http://localhost/construction/reports/work/${TEST_WORK_ID}`),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("budget");
		expect(body.evm).toMatchObject({
			earnedValue: 12500,
			actualCost: 10000,
			schedulePerformanceIndex: 0.9,
			costPerformanceIndex: 1.25,
		});
		expect(body.qualityIssues).toEqual([]);
		expect(body.sourceMode).toBe("LIVE");
		expect(body.snapshot).toBeNull();
	});

	it("GET /construction/reports/contract/:contractId - relatorio contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/contract/e2e-contract-1`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("value");
	});

	it("GET /construction/reports/contract/:contractId/pdf - baixa PDF do contrato", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/contract/e2e-contract-1/pdf`,
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/pdf");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-contrato-",
		);
		const blob = await response.blob();
		expect(blob.size).toBeGreaterThan(0);
	});

	it("GET /construction/reports/contract/:contractId/pdf - contrato inexistente -> 404", async () => {
		getContractReport.mockImplementationOnce(async () => null);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/contract/e2e-contract-missing/pdf`,
			),
		);

		expect(response.status).toBe(404);
	});

	it("GET /construction/reports/cost-center/:ccId - relatorio CC", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/cost-center/e2e-cc-test`,
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toHaveProperty("summary");
	});

	it("POST /construction/reports/photo-pdf/:workId - upload PDF com fotos", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File([new Uint8Array([37, 80, 68, 70])], "fotos.pdf", {
				type: "application/pdf",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/reports/photo-pdf/${TEST_WORK_ID}`,
				{ method: "POST", body: form },
			),
		);

		assertJsonResponse(response, 201);
		expect(await response.json()).toEqual({
			workId: TEST_WORK_ID,
			fileName: "fotos.pdf",
			size: 4,
			contentType: "application/pdf",
			status: "RECEIVED",
		});
	});

	it("requer autenticacao nos endpoints de gestao", async () => {
		getSessionUser.mockImplementation(async () => {
			throw new (await import("../../../src/lib/errors")).ConstructionError(
				"UNAUTHORIZED",
				"Login obrigatorio",
				401,
			);
		});

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				`http://localhost/construction/works/${TEST_WORK_ID}/management`,
			),
		);

		expect(response.status).toBe(401);
	});
});
