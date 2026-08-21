import { beforeEach, describe, expect, it, mock } from "bun:test";
import { requestContext } from "../../../src/lib/request-context";

const userFindUnique = mock(
	async (): Promise<{ role: string | null; banned: boolean } | null> => ({
		role: "GERENTE",
		banned: false,
	}),
);
const workFindUnique = mock(
	async (_args?: {
		where: { id: string };
	}): Promise<Record<string, unknown> | null> => null,
);
const costCenterFindUnique = mock(
	async (): Promise<{ id: string; organizationId: string } | null> => null,
);
const organizationFindUnique = mock(
	async (): Promise<{ id: string; ownerId: string } | null> => null,
);
const organizationMembershipFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const costCenterMembershipFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const workMembershipFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const constructionWorkFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: userFindUnique },
		constructionWork: {
			findUnique: workFindUnique,
			findMany: constructionWorkFindMany,
		},
		costCenter: { findUnique: costCenterFindUnique },
		organization: { findUnique: organizationFindUnique },
		organizationMembership: {
			findMany: organizationMembershipFindMany,
		},
		costCenterMembership: {
			findMany: costCenterMembershipFindMany,
		},
		workMembership: { findMany: workMembershipFindMany },
	},
}));

const { resolveResourceScope, resolvePortfolioScope } = await import(
	"../../../src/lib/resource-scope"
);

const WORK_CHAIN = {
	work: { id: "work-1", costCenterId: "cc-1" },
	costCenter: { id: "cc-1", organizationId: "org-1" },
	organization: { id: "org-1", ownerId: "owner-1" },
};

const CC_CHAIN = {
	costCenter: { id: "cc-1", organizationId: "org-1" },
	organization: { id: "org-1", ownerId: "owner-1" },
};

const ORG_CHAIN = {
	organization: { id: "org-1", ownerId: "owner-1" },
};

function stubChain(
	chain: typeof WORK_CHAIN | typeof CC_CHAIN | typeof ORG_CHAIN,
) {
	if ("work" in chain) {
		workFindUnique.mockResolvedValue(chain.work);
		costCenterFindUnique.mockResolvedValue(chain.costCenter);
	} else if ("costCenter" in chain) {
		costCenterFindUnique.mockResolvedValue(chain.costCenter);
	}
	organizationFindUnique.mockResolvedValue(chain.organization);
}

describe("USR-001 matriz de resource scope (DEC-004/DEC-005)", () => {
	beforeEach(() => {
		userFindUnique.mockResolvedValue({ role: "GERENTE", banned: false });
		workFindUnique.mockResolvedValue(null);
		costCenterFindUnique.mockResolvedValue(null);
		organizationFindUnique.mockResolvedValue(null);
		organizationMembershipFindMany.mockResolvedValue([]);
		costCenterMembershipFindMany.mockResolvedValue([]);
		workMembershipFindMany.mockResolvedValue([]);
	});

	it("GERENTE com membership ativa de organizacao acessa obra de qualquer centro dela", async () => {
		stubChain(WORK_CHAIN);
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);

		const scope = await resolveResourceScope("gerente-1", {
			workId: "work-1",
		});

		expect(scope.resourceOwnerId).toBe("owner-1");
		expect(scope.resourceType).toBe("WORK");
		expect(scope.canRead).toBe(true);
		expect(scope.canWrite).toBe(true);
		expect(scope.canApprove).toBe(true);
		expect(scope.role).toBe("GERENTE");
	});

	it("GERENTE sem membership nao acessa, mesmo sendo owner da organizacao", async () => {
		stubChain(WORK_CHAIN);

		const scope = await resolveResourceScope("owner-1", { workId: "work-1" });

		expect(scope.resourceOwnerId).toBe("");
		expect(scope.canRead).toBe(false);
		expect(scope.canWrite).toBe(false);
		expect(scope.role).toBeNull();
	});

	it("GESTOR com org e CC ativos acessa obra do centro", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);

		const scope = await resolveResourceScope("gestor-1", { workId: "work-1" });

		expect(scope.canRead).toBe(true);
		expect(scope.canWrite).toBe(true);
		expect(scope.canApprove).toBe(true);
		expect(scope.role).toBe("GESTOR");
	});

	it("SUPERVISOR com org e CC ativos acessa obra do centro sem aprovar", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "SUPERVISOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);

		const scope = await resolveResourceScope("supervisor-1", {
			workId: "work-1",
		});

		expect(scope.canRead).toBe(true);
		expect(scope.canWrite).toBe(true);
		expect(scope.canApprove).toBe(false);
		expect(scope.role).toBe("SUPERVISOR");
	});

	it("GESTOR sem membership do centro do recurso nao acessa a obra", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([
			{ costCenterId: "cc-other" },
		]);

		const scope = await resolveResourceScope("gestor-1", { workId: "work-1" });

		expect(scope.canRead).toBe(false);
		expect(scope.canWrite).toBe(false);
		expect(scope.role).toBeNull();
	});

	it("work membership sem centro pai ativo e ignorada (orfa nao concede acesso)", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([]);
		workMembershipFindMany.mockResolvedValue([
			{ work: { id: "work-1", costCenterId: "cc-1" } },
		]);

		const scope = await resolveResourceScope("gestor-1", { workId: "work-1" });

		expect(scope.canRead).toBe(false);
		expect(scope.canWrite).toBe(false);
		expect(scope.role).toBeNull();
	});

	it("API key escopada rejeita cadeia de outra organizacao", async () => {
		stubChain({
			work: { id: "work-1", costCenterId: "cc-1" },
			costCenter: { id: "cc-1", organizationId: "org-2" },
			organization: { id: "org-2", ownerId: "owner-2" },
		});
		userFindUnique.mockResolvedValue({ role: "ADMIN", banned: false });
		const scope = requestContext.withRequestContext(
			{ requestId: "scope-test", apiKeyOrgScope: "org-1" },
			() => resolveResourceScope("admin-1", { workId: "work-1" }),
		);
		expect((await scope).canRead).toBe(false);
	});

	it("work membership valida restringe as obras dos centros atribuidos", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
		workMembershipFindMany.mockResolvedValue([
			{ work: { id: "work-1", costCenterId: "cc-1" } },
		]);

		const granted = await resolveResourceScope("gestor-1", {
			workId: "work-1",
		});
		expect(granted.canRead).toBe(true);
		expect(granted.role).toBe("GESTOR");

		const otherChain = {
			work: { id: "work-2", costCenterId: "cc-1" },
			costCenter: { id: "cc-1", organizationId: "org-1" },
			organization: { id: "org-1", ownerId: "owner-1" },
		};
		stubChain(otherChain);
		const denied = await resolveResourceScope("gestor-1", {
			workId: "work-2",
		});
		expect(denied.canRead).toBe(false);
		expect(denied.role).toBeNull();
	});

	it("work membership orfa (centro fora dos atribuidos) nao restringe obras do centro", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
		workMembershipFindMany.mockResolvedValue([
			{ work: { id: "work-9", costCenterId: "cc-other" } },
		]);

		const scope = await resolveResourceScope("gestor-1", { workId: "work-1" });

		expect(scope.canRead).toBe(true);
		expect(scope.role).toBe("GESTOR");
	});

	it("restricao de obra nao bloqueia acesso ao centro de custo atribuido", async () => {
		stubChain(CC_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);
		workMembershipFindMany.mockResolvedValue([
			{ work: { id: "work-1", costCenterId: "cc-1" } },
		]);

		const scope = await resolveResourceScope("gestor-1", {
			costCenterId: "cc-1",
		});

		expect(scope.canRead).toBe(true);
		expect(scope.resourceType).toBe("COST_CENTER");
		expect(scope.role).toBe("GESTOR");
	});

	it("membership revogada nao concede acesso", async () => {
		stubChain(WORK_CHAIN);
		organizationMembershipFindMany.mockResolvedValue([]);
		costCenterMembershipFindMany.mockResolvedValue([]);

		const scope = await resolveResourceScope("member-1", {
			costCenterId: "cc-1",
		});

		expect(scope.canRead).toBe(false);
		expect(scope.role).toBeNull();
	});

	it("GESTOR acessa o centro de custo atribuido e seus recursos", async () => {
		stubChain(CC_CHAIN);
		userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);
		costCenterMembershipFindMany.mockResolvedValue([{ costCenterId: "cc-1" }]);

		const scope = await resolveResourceScope("gestor-1", {
			costCenterId: "cc-1",
		});

		expect(scope.resourceType).toBe("COST_CENTER");
		expect(scope.resourceOwnerId).toBe("owner-1");
		expect(scope.canRead).toBe(true);
		expect(scope.canWrite).toBe(true);
		expect(scope.role).toBe("GESTOR");
	});

	it("GERENTE acessa a organizacao vinculada", async () => {
		stubChain(ORG_CHAIN);
		organizationMembershipFindMany.mockResolvedValue([
			{ organizationId: "org-1" },
		]);

		const scope = await resolveResourceScope("gerente-1", {
			organizationId: "org-1",
		});

		expect(scope.resourceType).toBe("ORGANIZATION");
		expect(scope.resourceOwnerId).toBe("owner-1");
		expect(scope.canWrite).toBe(true);
		expect(scope.role).toBe("GERENTE");
	});

	it("recurso inexistente retorna contexto negado", async () => {
		const scope = await resolveResourceScope("gerente-1", {
			workId: "missing",
		});

		expect(scope.canRead).toBe(false);
		expect(scope.resourceOwnerId).toBe("");
		expect(scope.role).toBeNull();
	});

	it("ADMIN global acessa qualquer recurso com admin", async () => {
		userFindUnique.mockResolvedValue({ role: "ADMIN", banned: false });
		stubChain(WORK_CHAIN);

		const scope = await resolveResourceScope("admin-1", { workId: "work-1" });

		expect(scope.canRead).toBe(true);
		expect(scope.canWrite).toBe(true);
		expect(scope.canAdmin).toBe(true);
		expect(scope.role).toBe("ADMIN");
	});

	it("usuario desativado ou com papel legado recebe contexto negado", async () => {
		stubChain(WORK_CHAIN);
		userFindUnique.mockResolvedValue({ role: "VISUALIZADOR", banned: false });

		const scope = await resolveResourceScope("legacy-1", { workId: "work-1" });

		expect(scope.canRead).toBe(false);
		expect(scope.role).toBeNull();
	});

	describe("portfolio equivalente ao resource resolver", () => {
		beforeEach(() => {
			userFindUnique.mockResolvedValue({ role: "GESTOR", banned: false });
			organizationMembershipFindMany.mockResolvedValue([
				{ organizationId: "org-1" },
			]);
			costCenterMembershipFindMany.mockResolvedValue([
				{
					costCenterId: "cc-1",
					costCenter: {
						id: "cc-1",
						organizationId: "org-1",
						works: [{ id: "work-1" }, { id: "work-2" }, { id: "work-3" }],
					},
				},
			]);
			workMembershipFindMany.mockResolvedValue([]);
		});

		it("sem work memberships, expoe todas as obras dos centros atribuidos", async () => {
			workFindUnique.mockImplementation(
				async (args?: {
					where: { id: string };
				}): Promise<Record<string, unknown> | null> => ({
					id: args?.where.id ?? "work-1",
					costCenterId: "cc-1",
				}),
			);
			costCenterFindUnique.mockResolvedValue({
				id: "cc-1",
				organizationId: "org-1",
			});
			organizationFindUnique.mockResolvedValue({
				id: "org-1",
				ownerId: "owner-1",
			});
			const { paths } = await resolvePortfolioScope("gestor-1");
			expect(paths.map((p) => p.workId).sort()).toEqual([
				"work-1",
				"work-2",
				"work-3",
			]);
			for (const path of paths) {
				const scope = await resolveResourceScope("gestor-1", {
					workId: path.workId,
				});
				expect(scope.canRead).toBe(true);
			}
		});

		it("work membership valida restringe portfolio as obras listadas", async () => {
			workFindUnique.mockImplementation(
				async (args?: {
					where: { id: string };
				}): Promise<Record<string, unknown> | null> => ({
					id: args?.where.id ?? "work-1",
					costCenterId: "cc-1",
				}),
			);
			costCenterFindUnique.mockResolvedValue({
				id: "cc-1",
				organizationId: "org-1",
			});
			organizationFindUnique.mockResolvedValue({
				id: "org-1",
				ownerId: "owner-1",
			});
			workMembershipFindMany.mockResolvedValue([
				{
					work: {
						id: "work-2",
						costCenterId: "cc-1",
						costCenter: { id: "cc-1", organizationId: "org-1" },
					},
				},
			]);
			const { paths } = await resolvePortfolioScope("gestor-1");
			expect(paths.map((p) => p.workId).sort()).toEqual(["work-2"]);
			const denied = await resolveResourceScope("gestor-1", {
				workId: "work-1",
			});
			expect(denied.canRead).toBe(false);
			const granted = await resolveResourceScope("gestor-1", {
				workId: "work-2",
			});
			expect(granted.canRead).toBe(true);
		});

		it("work membership orfa nao restringe portfolio", async () => {
			workMembershipFindMany.mockResolvedValue([
				{
					work: {
						id: "work-9",
						costCenterId: "cc-other",
						costCenter: { id: "cc-other", organizationId: "org-1" },
					},
				},
			]);
			const { paths } = await resolvePortfolioScope("gestor-1");
			expect(paths.map((p) => p.workId).sort()).toEqual([
				"work-1",
				"work-2",
				"work-3",
			]);
		});

		it("GERENTE expoe todas as obras das organizacoes com membership", async () => {
			userFindUnique.mockResolvedValue({ role: "GERENTE", banned: false });
			organizationMembershipFindMany.mockResolvedValue([
				{
					organizationId: "org-1",
					organization: {
						id: "org-1",
						costCenters: [
							{ id: "cc-1", works: [{ id: "work-1" }, { id: "work-2" }] },
						],
					},
				},
			]);
			const { paths } = await resolvePortfolioScope("gerente-1");
			expect(paths.map((p) => p.workId).sort()).toEqual(["work-1", "work-2"]);
		});

		it("ADMIN expoe todas as obras do sistema", async () => {
			userFindUnique.mockResolvedValue({ role: "ADMIN", banned: false });
			constructionWorkFindMany.mockResolvedValue([
				{ id: "work-1", costCenter: { id: "cc-1", organizationId: "org-1" } },
				{ id: "work-2", costCenter: { id: "cc-1", organizationId: "org-1" } },
			]);
			const { paths } = await resolvePortfolioScope("admin-1");
			expect(paths.map((p) => p.workId).sort()).toEqual(["work-1", "work-2"]);
		});
	});
});
