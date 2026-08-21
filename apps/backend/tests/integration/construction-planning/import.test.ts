import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as XLSX from "xlsx";
import { assertJsonResponse, TEST_CC_ID, TEST_OWNER } from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

const auditLogCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "audit-1",
		...args.data,
	}),
);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: auditLogCreate },
		user: {
			findUnique: mock(async () => ({ role: "GERENTE" })),
		},
	},
}));

const getCostCenterByIdOnly = mock(async () => ({
	id: TEST_CC_ID,
	name: "Centro de Custo E2E",
}));

mock.module("../../../src/modules/organizations/repository", () => ({
	getCostCenterByIdOnly,
}));

const importWorkbook = mock(
	async (
		_ownerId: string,
		_workbook: Record<string, unknown>,
		_costCenterId: string,
		_replaceExisting: boolean,
		options: Record<string, unknown>,
	) => {
		const audit = options.audit as
			| ((
					tx: { auditLog: { create: typeof auditLogCreate } },
					importId: string,
					summary: Record<string, unknown>,
			  ) => Promise<void>)
			| undefined;
		if (audit) {
			await audit({ auditLog: { create: auditLogCreate } }, "import-1", {
				status: "IMPORTED",
				rowCount: 6,
				importedCount: 6,
				rejectedCount: 0,
				warningCount: 0,
				errors: [],
				warnings: [],
			});
		}
		return {
			importId: "import-1",
			workId: "work-1",
			status: "IMPORTED",
			rowCount: 6,
			warningCount: 0,
			importedSections: [
				"Obra",
				"Orcamento",
				"Cronograma Original",
				"Replanejamento",
				"Medicoes",
				"Custos Realizados",
			],
			processedSheets: [
				"Obra",
				"Orcamento",
				"Cronograma Original",
				"Replanejamento",
				"Medicoes",
				"Custos Realizados",
			],
			importedCount: 6,
			rejectedCount: 0,
			warnings: [],
			errors: [],
		};
	},
);
const previewWorkbook = mock(
	async (
		_bytes: Uint8Array,
		_fileName: string,
		_kind: string,
	): Promise<Record<string, unknown>> => ({
		importId: null,
		workId: null,
		status: "PENDING",
		preview: true,
		rowCount: 6,
		warningCount: 0,
		importedSections: [
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		],
		processedSheets: [
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		],
		importedCount: 6,
		rejectedCount: 0,
		warnings: [],
		errors: [],
	}),
);
const buildRejectedSheet = mock(
	async (
		_bytes: Uint8Array,
		_fileName: string,
		_kind: string,
	): Promise<Uint8Array> => new Uint8Array([9, 9, 9]),
);

const rejectedRowCount = (errors: unknown[]) =>
	new Set(
		(errors as { sheet?: string; row?: number }[]).map(
			(error) => `${error.sheet ?? ""}:${error.row ?? ""}`,
		),
	).size;

mock.module(
	"../../../src/modules/construction-planning/imports/import-service",
	() => ({
		importWorkbook,
		previewWorkbook,
		buildRejectedSheet,
		rejectedRowCount,
	}),
);

const listImports = mock(
	async (
		_ownerId: string,
		_filters: Record<string, unknown>,
	): Promise<Record<string, unknown>> => ({
		data: [],
		total: 0,
		page: 1,
		limit: 10,
		totalPages: 0,
		hasNextPage: false,
		hasPreviousPage: false,
	}),
);
const getImportById = mock(
	async (
		_ownerId: string,
		_importId: string,
	): Promise<Record<string, unknown> | null> => null,
);

mock.module(
	"../../../src/modules/construction-planning/imports/import-repository",
	() => ({
		listImports,
		getImportById,
		replaceBudgetWithImport: mock(async () => ({
			workId: "work-1",
			importId: "import-budget",
		})),
	}),
);

function makeXlsxFile(): File {
	return new File([new Uint8Array([1, 2, 3])], "unificado.xlsx", {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
}

function makeRejectedXlsxFile(): File {
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet([
			{
				Indice: "1.1",
				"Data da medicao": "2026-01-15",
				"Percentual medido acumulado": 0.5,
			},
		]),
		"Medicoes",
	);
	const bytes = new Uint8Array(
		XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
	);
	return new File([bytes], "unificado.xlsx", {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
}

beforeEach(() => {
	importWorkbook.mockClear();
	previewWorkbook.mockClear();
	buildRejectedSheet.mockClear();
	listImports.mockClear();
	getImportById.mockClear();
	auditLogCreate.mockClear();
});

describe("Import routes E2E", () => {
	it("GET /construction/imports - lista historico paginado por obra", async () => {
		listImports.mockResolvedValue({
			data: [
				{ id: "import-1", fileName: "unificado.xlsx", status: "IMPORTED" },
			],
			total: 1,
			page: 2,
			limit: 5,
			totalPages: 1,
			hasNextPage: false,
			hasPreviousPage: true,
		});
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/imports?workId=work-1&page=2&pageSize=5",
			),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({
			total: 1,
			page: 2,
			limit: 5,
			data: [{ id: "import-1", status: "IMPORTED" }],
		});
		expect(listImports).toHaveBeenCalledWith(TEST_OWNER, {
			workId: "work-1",
			page: 2,
			pageSize: 5,
		});
	});

	it("GET /construction/imports - page fracionada retorna 400 e nao chama repository", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports?page=1.1"),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toBe("Parametros invalidos");
		expect(listImports).not.toHaveBeenCalled();
	});

	it("GET /construction/imports - pageSize fracionada retorna 400 e nao chama repository", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports?pageSize=2.5"),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toBe("Parametros invalidos");
		expect(listImports).not.toHaveBeenCalled();
	});

	it("GET /construction/imports/:importId - detalhe da importacao", async () => {
		getImportById.mockResolvedValue({
			id: "import-1",
			ownerId: TEST_OWNER,
			workId: "work-1",
			fileName: "unificado.xlsx",
			status: "IMPORTED",
			reprocessOfId: null,
		});
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports/import-1"),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ id: "import-1", status: "IMPORTED" });
		expect(getImportById).toHaveBeenCalledWith(TEST_OWNER, "import-1");
	});

	it("GET /construction/imports/:importId - 404 quando nao encontrada", async () => {
		getImportById.mockResolvedValue(null);
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports/import-9"),
		);

		expect(response.status).toBe(404);
	});

	it("does not expose the legacy whole-work preview endpoint", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const form = new FormData();
		form.append("file", makeXlsxFile());
		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports/preview", {
				method: "POST",
				body: form,
			}),
		);

		expect(response.status).toBe(404);
	});

	it("does not default legacy preview requests to a whole-work import", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const form = new FormData();
		form.append("file", makeXlsxFile());
		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports/preview", {
				method: "POST",
				body: form,
			}),
		);

		expect(response.status).toBe(404);
	});

	it("does not expose the legacy rejected-sheet endpoint", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const form = new FormData();
		form.append("file", makeRejectedXlsxFile());
		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports/rejected-sheet", {
				method: "POST",
				body: form,
			}),
		);

		expect(response.status).toBe(404);
	});

	it("does not expose the legacy whole-work apply endpoint", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/imports", {
				method: "POST",
				body: new FormData(),
			}),
		);

		expect(response.status).toBe(404);
	});
});
