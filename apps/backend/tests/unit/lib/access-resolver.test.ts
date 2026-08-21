import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../src/lib/errors";
import type { ScopeContext } from "../../../src/lib/resource-scope";

const mockFindUser = mock(async (): Promise<{ role: string } | null> => null);

const mockResolveResourceScope = mock(
	async (): Promise<ScopeContext> => ({
		actorId: "gestor-1",
		resourceType: "WORK",
		resourceOwnerId: "owner-1",
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		role: "GESTOR",
		canRead: true,
		canWrite: true,
		canApprove: true,
		canAdmin: false,
	}),
);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: mockFindUser,
		},
	},
}));

mock.module("../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mockResolveResourceScope,
}));

describe("access-resolver", () => {
	beforeEach(() => {
		mockFindUser.mockResolvedValue(null);
		mockResolveResourceScope.mockImplementation(
			async (): Promise<ScopeContext> => ({
				actorId: "gestor-1",
				resourceType: "WORK",
				resourceOwnerId: "owner-1",
				path: {
					organizationId: "org-1",
					costCenterId: "cc-1",
					workId: "work-1",
				},
				role: "GESTOR",
				canRead: true,
				canWrite: true,
				canApprove: true,
				canAdmin: false,
			}),
		);
	});

	it("delega ao resolvedor central e expoe o papel efetivo", async () => {
		const { resolveEffectiveAccess } = await import(
			"../../../src/lib/access-resolver"
		);
		const access = await resolveEffectiveAccess("gestor-1", "WORK", "work-1");
		expect(access.canRead).toBe(true);
		expect(access.canWrite).toBe(true);
		expect(access.canApprove).toBe(true);
		expect(access.role).toBe("GESTOR");
	});

	it("resolve gerente com acesso organizacional", async () => {
		mockResolveResourceScope.mockResolvedValueOnce({
			actorId: "gerente-1",
			resourceType: "WORK",
			resourceOwnerId: "owner-1",
			path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
			role: "GERENTE",
			canRead: true,
			canWrite: true,
			canApprove: true,
			canAdmin: false,
		});
		const { resolveEffectiveAccess } = await import(
			"../../../src/lib/access-resolver"
		);
		const access = await resolveEffectiveAccess("gerente-1", "WORK", "work-1");
		expect(access.canRead).toBe(true);
		expect(access.canWrite).toBe(true);
		expect(access.role).toBe("GERENTE");
	});

	it("nega por padrao usuario sem escopo", async () => {
		mockResolveResourceScope.mockResolvedValueOnce({
			actorId: "outsider-1",
			resourceType: "WORK",
			resourceOwnerId: "",
			path: { organizationId: "", costCenterId: null, workId: "" },
			role: null,
			canRead: false,
			canWrite: false,
			canApprove: false,
			canAdmin: false,
		});
		const { resolveEffectiveAccess } = await import(
			"../../../src/lib/access-resolver"
		);
		const access = await resolveEffectiveAccess(
			"outsider-1",
			"WORK",
			"work-999",
		);
		expect(access.canRead).toBe(false);
		expect(access.role).toBeNull();
	});

	it("authorize lanca FORBIDDEN para escrita sem permissao", async () => {
		mockResolveResourceScope.mockResolvedValueOnce({
			actorId: "supervisor-1",
			resourceType: "WORK",
			resourceOwnerId: "owner-1",
			path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
			role: "SUPERVISOR",
			canRead: true,
			canWrite: true,
			canApprove: false,
			canAdmin: false,
		});
		const { authorize } = await import("../../../src/lib/access-resolver");
		await expect(
			authorize("supervisor-1", "approve", "WORK", "work-1"),
		).rejects.toBeInstanceOf(ConstructionError);
	});
});
