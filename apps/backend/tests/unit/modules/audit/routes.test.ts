import { beforeEach, describe, expect, it, mock } from "bun:test";

const getSessionUser = mock(
	async (): Promise<{ id: string; role?: string | null }> => ({
		id: "owner-1",
		role: "ADMIN",
	}),
);
const listForWork = mock(
	async (): Promise<{
		data: Array<Record<string, unknown>>;
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	}> => ({
		data: [],
		total: 0,
		page: 1,
		limit: 50,
		totalPages: 0,
		hasNextPage: false,
		hasPreviousPage: false,
	}),
);
const userFindUnique = mock(
	async (): Promise<{ role: string | null }> => ({
		role: "ADMIN",
	}),
);
const workMembershipFindUnique = mock(
	async (): Promise<{ role: string; revokedAt: Date | null } | null> => null,
);
const orgMembershipFindMany = mock(async (): Promise<unknown[]> => []);
const ccMembershipFindMany = mock(async (): Promise<unknown[]> => []);

mock.module("../../../../src/lib/auth-middleware", () => ({ getSessionUser }));
mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique },
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
		workMembership: {
			findUnique: workMembershipFindUnique,
			findMany: mock(async () => []),
		},
		costCenterMembership: {
			findUnique: mock(async () => null),
			findMany: ccMembershipFindMany,
		},
		organizationMembership: {
			findUnique: mock(async () => null),
			findMany: orgMembershipFindMany,
		},
	},
}));
mock.module("../../../../src/modules/audit/audit.service", () => ({
	auditService: {
		list: mock(async () => ({ data: [], total: 0, page: 1, limit: 50 })),
		listForWork,
	},
}));

const { auditRoutes } = await import("../../../../src/modules/audit/routes");

describe("audit routes", () => {
	beforeEach(() => {
		getSessionUser.mockClear();
		userFindUnique.mockClear();
		listForWork.mockClear();
		orgMembershipFindMany.mockClear();
		ccMembershipFindMany.mockClear();
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "ADMIN" });
		userFindUnique.mockResolvedValue({ role: "ADMIN" });
	});

	it("admin recebe historico paginado da obra com filtros repassados", async () => {
		listForWork.mockResolvedValueOnce({
			data: [
				{
					id: "a-1",
					userId: "u1",
					action: "CREATE",
					entityType: "WORK",
					entityId: "work-1",
					entityDescription: null,
					previousState: null,
					newState: {},
					metadata: null,
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					user: { id: "u1", name: "User", email: "u@test.com" },
				},
			],
			total: 1,
			page: 2,
			limit: 25,
			totalPages: 1,
			hasNextPage: false,
			hasPreviousPage: true,
		});

		const response = await auditRoutes.handle(
			new Request(
				"http://localhost/audit-logs/work/work-1?page=2&limit=25&entityType=WORK&action=CREATE&userId=u1",
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({ total: 1, page: 2, limit: 25 });
		expect(listForWork).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				page: 2,
				limit: 25,
				entityType: "WORK",
				action: "CREATE",
				userId: "u1",
			}),
		);
	});

	it("nao-admin sem escopo recebe negacao sem revelar o recurso", async () => {
		getSessionUser.mockResolvedValue({
			id: "supervisor-1",
			role: "SUPERVISOR",
		});
		userFindUnique.mockResolvedValue({ role: "SUPERVISOR" });
		orgMembershipFindMany.mockResolvedValue([]);
		ccMembershipFindMany.mockResolvedValue([]);

		const response = await auditRoutes.handle(
			new Request("http://localhost/audit-logs/work/work-1"),
		);

		expect(response.status).toBe(404);
		expect(listForWork).not.toHaveBeenCalled();
	});

	it("usa valores padrao quando page e limit estao ausentes", async () => {
		const response = await auditRoutes.handle(
			new Request("http://localhost/audit-logs/work/work-1"),
		);

		expect(response.status).toBe(200);
		expect(listForWork).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({ page: 1, limit: 50 }),
		);
	});

	it("GOV-004 (DEC-004): GERENTE acessa a auditoria da obra (sem API Keys/Config)", async () => {
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		userFindUnique.mockResolvedValue({ role: "GERENTE" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		listForWork.mockClear();

		const response = await auditRoutes.handle(
			new Request("http://localhost/audit-logs/work/work-1"),
		);

		expect(response.status).toBe(200);
		expect(listForWork).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.anything(),
		);
	});

	it("GOV-004 (DEC-005): GESTOR acessa a auditoria apenas da propria obra via scope", async () => {
		getSessionUser.mockResolvedValue({ id: "gestor-1", role: "GESTOR" });
		userFindUnique.mockResolvedValue({ role: "GESTOR" });
		// Membership do gestor no centro da obra concede o escopo.
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		ccMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
		listForWork.mockClear();

		const response = await auditRoutes.handle(
			new Request("http://localhost/audit-logs/work/work-1"),
		);

		expect(response.status).toBe(200);
		// O owner resolvido da obra (owner-1) e passado, nunca o actor.
		expect(listForWork).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.anything(),
		);
	});
});
