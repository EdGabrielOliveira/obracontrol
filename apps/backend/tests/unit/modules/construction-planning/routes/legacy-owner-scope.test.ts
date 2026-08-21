import { beforeEach, describe, expect, it, mock } from "bun:test";

const getSessionUser = mock(async () => ({
	id: "granted-1",
	role: "GERENTE",
}));

const workGet = mock(async (_ownerId: string, _workId: string) => ({
	id: "work-1",
	ownerId: _ownerId,
	code: "OBRA-001",
}));
const budgetGet = mock(async (_ownerId: string, _workId: string) => ({
	items: [],
	workId: _workId,
}));
const biGetWork = mock(
	async (_ownerId: string, _workId: string, _asOf?: Date) => ({
		workId: _workId,
		indicators: {},
	}),
);
const reportGet = mock(async (_ownerId: string, _workId: string) => ({
	work: { id: _workId },
}));
const contractReportGet = mock(
	async (_ownerId: string, _contractId: string) => ({
		contract: { id: _contractId },
	}),
);
const ccReportGet = mock(async (_ownerId: string, _ccId: string) => ({
	costCenter: { id: _ccId },
}));
const listActualCosts = mock(async (_ownerId: string, _workId: string) => ({
	data: [],
	total: 0,
	page: 1,
	limit: 10,
}));
const getActualCost = mock(
	async (_ownerId: string, _workId: string, _costId: string) => ({
		id: _costId,
		ownerId: _ownerId,
	}),
);

let orgMemberships: { organizationId: string }[];
let ccMemberships: { costCenterId: string }[];

mock.module("../../../../../src/lib/auth-middleware", () => ({
	getSessionUser,
}));

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mock(async () => ({ role: "GERENTE", banned: false })),
		},
		constructionWork: {
			findUnique: mock(async () => ({
				id: "work-1",
				costCenterId: "cc-1",
			})),
		},
		costCenter: {
			findUnique: mock(async () => ({
				id: "cc-1",
				organizationId: "org-1",
			})),
		},
		organization: {
			findUnique: mock(async () => ({
				id: "org-1",
				ownerId: "owner-1",
			})),
		},
		contract: {
			findUnique: mock(async () => ({
				id: "contract-1",
				workId: "work-1",
			})),
		},
		costCenterMembership: {
			findMany: mock(async () => ccMemberships),
		},
		workMembership: {
			findMany: mock(async () => []),
		},
		organizationMembership: {
			findMany: mock(async () => orgMemberships),
		},
	},
}));

mock.module(
	"../../../../../src/modules/construction-planning/works/work-service",
	() => ({
		constructionWorkService: {
			get: workGet,
			list: mock(async () => ({ data: [] })),
			create: mock(async () => ({ id: "work-created" })),
			update: mock(async () => ({ id: "work-1" })),
			delete: mock(async () => ({ id: "work-1" })),
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/budget.service",
	() => ({
		budgetService: {
			getBudget: budgetGet,
			getBudgetItem: mock(async () => null),
			createItem: mock(async () => ({ id: "item-1" })),
			updateItem: mock(async () => ({ id: "item-1" })),
			deleteItem: mock(async () => ({ id: "item-1" })),
			reorderItems: mock(async () => ({})),
			updateBdi: mock(async () => ({})),
			importBudget: mock(async () => ({})),
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/bi/bi-service",
	() => ({
		ConstructionBIService: class {
			async getWorkBI(ownerId: string, workId: string, asOf?: Date) {
				return biGetWork(ownerId, workId, asOf);
			}
			async getCompareBI(_ownerId: string) {
				return {};
			}
			async getMultiworksBI(_ownerId: string) {
				return {};
			}
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/management.service",
	() => ({
		managementService: {
			getWorkReport: reportGet,
			getContractReport: contractReportGet,
			getCostCenterReport: ccReportGet,
			receiveWorkPhotoPdf: mock(async () => ({})),
		},
	}),
);

const contractReportPdf = mock(async () => {
	const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
	return new Response(bytes, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition":
				'attachment; filename="relatorio-contrato-CT-001.pdf"',
		},
	});
});

mock.module(
	"../../../../../src/modules/construction-planning/statistics/pdf-report.service",
	() => ({
		pdfReportService: {
			generateWorkPdf: mock(async () => new Response(null)),
			generateWorkManagementPdf: mock(async () => new Response(null)),
			generateWorkExecutionPdf: mock(async () => new Response(null)),
			generateCostCenterPdf: mock(async () => new Response(null)),
			generateContractReportPdf: contractReportPdf,
			generateWorkMeasurementPdf: mock(async () => new Response(null)),
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/entries/manual-entry-service",
	() => ({
		constructionManualEntryService: {
			listMeasurements: mock(async () => ({
				data: [],
				total: 0,
				page: 1,
				limit: 10,
			})),
			listActualCosts,
			getActualCost,
			createActualCost: mock(
				async (_ownerId: string, _workId: string, input: unknown) => ({
					id: "cost-1",
					...((input as Record<string, unknown>) ?? {}),
				}),
			),
			updateActualCost: mock(
				async (
					_ownerId: string,
					_workId: string,
					_id: string,
					input: unknown,
				) => ({
					id: _id,
					...((input as Record<string, unknown>) ?? {}),
				}),
			),
			deleteActualCost: mock(async () => ({ id: "cost-1" })),
		},
	}),
);

beforeEach(() => {
	mock.clearAllMocks();
	orgMemberships = [];
	ccMemberships = [];
	getSessionUser.mockResolvedValue({ id: "granted-1", role: "GERENTE" });
	workGet.mockResolvedValue({
		id: "work-1",
		ownerId: "owner-1",
		code: "OBRA-001",
	});
	budgetGet.mockResolvedValue({ items: [], workId: "work-1" });
	biGetWork.mockResolvedValue({ workId: "work-1", indicators: {} });
	reportGet.mockResolvedValue({ work: { id: "work-1" } });
	contractReportGet.mockResolvedValue({ contract: { id: "contract-1" } });
	ccReportGet.mockResolvedValue({ costCenter: { id: "cc-1" } });
	listActualCosts.mockResolvedValue({
		data: [],
		total: 0,
		page: 1,
		limit: 10,
	});
	getActualCost.mockResolvedValue({ id: "cost-1", ownerId: "owner-1" });
});

describe("ARQ-003 rotas resolvem owner scope pelo modelo de memberships", () => {
	it("GERENTE com membership ativa de organizacao resolve o owner da obra", async () => {
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		orgMemberships = [{ organizationId: "org-1" }];
		const { workRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/work.routes"
		);

		const response = await workRoutes.handle(
			new Request("http://localhost/works/work-1"),
		);

		expect(response.status).toBe(200);
		expect(workGet).toHaveBeenCalledWith("owner-1", "work-1");
	});

	it("GESTOR com membership do centro acessa a obra do centro", async () => {
		getSessionUser.mockResolvedValue({ id: "gestor-1", role: "GESTOR" });
		orgMemberships = [{ organizationId: "org-1" }];
		ccMemberships = [{ costCenterId: "cc-1" }];
		const { workRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/work.routes"
		);

		const response = await workRoutes.handle(
			new Request("http://localhost/works/work-1"),
		);

		expect(response.status).toBe(200);
		expect(workGet).toHaveBeenCalledWith("owner-1", "work-1");
		expect(workGet).not.toHaveBeenCalledWith("gestor-1", "work-1");
	});

	it("work GET /:workId retorna 404 sem escopo e nao chama o service", async () => {
		const { workRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/work.routes"
		);

		const response = await workRoutes.handle(
			new Request("http://localhost/works/work-1"),
		);

		expect(response.status).toBe(404);
		expect(workGet).not.toHaveBeenCalled();
	});

	it("budget GET / usa resourceOwnerId com membership de organizacao", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { budgetRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/budget.routes"
		);

		const response = await budgetRoutes.handle(
			new Request("http://localhost/works/work-1/budget"),
		);

		expect(response.status).toBe(200);
		expect(budgetGet).toHaveBeenCalledWith("owner-1", "work-1");
		expect(budgetGet).not.toHaveBeenCalledWith("granted-1", "work-1");
	});

	it("budget GET / retorna 404 sem escopo", async () => {
		const { budgetRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/budget.routes"
		);

		const response = await budgetRoutes.handle(
			new Request("http://localhost/works/work-1/budget"),
		);

		expect(response.status).toBe(404);
		expect(budgetGet).not.toHaveBeenCalled();
	});

	it("bi GET /works/:workId/overview usa resourceOwnerId com membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { biRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/bi.routes"
		);

		const response = await biRoutes.handle(
			new Request("http://localhost/works/work-1/overview"),
		);

		expect(response.status).toBe(200);
		expect(biGetWork).toHaveBeenCalledWith("owner-1", "work-1", undefined);
		expect(biGetWork).not.toHaveBeenCalledWith(
			"granted-1",
			"work-1",
			undefined,
		);
	});

	it("bi GET /works/:workId/overview retorna 404 sem escopo", async () => {
		const { biRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/bi.routes"
		);

		const response = await biRoutes.handle(
			new Request("http://localhost/works/work-1/overview"),
		);

		expect(response.status).toBe(404);
		expect(biGetWork).not.toHaveBeenCalled();
	});

	it("reports GET /reports/work/:workId usa resourceOwnerId com membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/work/work-1"),
		);

		expect(response.status).toBe(200);
		expect(reportGet).toHaveBeenCalledWith("owner-1", "work-1", undefined);
		expect(reportGet).not.toHaveBeenCalledWith(
			"granted-1",
			"work-1",
			undefined,
		);
	});

	it("reports GET /reports/work/:workId retorna 404 sem escopo", async () => {
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/work/work-1"),
		);

		expect(response.status).toBe(404);
		expect(reportGet).not.toHaveBeenCalled();
	});

	it("reports GET /reports/contract/:contractId usa resourceOwnerId com membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/contract/contract-1"),
		);

		expect(response.status).toBe(200);
		expect(contractReportGet).toHaveBeenCalledWith("owner-1", "contract-1");
		expect(contractReportGet).not.toHaveBeenCalledWith(
			"granted-1",
			"contract-1",
		);
	});

	it("reports GET /reports/contract/:contractId retorna 404 sem escopo", async () => {
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/contract/contract-1"),
		);

		expect(response.status).toBe(404);
		expect(contractReportGet).not.toHaveBeenCalled();
	});

	it("reports GET /reports/cost-center/:ccId usa resourceOwnerId com membership de centro", async () => {
		getSessionUser.mockResolvedValue({ id: "gestor-1", role: "GESTOR" });
		orgMemberships = [{ organizationId: "org-1" }];
		ccMemberships = [{ costCenterId: "cc-1" }];
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/cost-center/cc-1"),
		);

		expect(response.status).toBe(200);
		expect(ccReportGet).toHaveBeenCalledWith("owner-1", "cc-1");
		expect(ccReportGet).not.toHaveBeenCalledWith("gestor-1", "cc-1");
	});

	it("reports GET /reports/cost-center/:ccId retorna 404 sem escopo", async () => {
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/cost-center/cc-1"),
		);

		expect(response.status).toBe(404);
		expect(ccReportGet).not.toHaveBeenCalled();
	});
});

describe("CUS-004 rotas de custo resolvem owner scope", () => {
	it("actual-costs GET lista com resourceOwnerId quando ha membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { workRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/work.routes"
		);

		const response = await workRoutes.handle(
			new Request("http://localhost/works/work-1/actual-costs"),
		);

		expect(response.status).toBe(200);
		expect(listActualCosts).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.anything(),
		);
		expect(listActualCosts).not.toHaveBeenCalledWith(
			"granted-1",
			"work-1",
			expect.anything(),
		);
	});

	it("actual-costs GET lista retorna 404 sem escopo e nao chama o service", async () => {
		const { workRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/work.routes"
		);

		const response = await workRoutes.handle(
			new Request("http://localhost/works/work-1/actual-costs"),
		);

		expect(response.status).toBe(404);
		expect(listActualCosts).not.toHaveBeenCalled();
	});

	it("actual-costs GET detalhe usa resourceOwnerId com membership e 404 sem escopo", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { workRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/work.routes"
		);

		const okResponse = await workRoutes.handle(
			new Request("http://localhost/works/work-1/actual-costs/cost-1"),
		);
		expect(okResponse.status).toBe(200);
		expect(getActualCost).toHaveBeenCalledWith("owner-1", "work-1", "cost-1");
		expect(getActualCost).not.toHaveBeenCalledWith(
			"granted-1",
			"work-1",
			"cost-1",
		);

		orgMemberships = [];
		mock.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "granted-1", role: "GERENTE" });
		const noScopeResponse = await workRoutes.handle(
			new Request("http://localhost/works/work-1/actual-costs/cost-1"),
		);
		expect(noScopeResponse.status).toBe(404);
		expect(getActualCost).not.toHaveBeenCalled();
	});
});

describe("REL-001 download de PDF de contrato e headers", () => {
	it("PDF autorizado retorna bytes, content-type e content-disposition", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/contract/contract-1/pdf"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toContain("attachment");
		expect(response.headers.get("content-disposition")).toContain(
			"relatorio-contrato-CT-001.pdf",
		);
		expect(await response.arrayBuffer()).not.toHaveLength(0);
		expect(contractReportPdf).toHaveBeenCalledWith("owner-1", "contract-1");
		expect(contractReportPdf).not.toHaveBeenCalledWith(
			"granted-1",
			"contract-1",
		);
	});

	it("PDF sem escopo retorna 404 e nao chama o gerador", async () => {
		const { reportsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/reports.routes"
		);

		const response = await reportsRoutes.handle(
			new Request("http://localhost/reports/contract/contract-1/pdf"),
		);

		expect(response.status).toBe(404);
		expect(contractReportPdf).not.toHaveBeenCalled();
	});
});
