import { beforeEach, describe, expect, it, mock } from "bun:test";

const getSessionUser = mock(
	async (): Promise<{ id: string; role?: string | null }> => ({
		id: "user-1",
		role: "ADMIN",
	}),
);
const userFindUnique = mock(
	async (): Promise<{ role: string | null }> => ({ role: "ADMIN" }),
);
const resolveGovernanceTarget = mock(
	async (): Promise<{
		workId: string;
		resourceOwnerId?: string;
		workspaceId?: string | null;
	} | null> => ({ workId: "work-1" }),
);
type MockScope = {
	actorId: string;
	resourceType: "WORK";
	resourceOwnerId: string;
	path: { organizationId: string; costCenterId: string; workId: string };
	role: string | null;
	canRead: boolean;
	canWrite: boolean;
	canApprove: boolean;
	canAdmin: boolean;
};

function makeScope(overrides: Partial<MockScope> = {}): MockScope {
	return {
		actorId: "user-1",
		resourceType: "WORK",
		resourceOwnerId: "owner-org",
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		role: "GERENTE",
		canRead: true,
		canWrite: true,
		canApprove: true,
		canAdmin: false,
		...overrides,
	};
}

const resolveResourceScope = mock(async (): Promise<MockScope> => makeScope());
const transition = mock(async () => ({
	id: "governance-1",
	status: "EM_REVISAO",
	version: 1,
}));
const get = mock(async () => ({
	id: null,
	status: "RASCUNHO",
	version: 0,
}));

mock.module("../../../../src/lib/auth-middleware", () => ({ getSessionUser }));
mock.module("../../../../src/lib/prisma", () => ({
	prisma: { user: { findUnique: userFindUnique } },
}));
mock.module("../../../../src/modules/governance/governance-target", () => ({
	resolveGovernanceTarget,
}));
mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope,
	resolvePortfolioScope: mock(async () => ({ actorId: "user-1", paths: [] })),
}));
mock.module("../../../../src/modules/governance/governance.service", () => ({
	governanceService: { transition, get },
	normalizeGovernanceRole: (role: string | null | undefined) =>
		role === "ADMIN" ||
		role === "GERENTE" ||
		role === "GESTOR" ||
		role === "SUPERVISOR" ||
		role === "APROVADOR"
			? role
			: "VISUALIZADOR",
}));
const notificationList = mock(async () => ({
	data: [],
	total: 0,
	page: 1,
	limit: 20,
}));
const notificationPendingCount = mock(async () => 0);
const notificationMarkRead = mock(async () => ({
	id: "notif-1",
	status: "READ",
	createdAt: new Date().toISOString(),
}));
const notificationMarkDismissed = mock(async () => ({
	id: "notif-1",
	status: "DISMISSED",
	createdAt: new Date().toISOString(),
}));
mock.module("../../../../src/modules/governance/notification.service", () => ({
	notificationService: {
		list: notificationList,
		pendingCount: notificationPendingCount,
		markRead: notificationMarkRead,
		markDismissed: notificationMarkDismissed,
	},
}));

const { governanceRoutes } = await import(
	"../../../../src/modules/governance/routes"
);

describe("governance routes target and owner validation", () => {
	beforeEach(() => {
		resolveGovernanceTarget.mockClear();
		resolveResourceScope.mockClear();
		transition.mockClear();
		get.mockClear();
		notificationList.mockClear();
		notificationPendingCount.mockClear();
		notificationMarkRead.mockClear();
		notificationMarkDismissed.mockClear();
		notificationList.mockResolvedValue({
			data: [],
			total: 0,
			page: 1,
			limit: 20,
		});
		resolveGovernanceTarget.mockResolvedValue({ workId: "work-1" });
		resolveResourceScope.mockResolvedValue(makeScope());
		transition.mockResolvedValue({
			id: "governance-1",
			status: "EM_REVISAO",
			version: 1,
		});
		get.mockResolvedValue({ id: null, status: "RASCUNHO", version: 0 });
	});

	it("passes the resolved resource owner to the transition instead of the actor id", async () => {
		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/BUDGET/work-1/transition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ toStatus: "EM_REVISAO" }),
			}),
		);

		expect(response.status).toBe(200);
		expect(transition).toHaveBeenCalledWith({
			ownerId: "owner-org",
			userId: "user-1",
			entityType: "BUDGET",
			entityId: "work-1",
			toStatus: "EM_REVISAO",
			role: "GERENTE",
			reason: undefined,
			override: undefined,
		});
	});

	it("answers 404 without creating a shadow record when the target is missing", async () => {
		resolveGovernanceTarget.mockResolvedValue(null);

		const response = await governanceRoutes.handle(
			new Request(
				"http://localhost/governance/BUDGET/work-missing/transition",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ toStatus: "EM_REVISAO" }),
				},
			),
		);

		expect(response.status).toBe(404);
		expect(transition).not.toHaveBeenCalled();
		expect(resolveResourceScope).not.toHaveBeenCalled();
	});

	it("blocks transitions for actors without write or approve access", async () => {
		resolveResourceScope.mockResolvedValue(
			makeScope({ role: "VISUALIZADOR", canWrite: false, canApprove: false }),
		);

		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/BUDGET/work-1/transition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ toStatus: "EM_REVISAO" }),
			}),
		);

		expect(response.status).toBe(403);
		expect(transition).not.toHaveBeenCalled();
	});

	it("allows approvers to transition without write access", async () => {
		resolveResourceScope.mockResolvedValue(
			makeScope({ role: "APROVADOR", canWrite: false }),
		);

		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/BUDGET/work-1/transition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ toStatus: "EM_REVISAO" }),
			}),
		);

		expect(response.status).toBe(200);
		expect(transition).toHaveBeenCalledWith(
			expect.objectContaining({ role: "APROVADOR" }),
		);
	});

	it("passes a gestor with work scope through to the governance service", async () => {
		resolveResourceScope.mockResolvedValue(
			makeScope({ role: "GESTOR", canWrite: true, canApprove: true }),
		);

		const response = await governanceRoutes.handle(
			new Request(
				"http://localhost/governance/WORK_MEASUREMENT_STATUS/measurement-1/transition",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						toStatus: "ACEITO",
						reason: "Medição importada validada",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(transition).toHaveBeenCalledWith(
			expect.objectContaining({
				entityType: "WORK_MEASUREMENT_STATUS",
				role: "GESTOR",
				toStatus: "ACEITO",
			}),
		);
	});

	it("normalizes ACCEPT to the internal accepted status", async () => {
		const response = await governanceRoutes.handle(
			new Request(
				"http://localhost/governance/WORK_MEASUREMENT_STATUS/measurement-1/transition",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						toStatus: "ACCEPT",
						reason: "Medição importada validada",
					}),
				},
			),
		);

		expect(response.status).toBe(200);
		expect(transition).toHaveBeenCalledWith(
			expect.objectContaining({ toStatus: "ACEITO" }),
		);
	});

	it("blocks a supervisor even when the resolved scope reports write access", async () => {
		resolveResourceScope.mockResolvedValue(
			makeScope({ role: "SUPERVISOR", canWrite: true, canApprove: true }),
		);

		const response = await governanceRoutes.handle(
			new Request(
				"http://localhost/governance/WORK_MEASUREMENT_STATUS/measurement-1/transition",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						toStatus: "ACEITO",
						reason: "Não autorizado",
					}),
				},
			),
		);

		expect(response.status).toBe(403);
		expect(transition).not.toHaveBeenCalled();
	});

	it("reads governance state under the resolved owner", async () => {
		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/BUDGET/work-1"),
		);

		expect(response.status).toBe(200);
		expect(get).toHaveBeenCalledWith("owner-org", "BUDGET", "work-1");
	});

	it("keeps an admin able to govern a legacy work with a broken hierarchy", async () => {
		resolveGovernanceTarget.mockResolvedValue({
			workId: "work-legacy",
			resourceOwnerId: "owner-work",
			workspaceId: null,
		});
		resolveResourceScope.mockResolvedValue(
			makeScope({
				resourceOwnerId: "",
				role: null,
				canRead: false,
				canWrite: false,
				canApprove: false,
			}),
		);

		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/WORK_STATUS/work-legacy"),
		);

		expect(response.status).toBe(200);
		expect(get).toHaveBeenCalledWith(
			"owner-work",
			"WORK_STATUS",
			"work-legacy",
		);
	});

	it("answers 404 on reads when the target is missing", async () => {
		resolveGovernanceTarget.mockResolvedValue(null);

		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/BUDGET/work-missing"),
		);

		expect(response.status).toBe(404);
		expect(get).not.toHaveBeenCalled();
	});

	it("answers 403 on reads without read access", async () => {
		resolveResourceScope.mockResolvedValue(
			makeScope({
				role: null,
				canRead: false,
				canWrite: false,
				canApprove: false,
			}),
		);

		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/BUDGET/work-1"),
		);

		expect(response.status).toBe(403);
		expect(get).not.toHaveBeenCalled();
	});
});

describe("governance notification routes are scoped to the authenticated user", () => {
	it("lists notifications for the authenticated user only", async () => {
		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/notifications"),
		);

		expect(response.status).toBe(200);
		expect(notificationList).toHaveBeenCalledWith(
			"user-1",
			expect.objectContaining({ status: undefined, page: 1, limit: 20 }),
		);
	});

	it("counts pending notifications for the authenticated user only", async () => {
		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/notifications/pending-count"),
		);

		expect(response.status).toBe(200);
		expect(notificationPendingCount).toHaveBeenCalledWith("user-1");
	});

	it("marks as read only notifications of the authenticated user", async () => {
		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/notifications/notif-1/read", {
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(notificationMarkRead).toHaveBeenCalledWith("user-1", "notif-1");
	});

	it("dismisses only notifications of the authenticated user", async () => {
		const response = await governanceRoutes.handle(
			new Request("http://localhost/governance/notifications/notif-1/dismiss", {
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(notificationMarkDismissed).toHaveBeenCalledWith("user-1", "notif-1");
	});
});
