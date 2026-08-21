import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	assertJsonResponse,
	assertNoContentResponse,
	TEST_OWNER,
} from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

const userFindUnique = mock(async () => ({ id: TEST_OWNER, role: "GERENTE" }));
const workFindUnique = mock(
	async (): Promise<{ id: string; costCenterId: string } | null> => ({
		id: "work-1",
		costCenterId: "cc-1",
	}),
);
const costCenterFindUnique = mock(async () => ({
	id: "cc-1",
	organizationId: "org-1",
}));
const organizationFindUnique = mock(async () => ({
	id: "org-1",
	ownerId: TEST_OWNER,
}));
const orgMembershipFindMany = mock(
	async (): Promise<{ organizationId: string }[]> => [],
);
const ccMembershipFindMany = mock(
	async (): Promise<{ costCenterId: string }[]> => [],
);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique },
		constructionWork: { findUnique: workFindUnique },
		costCenter: { findUnique: costCenterFindUnique },
		organization: { findUnique: organizationFindUnique },
		organizationMembership: { findMany: orgMembershipFindMany },
		costCenterMembership: { findMany: ccMembershipFindMany },
		workMembership: { findMany: mock(async () => []) },
	},
}));

const listSuppliers = mock(async () => ({
	data: [],
	total: 0,
	page: 1,
	limit: 10,
}));
const getSupplier = mock(async () => ({
	id: "supplier-1",
	ownerId: TEST_OWNER,
	name: "Fornecedor E2E",
	document: null,
	contact: null,
	notes: null,
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const getSupplierDetail = mock(async () => ({
	id: "supplier-1",
	ownerId: TEST_OWNER,
	name: "Fornecedor E2E",
	document: null,
	contact: null,
	notes: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	workLinks: [],
	contractCount: 0,
	costCount: 0,
}));
const createSupplier = mock(async () => ({
	id: "supplier-1",
	ownerId: TEST_OWNER,
	name: "Fornecedor E2E",
	document: null,
	contact: null,
	notes: null,
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const updateSupplier = mock(async () => ({
	id: "supplier-1",
	ownerId: TEST_OWNER,
	name: "Fornecedor E2E Atualizado",
	document: null,
	contact: null,
	notes: null,
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const removeSupplier = mock(async () => ({
	id: "supplier-1",
	ownerId: TEST_OWNER,
	name: "Fornecedor E2E",
	document: null,
	contact: null,
	notes: null,
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const listWorkSuppliers = mock(async () => [
	{ id: "work-supplier-1", supplierId: "supplier-1" },
]);
const linkToWork = mock(async () => ({
	id: "work-supplier-1",
	workId: "work-1",
	supplierId: "supplier-1",
}));
const unlinkFromWork = mock(async () => ({ id: "work-supplier-1" }));
const importSupplierWorkbook = mock(async () => ({ importedCount: 1 }));
const supplierAnalyticsList = mock(
	async (): Promise<unknown> => ({ items: [] }),
);

mock.module(
	"../../../src/modules/construction-planning/suppliers/supplier.service",
	() => ({
		supplierService: {
			list: listSuppliers,
			get: getSupplier,
			getDetail: getSupplierDetail,
			create: createSupplier,
			update: updateSupplier,
			remove: removeSupplier,
			listForWork: listWorkSuppliers,
			linkToWork,
			unlinkFromWork,
		},
	}),
);
mock.module(
	"../../../src/modules/construction-planning/suppliers/supplier-import.service",
	() => ({
		importSupplierWorkbook,
	}),
);
mock.module(
	"../../../src/modules/construction-planning/suppliers/supplier-analytics.service",
	() => ({
		supplierAnalyticsService: { list: supplierAnalyticsList },
	}),
);

beforeEach(() => {
	listSuppliers.mockClear();
	getSupplier.mockClear();
	getSupplierDetail.mockClear();
	createSupplier.mockClear();
	updateSupplier.mockClear();
	removeSupplier.mockClear();
	listWorkSuppliers.mockClear();
	linkToWork.mockClear();
	unlinkFromWork.mockClear();
	importSupplierWorkbook.mockClear();
	supplierAnalyticsList.mockClear();
	workFindUnique.mockResolvedValue({ id: "work-1", costCenterId: "cc-1" });
	orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
	ccMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
});

describe("Supplier CRUD E2E", () => {
	it("GET /construction/suppliers - lista fornecedores paginado", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/suppliers"),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ data: [], total: 0, page: 1, limit: 10 });
		expect(listSuppliers).toHaveBeenCalledWith({
			ownerId: TEST_OWNER,
			q: undefined,
			page: 1,
			pageSize: 10,
		});
	});

	it("GET /construction/suppliers - repassa q, page e pageSize", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/suppliers?q=ferr&page=2&pageSize=5",
			),
		);

		expect(response.status).toBe(200);
		expect(listSuppliers).toHaveBeenCalledWith({
			ownerId: TEST_OWNER,
			q: "ferr",
			page: 2,
			pageSize: 5,
		});
	});

	it("GET /construction/suppliers/:supplierId - detalhe fornecedor", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/suppliers/supplier-1"),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ id: "supplier-1", name: "Fornecedor E2E" });
		expect(getSupplierDetail).toHaveBeenCalledWith(TEST_OWNER, "supplier-1");
	});

	it("POST /construction/suppliers - cria fornecedor", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/suppliers", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: "Fornecedor E2E",
					document: "12.345.678/0001-90",
				}),
			}),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ id: "supplier-1", name: "Fornecedor E2E" });
		expect(createSupplier).toHaveBeenCalledWith(
			expect.objectContaining({
				ownerId: TEST_OWNER,
				name: "Fornecedor E2E",
				document: "12.345.678/0001-90",
			}),
			{ userId: TEST_OWNER },
		);
	});

	it("PATCH /construction/suppliers/:supplierId - atualiza fornecedor", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/suppliers/supplier-1", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Fornecedor E2E Atualizado" }),
			}),
		);

		assertJsonResponse(response, 200);
		const body = await response.json();
		expect(body).toMatchObject({ name: "Fornecedor E2E Atualizado" });
	});

	it("DELETE /construction/suppliers/:supplierId - exclui fornecedor", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/suppliers/supplier-1", {
				method: "DELETE",
			}),
		);

		assertNoContentResponse(response);
		expect(removeSupplier).toHaveBeenCalledWith(TEST_OWNER, "supplier-1", {
			userId: TEST_OWNER,
		});
	});

	it("GET /construction/works/:workId/suppliers - lista fornecedores da obra", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-1/suppliers"),
		);

		assertJsonResponse(response, 200);
		expect(listWorkSuppliers).toHaveBeenCalledWith(TEST_OWNER, "work-1");
	});

	it("GET /construction/works/:workId/suppliers - nega obra fora do escopo", async () => {
		workFindUnique.mockResolvedValue(null);

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/works/work-unknown/suppliers"),
		);

		expect(response.status).toBe(404);
		expect(listWorkSuppliers).not.toHaveBeenCalled();
	});

	it("POST /construction/works/:workId/suppliers/:supplierId - vincula fornecedor", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/suppliers/supplier-1",
				{ method: "POST" },
			),
		);

		assertJsonResponse(response, 200);
		expect(linkToWork).toHaveBeenCalledWith(TEST_OWNER, "work-1", "supplier-1");
	});

	it("DELETE /construction/works/:workId/suppliers/:supplierId - remove vinculo", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/suppliers/supplier-1",
				{ method: "DELETE" },
			),
		);

		assertNoContentResponse(response);
		expect(unlinkFromWork).toHaveBeenCalledWith(
			TEST_OWNER,
			"work-1",
			"supplier-1",
		);
	});

	it("POST /construction/works/:workId/suppliers/import - importa planilha", async () => {
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);
		const form = new FormData();
		form.append(
			"file",
			new File(["xlsx"], "fornecedores.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/works/work-1/suppliers/import",
				{ method: "POST", body: form },
			),
		);

		assertJsonResponse(response, 200);
		expect(importSupplierWorkbook).toHaveBeenCalledWith(
			TEST_OWNER,
			"work-1",
			expect.any(Uint8Array),
		);
	});

	it("GET /construction/suppliers/analytics - consolida valores por fornecedor", async () => {
		supplierAnalyticsList.mockImplementation(async () => ({
			items: [
				{
					supplierId: "sup-1",
					supplierName: "Fornecedor Alfa",
					contractCount: 2,
					contractedAmount: 150000,
					measuredAmount: 90000,
					paidAmount: 60000,
					openAmount: 30000,
				},
			],
		}));
		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request(
				"http://localhost/construction/suppliers/analytics?workId=work-1&sort=contractedAmount&order=desc",
			),
		);

		assertJsonResponse(response, 200);
		expect(supplierAnalyticsList).toHaveBeenCalledWith(TEST_OWNER, {
			q: undefined,
			workId: "work-1",
			sort: "contractedAmount",
			order: "desc",
		});
		const body = await response.json();
		expect(body.items[0]).toMatchObject({
			supplierName: "Fornecedor Alfa",
			contractedAmount: 150000,
		});
	});

	it("bloqueia mutacao sem sessao valida", async () => {
		const { ConstructionError } = await import("../../../src/lib/errors");
		getSessionUser.mockImplementationOnce(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});

		const { constructionPlanningController } = await import(
			"../../../src/modules/construction-planning/routes"
		);

		const response = await constructionPlanningController.handle(
			new Request("http://localhost/construction/suppliers", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Fornecedor Bloqueado" }),
			}),
		);

		expect(response.status).toBe(401);
		expect(createSupplier).not.toHaveBeenCalled();
	});
});
