import { beforeEach, describe, expect, it, mock } from "bun:test";

const getSessionUser = mock(async () => ({
	id: "granted-1",
	role: "GERENTE",
}));

const exportOrcamento = mock(async () => ({ ok: true }));
const exportCronograma = mock(async () => ({ ok: true }));
const exportMedicoes = mock(async () => ({ ok: true }));
const exportCustos = mock(async () => ({ ok: true }));
const exportContratos = mock(async () => ({ ok: true }));
const exportCompleto = mock(async () => ({ ok: true }));

const getDashboard = mock(async () => ({ ok: true }));
const getPhysicalFinancialSchedule = mock(async () => ({ ok: true }));

const coverageList = mock(async () => []);
const coverageLink = mock(async () => ({ id: "coverage-1" }));
const coverageUnlink = mock(async () => undefined);

const reconciliationListPending = mock(async () => []);
const reconciliationSuggest = mock(async () => []);
const reconciliationConfirm = mock(async () => ({ ok: true }));
const reconciliationReject = mock(async () => ({ ok: true }));

const analyticsList = mock(async () => ({ items: [] }));

const batchCreate = mock(async () => ({ batchId: "batch-1" }));
const batchPreview = mock(async () => ({ rows: [] }));
const batchSelectableRows = mock(async () => []);
const batchConfirm = mock(async () => ({ status: "APPROVED" }));
const batchList = mock(async () => ({ data: [], total: 0 }));
const batchExportRejected = mock(async () => new Uint8Array(0));

mock.module("../../../../../src/lib/auth-middleware", () => ({
	getSessionUser,
}));

let orgMemberships: { organizationId: string }[];
let ccMemberships: { costCenterId: string }[];

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
	"../../../../../src/modules/construction-planning/export.service",
	() => ({
		xlsxResponse: (bytes: Uint8Array<ArrayBufferLike>, filename: string) =>
			new Response(bytes as unknown as BodyInit, {
				headers: {
					"content-type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"content-disposition": `attachment; filename="${filename}"`,
				},
			}),
		exportService: {
			exportOrcamento,
			exportCronograma,
			exportMedicoes,
			exportCustos,
			exportContratos,
			exportCompleto,
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/management.service",
	() => ({
		managementService: {
			getDashboard,
			getPhysicalFinancialSchedule,
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/measurement-coverage.service",
	() => ({
		measurementCoverageService: {
			list: coverageList,
			link: coverageLink,
			unlink: coverageUnlink,
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/budget-reconciliation.service",
	() => ({
		budgetReconciliationService: {
			listPending: reconciliationListPending,
			suggestMatches: reconciliationSuggest,
			confirm: reconciliationConfirm,
			reject: reconciliationReject,
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/suppliers/supplier-analytics.service",
	() => ({
		supplierAnalyticsService: {
			list: analyticsList,
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/imports/import-batch.service",
	() => ({
		constructionImportBatchService: {
			createBatch: batchCreate,
			getPreviewPage: batchPreview,
			listSelectableRowIds: batchSelectableRows,
			confirmImport: batchConfirm,
			listBatches: batchList,
			exportRejectedSheet: batchExportRejected,
		},
	}),
);

beforeEach(() => {
	mock.clearAllMocks();
	orgMemberships = [];
	ccMemberships = [];
	getSessionUser.mockResolvedValue({ id: "granted-1", role: "GERENTE" });
});

async function handle(
	plugin: { handle: (r: Request) => Promise<Response> },
	path: string,
	init?: RequestInit,
) {
	return plugin.handle(new Request(`http://localhost${path}`, init));
}

describe("SEC-001 rotas legadas sem requireWorkAccess agora retornam 404 e nao chamam service", () => {
	it("export GET /works/:workId/export/* retorna 404 sem escopo e nao chama o service", async () => {
		const { exportRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/export.routes"
		);

		const matrix: Array<[string, typeof exportOrcamento]> = [
			["/works/work-1/export/orcamento", exportOrcamento],
			["/works/work-1/export/cronograma", exportCronograma],
			["/works/work-1/export/medicoes", exportMedicoes],
			["/works/work-1/export/custos", exportCustos],
			["/works/work-1/export/contratos", exportContratos],
			["/works/work-1/export/completo", exportCompleto],
		];

		for (const [path, serviceMock] of matrix) {
			const response = await handle(exportRoutes, path);
			expect(response.status).toBe(404);
			expect(serviceMock).not.toHaveBeenCalled();
		}
	});

	it("export GET usa resourceOwnerId quando ha membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		const { exportRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/export.routes"
		);

		const response = await handle(
			exportRoutes,
			"/works/work-1/export/orcamento",
		);

		expect(response.status).toBe(200);
		expect(exportOrcamento).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				actor: expect.objectContaining({ id: "owner-1" }),
			}),
		);
	});

	it("management GET retorna 404 sem escopo e usa resourceOwnerId com membership", async () => {
		const { managementRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/management.routes"
		);

		const denied = await handle(managementRoutes, "/works/work-1/management");
		expect(denied.status).toBe(404);
		expect(getDashboard).not.toHaveBeenCalled();

		const deniedPfs = await handle(
			managementRoutes,
			"/works/work-1/schedule/physical-financial",
		);
		expect(deniedPfs.status).toBe(404);
		expect(getPhysicalFinancialSchedule).not.toHaveBeenCalled();

		orgMemberships = [{ organizationId: "org-1" }];
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });

		const ok = await handle(managementRoutes, "/works/work-1/management");
		expect(ok.status).toBe(200);
		expect(getDashboard).toHaveBeenCalledWith("owner-1", "work-1", undefined);

		const okPfs = await handle(
			managementRoutes,
			"/works/work-1/schedule/physical-financial",
		);
		expect(okPfs.status).toBe(200);
		expect(getPhysicalFinancialSchedule).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			undefined,
			undefined,
		);
	});

	it("measurement-coverages GET/POST/DELETE retornam 404 sem escopo e nao chamam service", async () => {
		const { measurementCoverageRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/measurement-coverage.routes"
		);

		const list = await handle(
			measurementCoverageRoutes,
			"/works/work-1/measurement-coverages",
		);
		expect(list.status).toBe(404);
		expect(coverageList).not.toHaveBeenCalled();

		const link = await handle(
			measurementCoverageRoutes,
			"/works/work-1/measurement-coverages",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workMeasurementItemId: "wmi-1",
					contractMeasurementItemId: "cmi-1",
					quantity: 10,
				}),
			},
		);
		expect(link.status).toBe(404);
		expect(coverageLink).not.toHaveBeenCalled();

		const unlink = await handle(
			measurementCoverageRoutes,
			"/works/work-1/measurement-coverages/coverage-1",
			{ method: "DELETE" },
		);
		expect(unlink.status).toBe(404);
		expect(coverageUnlink).not.toHaveBeenCalled();
	});

	it("measurement-coverages usa resourceOwnerId quando ha membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		const { measurementCoverageRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/measurement-coverage.routes"
		);

		const list = await handle(
			measurementCoverageRoutes,
			"/works/work-1/measurement-coverages",
		);
		expect(list.status).toBe(200);
		expect(coverageList).toHaveBeenCalledWith("owner-1", "work-1");

		const link = await handle(
			measurementCoverageRoutes,
			"/works/work-1/measurement-coverages",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workMeasurementItemId: "wmi-1",
					contractMeasurementItemId: "cmi-1",
					quantity: 10,
				}),
			},
		);
		expect(link.status).toBe(200);
		expect(coverageLink).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			{
				workMeasurementItemId: "wmi-1",
				contractMeasurementItemId: "cmi-1",
				quantity: 10,
			},
			{ userId: "owner-1" },
		);
	});

	it("import-batches GET retornam 404 sem escopo e nao chamam service", async () => {
		const { importBatchRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/import.routes"
		);

		const matrix: Array<[string, (...args: unknown[]) => unknown]> = [
			["/works/work-1/import-batches", batchList],
			["/works/work-1/import-batches/batch-1", batchPreview],
			[
				"/works/work-1/import-batches/batch-1/selectable-row-ids",
				batchSelectableRows,
			],
			["/works/work-1/import-batches/batch-1/rejected", batchExportRejected],
		];

		for (const [path, serviceMock] of matrix) {
			const response = await handle(importBatchRoutes, path);
			expect(response.status).toBe(404);
			expect(serviceMock).not.toHaveBeenCalled();
		}
	});

	it("import-batches POST create/confirm retornam 404 sem escopo e nao chamam service", async () => {
		const { importBatchRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/import.routes"
		);

		const form = new FormData();
		form.append("file", new File([new Uint8Array([0x50, 0x4b])], "obra.xlsx"));
		form.append("model", "obra-completa");

		const create = await handle(
			importBatchRoutes,
			"/works/work-1/import-batches",
			{
				method: "POST",
				body: form,
			},
		);
		expect(create.status).toBe(404);
		expect(batchCreate).not.toHaveBeenCalled();

		const confirm = await handle(
			importBatchRoutes,
			"/works/work-1/import-batches/batch-1/confirm",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					expectedBatchVersion: 1,
					selectedRowIds: ["row-1"],
					idempotencyKey: "key-1",
				}),
			},
		);
		expect(confirm.status).toBe(404);
		expect(batchConfirm).not.toHaveBeenCalled();
	});

	it("import-batches GET usa resourceOwnerId quando ha membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		const { importBatchRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/import.routes"
		);

		const response = await handle(
			importBatchRoutes,
			"/works/work-1/import-batches",
		);

		expect(response.status).toBe(200);
		expect(batchList).toHaveBeenCalledWith("owner-1", "work-1", 1, 20);
	});

	it("budget-reconciliation GET/POST retornam 404 sem escopo e nao chamam service", async () => {
		const { budgetReconciliationRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/budget-reconciliation.routes"
		);

		const pending = await handle(
			budgetReconciliationRoutes,
			"/reconciliation/pending?workId=work-1",
		);
		expect(pending.status).toBe(404);
		expect(reconciliationListPending).not.toHaveBeenCalled();

		const suggest = await handle(
			budgetReconciliationRoutes,
			"/reconciliation/suggest",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workId: "work-1",
					sourceType: "MANUAL",
					sourceId: "event-1",
				}),
			},
		);
		expect(suggest.status).toBe(404);
		expect(reconciliationSuggest).not.toHaveBeenCalled();

		const confirm = await handle(
			budgetReconciliationRoutes,
			"/reconciliation/confirm",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workId: "work-1",
					sourceType: "MANUAL",
					sourceId: "event-1",
					budgetItemId: "item-1",
					reason: "coincidente",
				}),
			},
		);
		expect(confirm.status).toBe(404);
		expect(reconciliationConfirm).not.toHaveBeenCalled();

		const reject = await handle(
			budgetReconciliationRoutes,
			"/reconciliation/reject",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workId: "work-1",
					sourceType: "MANUAL",
					sourceId: "event-1",
					reason: "sem correspondencia",
				}),
			},
		);
		expect(reject.status).toBe(404);
		expect(reconciliationReject).not.toHaveBeenCalled();
	});

	it("budget-reconciliation usa resourceOwnerId quando ha membership", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		const { budgetReconciliationRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/budget-reconciliation.routes"
		);

		const pending = await handle(
			budgetReconciliationRoutes,
			"/reconciliation/pending?workId=work-1",
		);
		expect(pending.status).toBe(200);
		expect(reconciliationListPending).toHaveBeenCalledWith("owner-1", "work-1");

		const confirm = await handle(
			budgetReconciliationRoutes,
			"/reconciliation/confirm",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workId: "work-1",
					sourceType: "MANUAL",
					sourceId: "event-1",
					budgetItemId: "item-1",
					reason: "coincidente",
				}),
			},
		);
		expect(confirm.status).toBe(200);
		expect(reconciliationConfirm).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				workId: "work-1",
				createdBy: "owner-1",
			}),
		);
	});

	it("supplier-analytics com workId retorna 404 sem escopo e nao chama service", async () => {
		const { supplierAnalyticsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/supplier-analytics.routes"
		);

		const response = await handle(
			supplierAnalyticsRoutes,
			"/suppliers/analytics?workId=work-1",
		);

		expect(response.status).toBe(404);
		expect(analyticsList).not.toHaveBeenCalled();
	});

	it("supplier-analytics sem workId nao exige escopo e chama service", async () => {
		const { supplierAnalyticsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/supplier-analytics.routes"
		);

		const response = await handle(
			supplierAnalyticsRoutes,
			"/suppliers/analytics",
		);

		expect(response.status).toBe(200);
		expect(analyticsList).toHaveBeenCalledWith("granted-1", {
			q: undefined,
			workId: undefined,
			sort: undefined,
			order: undefined,
		});
	});

	it("supplier-analytics com workId usa membership para permitir leitura", async () => {
		orgMemberships = [{ organizationId: "org-1" }];
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		const { supplierAnalyticsRoutes } = await import(
			"../../../../../src/modules/construction-planning/routes/supplier-analytics.routes"
		);

		const response = await handle(
			supplierAnalyticsRoutes,
			"/suppliers/analytics?workId=work-1",
		);

		expect(response.status).toBe(200);
		expect(analyticsList).toHaveBeenCalledWith("owner-1", {
			q: undefined,
			workId: "work-1",
			sort: undefined,
			order: undefined,
		});
	});
});
