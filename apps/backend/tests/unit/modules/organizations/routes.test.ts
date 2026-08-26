import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";

const getSessionUser = mock(
	async (): Promise<{ id: string; role?: string }> => ({
		id: "owner-1",
		role: "GERENTE",
	}),
);

const createOrganization = mock(async () => ({
	id: "org-1",
	ownerId: "owner-1",
	name: "Rio Grande do Norte",
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const listOrganizations = mock(
	async (): Promise<{
		data: Array<Record<string, unknown>>;
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	}> => ({
		data: [
			{
				id: "org-1",
				ownerId: "owner-1",
				name: "Rio Grande do Norte",
				_count: { costCenters: 2 },
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		],
		total: 1,
		page: 1,
		limit: 10,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	}),
);
const getOrganizationById = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "org-1",
		ownerId: "owner-1",
		name: "Rio Grande do Norte",
		costCenters: [
			{
				id: "cc-1",
				name: "Natal",
				ownerId: "owner-1",
				organizationId: "org-1",
			},
			{
				id: "cc-2",
				name: "Mossoro",
				ownerId: "owner-1",
				organizationId: "org-1",
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
);
const updateOrganization = mock(async () => ({
	id: "org-1",
	ownerId: "owner-1",
	name: "Rio Grande do Norte Atualizado",
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const deleteOrganization = mock(async () => ({
	id: "org-1",
	ownerId: "owner-1",
}));

const createCostCenter = mock(async () => ({
	id: "cc-1",
	name: "Natal",
	organizationId: "org-1",
	ownerId: "owner-1",
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const listCostCenters = mock(
	async (): Promise<{
		data: Array<Record<string, unknown>>;
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	}> => ({
		data: [
			{
				id: "cc-1",
				name: "Natal",
				organizationId: "org-1",
				ownerId: "owner-1",
			},
			{
				id: "cc-2",
				name: "Mossoro",
				organizationId: "org-1",
				ownerId: "owner-1",
			},
		],
		total: 2,
		page: 1,
		limit: 10,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	}),
);
const getCostCenterById = mock(async () => ({
	id: "cc-1",
	name: "Natal",
	organizationId: "org-1",
	ownerId: "owner-1",
	works: [],
}));
const updateCostCenter = mock(async () => ({
	id: "cc-1",
	name: "Natal Atualizado",
	organizationId: "org-1",
	ownerId: "owner-1",
	createdAt: new Date(),
	updatedAt: new Date(),
}));
const deleteCostCenter = mock(async () => ({
	id: "cc-1",
	organizationId: "org-1",
	ownerId: "owner-1",
}));
const findUser = mock(async () => ({ role: "GERENTE" }));

mock.module("../../../../src/lib/auth-middleware", () => ({
	getSessionUser,
}));

mock.module("../../../../src/modules/organizations/repository", () => ({
	createOrganization,
	listOrganizations,
	getOrganizationById,
	updateOrganization,
	deleteOrganization,
	createCostCenter,
	listCostCenters,
	getCostCenterById,
	updateCostCenter,
	deleteCostCenter,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: mock(async () => ({ id: "audit-1" })) },
		user: { findUnique: findUser },
		organization: {
			findUnique: mock(async () => ({
				id: "org-1",
				ownerId: "owner-1",
				name: "Org Teste",
			})),
		},
		costCenter: {
			findUnique: mock(async () => ({
				id: "cc-1",
				ownerId: "owner-1",
				name: "CC Teste",
			})),
		},
	},
}));

describe("organizationController", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		findUser.mockResolvedValue({ role: "GERENTE" });
	});

	it("requires authentication for organization routes", async () => {
		getSessionUser.mockImplementationOnce(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			message: "Login obrigatorio",
			errors: [],
		});
		expect(listOrganizations).not.toHaveBeenCalled();
	});

	it("creates an organization with owner scope", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Rio Grande do Norte" }),
			}),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.ownerId).toBe("owner-1");
		expect(json.name).toBe("Rio Grande do Norte");
		expect(createOrganization).toHaveBeenCalledWith("owner-1", {
			name: "Rio Grande do Norte",
		});
	});

	it("rejects organization creation without name", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({}),
			}),
		);

		expect(response.status).toBe(400);
		expect(createOrganization).not.toHaveBeenCalled();
	});

	it("lists organizations for the current owner", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data).toBeArray();
		expect(json.data[0].name).toBe("Rio Grande do Norte");
		expect(json.data[0]._count.costCenters).toBe(2);
		expect(json.total).toBeGreaterThanOrEqual(0);
		expect(listOrganizations).toHaveBeenCalledWith("owner-1", {
			page: 1,
			limit: 10,
		});
	});

	it("loads role from the database when the session user has no role", async () => {
		getSessionUser.mockResolvedValueOnce({ id: "owner-1" });
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations"),
		);

		expect(response.status).toBe(200);
		expect(findUser).toHaveBeenCalledWith({
			where: { id: "owner-1" },
			select: { role: true, banned: true, workspaceId: true },
		});
		expect(listOrganizations).toHaveBeenCalledWith("owner-1", {
			page: 1,
			limit: 10,
		});
	});

	it("includes the company relationship only for admin organization views", async () => {
		getSessionUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
		findUser.mockResolvedValue({ role: "ADMIN" });
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const listResponse = await organizationController.handle(
			new Request("http://localhost/organizations"),
		);
		const detailResponse = await organizationController.handle(
			new Request("http://localhost/organizations/org-1"),
		);

		expect(listResponse.status).toBe(200);
		expect(detailResponse.status).toBe(200);
		expect(listOrganizations).toHaveBeenCalledWith(
			"admin-1",
			expect.anything(),
			{ includeCompany: true },
		);
		expect(getOrganizationById).toHaveBeenCalledWith("admin-1", "org-1", {
			includeCompany: true,
		});
	});

	it("gets a single organization with cost centers", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.name).toBe("Rio Grande do Norte");
		expect(json.costCenters).toBeArray();
		expect(json.costCenters[0].name).toBe("Natal");
		expect(getOrganizationById).toHaveBeenCalledWith("owner-1", "org-1");
	});

	it("returns 404 for non-existent organization", async () => {
		getOrganizationById.mockResolvedValueOnce(null as never);
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/missing-org"),
		);

		expect(response.status).toBe(404);
		expect(getOrganizationById).toHaveBeenCalledWith("owner-1", "missing-org");
	});

	it("updates an organization", async () => {
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "ADMIN" });
		findUser.mockResolvedValue({ role: "ADMIN" });
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Rio Grande do Norte Atualizado" }),
			}),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.name).toBe("Rio Grande do Norte Atualizado");
		expect(updateOrganization).toHaveBeenCalledWith("owner-1", "org-1", {
			name: "Rio Grande do Norte Atualizado",
		});
	});

	it("blocks organization updates for non-admin roles", async () => {
		getSessionUser.mockResolvedValueOnce({ id: "owner-1", role: "GERENTE" });
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Não permitido" }),
			}),
		);

		expect(response.status).toBe(403);
		expect(updateOrganization).not.toHaveBeenCalledWith(
			"owner-1",
			"org-1",
			expect.objectContaining({ name: "Não permitido" }),
		);
	});

	it("deletes an organization", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1", { method: "DELETE" }),
		);

		expect(response.status).toBe(204);
		expect(deleteOrganization).toHaveBeenCalledWith("owner-1", "org-1");
	});

	it("creates a cost center within an organization", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Natal" }),
			}),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.name).toBe("Natal");
		expect(json.organizationId).toBe("org-1");
		expect(json.ownerId).toBe("owner-1");
		expect(createCostCenter).toHaveBeenCalledWith("owner-1", "org-1", {
			name: "Natal",
		});
	});

	it("lists cost centers for an organization", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data).toBeArray();
		expect(json.data).toHaveLength(2);
		expect(json.data[0].name).toBe("Natal");
		expect(json.total).toBeGreaterThanOrEqual(0);
		expect(listCostCenters).toHaveBeenCalledWith("owner-1", "org-1", {
			page: 1,
			limit: 10,
		});
	});

	it("gets a single cost center with works", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers/cc-1"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.name).toBe("Natal");
		expect(json.works).toBeArray();
		expect(getCostCenterById).toHaveBeenCalledWith("owner-1", "org-1", "cc-1");
	});

	it("returns 404 for non-existent cost center", async () => {
		getCostCenterById.mockResolvedValueOnce(null as never);
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request(
				"http://localhost/organizations/org-1/cost-centers/missing-cc",
			),
		);

		expect(response.status).toBe(404);
	});

	it("updates a cost center", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers/cc-1", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Natal Atualizado" }),
			}),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.name).toBe("Natal Atualizado");
		expect(updateCostCenter).toHaveBeenCalledWith("owner-1", "org-1", "cc-1", {
			name: "Natal Atualizado",
		});
	});

	it("deletes a cost center", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers/cc-1", {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(204);
		expect(deleteCostCenter).toHaveBeenCalledWith("owner-1", "org-1", "cc-1");
	});

	it("does not expose data across owners - only returns owner's orgs", async () => {
		getSessionUser.mockResolvedValueOnce({ id: "owner-2", role: "GERENTE" });
		const emptyResponse = {
			data: [],
			total: 0,
			page: 1,
			limit: 10,
			totalPages: 0,
			hasNextPage: false,
			hasPreviousPage: false,
		};
		listOrganizations.mockResolvedValueOnce(emptyResponse);
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data).toEqual([]);
		expect(json.total).toBe(0);
		expect(listOrganizations).toHaveBeenCalledWith("owner-2", {
			page: 1,
			limit: 10,
		});
	});
});

const getCostCenterBI = mock(
	async (): Promise<unknown> => ({
		cards: { totalWorks: 1, totalActiveBudget: 100, totalEarnedValue: 50 },
		rankings: {
			costPerformance: [],
			schedulePerformance: [],
			budgetBalance: [],
		},
		portfolioChart: [],
		works: [],
		dataCompleteness: {},
		costsByWork: [],
		scheduleByWork: [],
		financial: { paidAmount: 0, openAmount: 0, bySupplier: [] },
	}),
);
const getOrganizationBI = mock(
	async (): Promise<unknown> => ({
		cards: { totalWorks: 2, totalActiveBudget: 200, totalEarnedValue: 100 },
		rankings: {
			costPerformance: [],
			schedulePerformance: [],
			budgetBalance: [],
		},
		portfolioChart: [],
		works: [],
		dataCompleteness: {},
		costsByWork: [],
		scheduleByWork: [],
		financial: { paidAmount: 0, openAmount: 0, bySupplier: [] },
	}),
);

mock.module("../../../../src/modules/organizations/bi", () => ({
	orgBIService: {
		getCostCenterBI,
		getOrganizationBI,
	},
}));

describe("organization BI endpoints", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
	});

	it("GET /organizations/:id/cost-centers/:ccId/bi returns cost center BI", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers/cc-1/bi"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.cards.totalWorks).toBe(1);
		expect(json.cards.totalActiveBudget).toBe(100);
		expect(getCostCenterBI).toHaveBeenCalledWith(
			"owner-1",
			"org-1",
			"cc-1",
			undefined,
			undefined,
		);
	});

	it("GET /organizations/:id/cost-centers/:ccId/bi returns 404 for invalid cost center", async () => {
		getCostCenterBI.mockRejectedValueOnce(
			new ConstructionError("NOT_FOUND", "Centro de custo nao encontrado", 404),
		);
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request(
				"http://localhost/organizations/org-1/cost-centers/missing-cc/bi",
			),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			message: "Centro de custo nao encontrado",
			errors: [],
		});
	});

	it("GET /organizations/:id/bi returns organization BI", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/bi"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.cards.totalWorks).toBe(2);
		expect(json.cards.totalActiveBudget).toBe(200);
		expect(getOrganizationBI).toHaveBeenCalledWith(
			"owner-1",
			"org-1",
			undefined,
			undefined,
		);
	});

	it("GET /organizations/:id/bi forwards selected ids to the BI service", async () => {
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request(
				"http://localhost/organizations/org-1/bi?costCenterIds=cc-1,cc-2&workIds=work-1",
			),
		);

		expect(response.status).toBe(200);
		expect(getOrganizationBI).toHaveBeenCalledWith(
			"owner-1",
			"org-1",
			{
				costCenterIds: ["cc-1", "cc-2"],
				workIds: ["work-1"],
			},
			undefined,
		);
	});

	it("GET /organizations/:id/bi returns 404 for invalid organization", async () => {
		getOrganizationBI.mockRejectedValueOnce(
			new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404),
		);
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/missing-org/bi"),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			message: "Orgao nao encontrado",
			errors: [],
		});
	});

	it("requires authentication for BI endpoints", async () => {
		getSessionUser.mockImplementationOnce(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/bi"),
		);

		expect(response.status).toBe(401);
	});
});

describe("EMP-001 owner scope: organizacoes sao do owner da conta", () => {
	it("listagem usa o id do usuario autenticado como owner", async () => {
		listOrganizations.mockClear();
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations"),
		);

		expect(response.status).toBe(200);
		expect(listOrganizations).toHaveBeenCalledWith(
			"owner-1",
			expect.anything(),
		);
	});

	it("detalhe de organizacao usa o id do usuario autenticado", async () => {
		getOrganizationById.mockClear();
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1"),
		);

		expect(response.status).toBe(200);
		expect(getOrganizationById).toHaveBeenCalledWith("owner-1", "org-1");
	});

	it("outro usuario (owner-2) nao consulta as organizacoes de owner-1", async () => {
		getSessionUser.mockResolvedValue({ id: "owner-2", role: "GERENTE" });
		getOrganizationById.mockClear();
		getOrganizationById.mockResolvedValue(null);
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1"),
		);

		expect(response.status).toBe(404);
		expect(getOrganizationById).toHaveBeenCalledWith("owner-2", "org-1");
		expect(getOrganizationById).not.toHaveBeenCalledWith("owner-1", "org-1");
	});

	it("centro de custo e consultado com o id do usuario autenticado", async () => {
		getSessionUser.mockResolvedValue({ id: "owner-2", role: "GERENTE" });
		const { organizationController } = await import(
			"../../../../src/modules/organizations/routes"
		);

		const response = await organizationController.handle(
			new Request("http://localhost/organizations/org-1/cost-centers/cc-1"),
		);

		expect(response.status).toBe(200);
	});
});
