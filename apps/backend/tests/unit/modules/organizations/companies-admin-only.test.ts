import { beforeEach, describe, expect, it, mock } from "bun:test";

const getSessionUser = mock(
	async (): Promise<{ id: string; role?: string | null }> => ({
		id: "owner-1",
		role: "GERENTE",
	}),
);
const userFindUnique = mock(
	async (): Promise<{ role: string | null } | null> => ({ role: "GERENTE" }),
);

mock.module("../../../../src/lib/auth-middleware", () => ({ getSessionUser }));
mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique },
		company: {
			findUnique: mock(async () => null),
			create: mock(async () => ({ id: "company-1" })),
			update: mock(async () => ({ id: "company-1" })),
			delete: mock(async () => ({ id: "company-1" })),
			count: mock(async () => 0),
			findMany: mock(async () => []),
		},
		organization: {
			findUnique: mock(async () => ({ id: "org-1", ownerId: "owner-1" })),
		},
		organizationMembership: { findMany: mock(async () => []) },
		costCenterMembership: { findMany: mock(async () => []) },
	},
}));

const companyServiceMock = {
	list: mock(async () => ({ data: [], total: 0, page: 1, limit: 10 })),
	create: mock(async () => ({ id: "company-1" })),
	get: mock(async () => ({ id: "company-1" })),
	update: mock(async () => ({ id: "company-1" })),
	delete: mock(async () => ({})),
	linkOrganization: mock(async () => ({ id: "company-1" })),
	uploadContractTemplate: mock(async () => ({ id: "company-1" })),
	downloadContractTemplate: mock(async () => ({
		bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
		contentType: "application/pdf",
		filename: "template.pdf",
	})),
};

mock.module("../../../../src/modules/organizations/company.service", () => ({
	companyService: companyServiceMock,
}));

const { organizationController } = await import(
	"../../../../src/modules/organizations/routes"
);

function requestAs(role: string, path: string, method = "GET", body?: unknown) {
	getSessionUser.mockResolvedValue({ id: "user-1", role });
	userFindUnique.mockResolvedValue({ role });
	return organizationController.handle(
		new Request(`http://localhost/organizations${path}`, {
			method,
			headers: { "content-type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

describe("empresas exclusivas de ADMIN (DEC-005)", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("ADMIN cria empresa", async () => {
		const response = await requestAs("ADMIN", "/companies", "POST", {
			name: "Empresa A",
		});
		expect(response.status).toBe(200);
		expect(companyServiceMock.create).toHaveBeenCalled();
	});

	it("ADMIN recebe escopo global ao listar empresas", async () => {
		const response = await requestAs("ADMIN", "/companies");
		expect(response.status).toBe(200);
		expect(companyServiceMock.list).toHaveBeenCalledWith("user-1", {
			canAccessAllCompanies: true,
		});
	});

	it.each(["GERENTE", "GESTOR", "SUPERVISOR"])(
		"%s nao cria empresa (403)",
		async (role) => {
			const response = await requestAs(role, "/companies", "POST", {
				name: "Empresa Bloqueada",
			});
			expect(response.status).toBe(403);
			expect(companyServiceMock.create).not.toHaveBeenCalled();
		},
	);

	it.each(["GERENTE", "GESTOR", "SUPERVISOR"])(
		"%s nao edita empresa (403)",
		async (role) => {
			const response = await requestAs(role, "/companies/company-1", "PATCH", {
				name: "Nova",
			});
			expect(response.status).toBe(403);
			expect(companyServiceMock.update).not.toHaveBeenCalled();
		},
	);

	it("GERENTE nao exclui empresa nem vincula organizacao", async () => {
		const del = await requestAs("GERENTE", "/companies/company-1", "DELETE");
		expect(del.status).toBe(403);
		const link = await requestAs(
			"GERENTE",
			"/companies/company-1/link/org-1",
			"POST",
		);
		expect(link.status).toBe(403);
	});

	it("GERENTE nao envia modelo de contrato", async () => {
		const response = await requestAs(
			"GERENTE",
			"/companies/company-1/template",
			"POST",
		);
		expect(companyServiceMock.uploadContractTemplate).not.toHaveBeenCalled();
		expect(response.status).not.toBe(200);
	});

	it("leitura de empresas permanece disponivel para papeis com leitura", async () => {
		const response = await requestAs("SUPERVISOR", "/companies");
		expect(response.status).toBe(200);
	});
});
