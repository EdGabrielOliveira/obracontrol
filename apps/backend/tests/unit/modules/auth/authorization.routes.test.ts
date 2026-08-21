import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { AuthorizationSession } from "../../../../src/lib/authorization-session";

const getSessionUser = mock(async () => ({ id: "owner-1", role: "GERENTE" }));

const userFindUnique = mock(
	async (): Promise<{
		id: string;
		name: string;
		email: string;
		role: string;
	}> => ({
		id: "owner-1",
		name: "Gerente Teste",
		email: "gerente@obra.bi",
		role: "GERENTE",
	}),
);
const orgMembershipFindMany = mock(
	async (): Promise<
		Array<{
			organizationId: string;
			organization: { id: string; name: string };
		}>
	> => [],
);
const ccMembershipFindMany = mock(
	async (): Promise<
		Array<{
			costCenterId: string;
			costCenter: { id: string; organizationId: string; name: string };
		}>
	> => [],
);

mock.module("../../../../src/lib/auth-middleware", () => ({ getSessionUser }));
mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique },
		organizationMembership: { findMany: orgMembershipFindMany },
		costCenterMembership: { findMany: ccMembershipFindMany },
		workMembership: { findMany: mock(async () => []) },
	},
}));

const { authorizationSessionRoutes } = await import(
	"../../../../src/modules/auth/authorization.routes"
);

async function getSession() {
	const response = await authorizationSessionRoutes.handle(
		new Request("http://localhost/api/auth/authorization-session"),
	);
	expect(response.status).toBe(200);
	return (await response.json()) as AuthorizationSession;
}

describe("authorization session", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "owner-1", role: "GERENTE" });
		userFindUnique.mockResolvedValue({
			id: "owner-1",
			name: "Gerente Teste",
			email: "gerente@obra.bi",
			role: "GERENTE",
		});
		orgMembershipFindMany.mockResolvedValue([]);
		ccMembershipFindMany.mockResolvedValue([]);
	});

	it("expoe usuario, organizacoes e centros sem segredos", async () => {
		orgMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1", organization: { id: "org-1", name: "Org A" } },
		]);
		ccMembershipFindMany.mockResolvedValue([
			{
				costCenterId: "cc-1",
				costCenter: { id: "cc-1", organizationId: "org-1", name: "CC A" },
			},
		]);

		const session = await getSession();

		expect(session.user).toEqual({
			id: "owner-1",
			name: "Gerente Teste",
			email: "gerente@obra.bi",
			role: "GERENTE",
		});
		expect(session.organizations).toEqual([{ id: "org-1", name: "Org A" }]);
		expect(session.costCenters).toEqual([
			{ id: "cc-1", organizationId: "org-1", name: "CC A" },
		]);
	});

	it("GERENTE gerencia usuarios, mas nao empresas nem API keys", async () => {
		const session = await getSession();
		expect(session.capabilities).toEqual({
			canManageUsers: true,
			canAdministerCompanies: false,
			canManageApiKeys: false,
			canDecideSupervisorRequests: true,
			canReviewExecutedSupervisorRequests: true,
			canRequestSupervisorDecisionReversal: true,
			canDecideGestorRequests: true,
			canFinalizeContracts: true,
		});
	});

	it("ADMIN possui todas as capacidades", async () => {
		userFindUnique.mockResolvedValue({
			id: "admin-1",
			name: "Admin",
			email: "admin@obra.bi",
			role: "ADMIN",
		});
		const session = await getSession();
		expect(session.capabilities).toEqual({
			canManageUsers: true,
			canAdministerCompanies: true,
			canManageApiKeys: true,
			canDecideSupervisorRequests: true,
			canReviewExecutedSupervisorRequests: true,
			canRequestSupervisorDecisionReversal: true,
			canDecideGestorRequests: true,
			canFinalizeContracts: true,
		});
	});

	it("GESTOR decide pedidos de Supervisor; SUPERVISOR nao decide nada", async () => {
		userFindUnique.mockResolvedValue({
			id: "gestor-1",
			name: "Gestor",
			email: "gestor@obra.bi",
			role: "GESTOR",
		});
		const gestor = await getSession();
		expect(gestor.capabilities.canDecideSupervisorRequests).toBe(true);
		expect(gestor.capabilities.canDecideGestorRequests).toBe(false);
		expect(gestor.capabilities.canFinalizeContracts).toBe(false);
		expect(gestor.capabilities.canManageUsers).toBe(false);
		expect(gestor.capabilities.canAdministerCompanies).toBe(false);

		userFindUnique.mockResolvedValue({
			id: "supervisor-1",
			name: "Supervisor",
			email: "supervisor@obra.bi",
			role: "SUPERVISOR",
		});
		const supervisor = await getSession();
		expect(supervisor.capabilities.canDecideSupervisorRequests).toBe(false);
		expect(supervisor.capabilities.canDecideGestorRequests).toBe(false);
		expect(supervisor.capabilities.canFinalizeContracts).toBe(false);
		expect(supervisor.capabilities.canManageUsers).toBe(false);
	});
});
