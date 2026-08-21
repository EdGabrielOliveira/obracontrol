import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockFindUser = mock(
	async (): Promise<{ role: string | null; banned: boolean } | null> => null,
);
const mockFindOrgs = mock(async (): Promise<Array<{ id: string }>> => []);
const mockFindCCs = mock(async (): Promise<Array<{ id: string }>> => []);
const mockFindManyOrgMemberships = mock(async (): Promise<unknown[]> => []);
const mockFindManyCCMemberships = mock(async (): Promise<unknown[]> => []);
const mockFindManyWorkMemberships = mock(async (): Promise<unknown[]> => []);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: mockFindUser },
		organization: { findMany: mockFindOrgs },
		costCenter: { findMany: mockFindCCs },
		organizationMembership: {
			findMany: mockFindManyOrgMemberships,
		},
		costCenterMembership: {
			findMany: mockFindManyCCMemberships,
		},
		workMembership: {
			findMany: mockFindManyWorkMemberships,
		},
	},
}));

const mockResolveResourceScope = mock(
	async (): Promise<{
		canRead: boolean;
		canWrite: boolean;
		canApprove: boolean;
		canAdmin: boolean;
	}> => ({
		canRead: true,
		canWrite: true,
		canApprove: true,
		canAdmin: false,
	}),
);
const mockResolvePortfolioScope = mock(
	async (): Promise<{ actorId: string; paths: unknown[] }> => ({
		actorId: "user-1",
		paths: [],
	}),
);

mock.module("../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mockResolveResourceScope,
	resolvePortfolioScope: mockResolvePortfolioScope,
}));

describe("resolveScopeAccess", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		mockResolveResourceScope.mockImplementation(async () => ({
			canRead: true,
			canWrite: true,
			canApprove: true,
			canAdmin: false,
		}));
	});

	it("delega ao resolvedor central para organizacao", async () => {
		const { resolveScopeAccess } = await import(
			"../../../src/lib/scope-access"
		);
		const result = await resolveScopeAccess("user-1", "organization", "org-1");
		expect(result).toEqual({
			canRead: true,
			canWrite: true,
			canApprove: true,
			canAdmin: false,
		});
		expect(mockResolveResourceScope).toHaveBeenCalledWith("user-1", {
			organizationId: "org-1",
		});
	});

	it("delega ao resolvedor central para centro de custo", async () => {
		const { resolveScopeAccess } = await import(
			"../../../src/lib/scope-access"
		);
		await resolveScopeAccess("user-1", "costCenter", "cc-1");
		expect(mockResolveResourceScope).toHaveBeenCalledWith("user-1", {
			costCenterId: "cc-1",
		});
	});

	it("delega ao resolvedor central para obra", async () => {
		const { resolveScopeAccess } = await import(
			"../../../src/lib/scope-access"
		);
		await resolveScopeAccess("user-1", "work", "work-1");
		expect(mockResolveResourceScope).toHaveBeenCalledWith("user-1", {
			workId: "work-1",
		});
	});

	it("reflete negacao do resolvedor", async () => {
		mockResolveResourceScope.mockResolvedValueOnce({
			canRead: false,
			canWrite: false,
			canApprove: false,
			canAdmin: false,
		});
		const { resolveScopeAccess } = await import(
			"../../../src/lib/scope-access"
		);
		const result = await resolveScopeAccess("outsider-1", "work", "work-9");
		expect(result.canRead).toBe(false);
	});
});

describe("getAccessibleWorkIds", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		mockResolvePortfolioScope.mockResolvedValue({
			actorId: "user-1",
			paths: [
				{ organizationId: "org-1", costCenterId: "cc-1", workId: "w1" },
				{ organizationId: "org-1", costCenterId: "cc-1", workId: "w2" },
			],
		});
	});

	it("delega ao portfolio do resolvedor central", async () => {
		const { getAccessibleWorkIds } = await import(
			"../../../src/lib/scope-access"
		);
		const result = await getAccessibleWorkIds("user-1");
		expect(result).toEqual(["w1", "w2"]);
		expect(mockResolvePortfolioScope).toHaveBeenCalledWith("user-1");
	});

	it("retorna vazio quando o portfolio e vazio", async () => {
		mockResolvePortfolioScope.mockResolvedValue({
			actorId: "user-1",
			paths: [],
		});
		const { getAccessibleWorkIds } = await import(
			"../../../src/lib/scope-access"
		);
		expect(await getAccessibleWorkIds("user-1")).toEqual([]);
	});
});

describe("getAccessibleOrgIds", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		mockFindUser.mockResolvedValue(null);
		mockFindOrgs.mockResolvedValue([]);
		mockFindManyOrgMemberships.mockResolvedValue([]);
	});

	it("returns all organizations for ADMIN user", async () => {
		mockFindUser.mockResolvedValue({ role: "ADMIN", banned: false });
		mockFindOrgs.mockResolvedValue([{ id: "o1" }, { id: "o2" }]);
		const { getAccessibleOrgIds } = await import(
			"../../../src/lib/scope-access"
		);
		expect(await getAccessibleOrgIds("user-1")).toEqual(["o1", "o2"]);
	});

	it("returns active organizations from memberships", async () => {
		mockFindUser.mockResolvedValue({ role: "GERENTE", banned: false });
		mockFindManyOrgMemberships.mockResolvedValue([
			{ organizationId: "o1" },
			{ organizationId: "o2" },
		]);
		const { getAccessibleOrgIds } = await import(
			"../../../src/lib/scope-access"
		);
		expect(await getAccessibleOrgIds("user-1")).toEqual(["o1", "o2"]);
	});

	it("deduplicates organization ids", async () => {
		mockFindUser.mockResolvedValue({ role: "GERENTE", banned: false });
		mockFindManyOrgMemberships.mockResolvedValue([
			{ organizationId: "o1" },
			{ organizationId: "o1" },
		]);
		const { getAccessibleOrgIds } = await import(
			"../../../src/lib/scope-access"
		);
		expect(await getAccessibleOrgIds("user-1")).toEqual(["o1"]);
	});
});

describe("getAccessibleCostCenterIds", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		mockFindUser.mockResolvedValue(null);
		mockFindCCs.mockResolvedValue([]);
		mockFindManyCCMemberships.mockResolvedValue([]);
		mockFindManyOrgMemberships.mockResolvedValue([]);
	});

	it("returns all cost centers for ADMIN user", async () => {
		mockFindUser.mockResolvedValue({ role: "ADMIN", banned: false });
		mockFindCCs.mockResolvedValue([{ id: "cc1" }, { id: "cc2" }]);
		const { getAccessibleCostCenterIds } = await import(
			"../../../src/lib/scope-access"
		);
		expect(await getAccessibleCostCenterIds("user-1")).toEqual(["cc1", "cc2"]);
	});

	it("returns all centers of member organizations for GERENTE", async () => {
		mockFindUser.mockResolvedValue({ role: "GERENTE", banned: false });
		mockFindManyOrgMemberships.mockResolvedValue([
			{ organization: { costCenters: [{ id: "cc2" }, { id: "cc3" }] } },
		]);
		const { getAccessibleCostCenterIds } = await import(
			"../../../src/lib/scope-access"
		);
		const result = await getAccessibleCostCenterIds("user-1");
		expect(result).toContain("cc2");
		expect(result).toContain("cc3");
	});

	it("limits GESTOR/SUPERVISOR to assigned centers", async () => {
		mockFindUser.mockResolvedValue({ role: "GESTOR", banned: false });
		mockFindManyCCMemberships.mockResolvedValue([
			{ costCenterId: "cc1" },
			{ costCenterId: "cc2" },
		]);
		mockFindManyOrgMemberships.mockResolvedValue([]);
		const { getAccessibleCostCenterIds } = await import(
			"../../../src/lib/scope-access"
		);
		expect(await getAccessibleCostCenterIds("user-1")).toEqual(["cc1", "cc2"]);
	});
});

describe("getUserScopes", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		mockFindManyOrgMemberships.mockResolvedValue([{ organizationId: "o1" }]);
		mockFindManyCCMemberships.mockResolvedValue([{ costCenterId: "cc1" }]);
		mockFindManyWorkMemberships.mockResolvedValue([{ workId: "w1" }]);
	});

	it("returns active organization, center and work memberships", async () => {
		const { getUserScopes } = await import("../../../src/lib/scope-access");
		const scopes = await getUserScopes("user-1");
		expect(scopes.orgMemberships).toHaveLength(1);
		expect(scopes.ccMemberships).toHaveLength(1);
		expect(scopes.workMemberships).toHaveLength(1);
	});
});
