import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ConstructionError } from "../../../../src/lib/errors";

const userCreate = mock(async (args: { data: Record<string, unknown> }) => ({
	id: "user-1",
	...args.data,
}));
const accountCreate = mock(async () => ({}));

const userFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "admin-1",
		role: "ADMIN",
	}),
);
const userUpdate = mock(async (args: { data: Record<string, unknown> }) => ({
	id: "user-1",
	...args.data,
}));
const userDelete = mock(async () => ({ id: "user-1" }));
const userFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "user-1",
		role: "SUPERVISOR",
		email: "supervisor@obra.bi",
	}),
);
const userFindMany = mock(async (): Promise<Record<string, unknown>[]> => []);
const userCount = mock(async () => 0);
const orgFindMany = mock(
	async (args?: { where?: { ownerId?: string; id?: { in?: string[] } } }) => {
		if (args?.where?.ownerId) return [];
		return [{ id: "org-1" }, { id: "org-2" }];
	},
);
const ccFindMany = mock(
	async (): Promise<{ id: string; organizationId: string }[]> => [
		{ id: "cc-1", organizationId: "org-1" },
		{ id: "cc-2", organizationId: "org-2" },
	],
);
const orgMembershipUpsert = mock(async () => ({}));
const ccMembershipUpsert = mock(async () => ({}));
const orgMembershipUpdateMany = mock(async () => ({ count: 1 }));
const ccMembershipUpdateMany = mock(async () => ({ count: 1 }));
const orgMembershipFindMany = mock(
	async (): Promise<{ organizationId: string }[]> => [],
);
const ccMembershipFindMany = mock(
	async (): Promise<{ costCenterId: string }[]> => [],
);
const workFindMany = mock(async (): Promise<unknown[]> => []);
const workMembershipUpsert = mock(async () => ({}));
const workMembershipUpdateMany = mock(async () => ({ count: 1 }));
const workMembershipFindMany = mock(
	async (): Promise<{ workId: string }[]> => [],
);
const sessionDeleteMany = mock(async () => ({ count: 1 }));
const auditLogCreate = mock(async () => ({ id: "audit-1" }));

const transaction = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			user: {
				update: userUpdate,
				findUnique: userFindUnique,
				delete: userDelete,
			},
			organizationMembership: {
				upsert: orgMembershipUpsert,
				updateMany: orgMembershipUpdateMany,
			},
			costCenterMembership: {
				upsert: ccMembershipUpsert,
				updateMany: ccMembershipUpdateMany,
			},
			workMembership: {
				upsert: workMembershipUpsert,
				updateMany: workMembershipUpdateMany,
			},
			auditLog: { create: auditLogCreate },
		}),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: userFindUnique,
			findFirst: userFindFirst,
			findMany: userFindMany,
			count: userCount,
			update: userUpdate,
			delete: userDelete,
			create: userCreate,
		},
		account: { create: accountCreate },
		organization: { findMany: orgFindMany },
		costCenter: { findMany: ccFindMany },
		constructionWork: { findMany: workFindMany },
		organizationMembership: {
			upsert: orgMembershipUpsert,
			updateMany: orgMembershipUpdateMany,
			findMany: orgMembershipFindMany,
		},
		costCenterMembership: {
			upsert: ccMembershipUpsert,
			updateMany: ccMembershipUpdateMany,
			findMany: ccMembershipFindMany,
		},
		workMembership: {
			upsert: workMembershipUpsert,
			updateMany: workMembershipUpdateMany,
			findMany: workMembershipFindMany,
		},
		session: { deleteMany: sessionDeleteMany },
		auditLog: { create: auditLogCreate },
		$transaction: transaction,
	},
}));

const { userService } = await import("../../../../src/modules/users/service");

function supervisorInput() {
	return {
		name: "Supervisor Novo",
		email: "supervisor.novo@obra.bi",
		password: "Senha@2026",
		role: "SUPERVISOR" as const,
		scope: { organizationIds: ["org-1"], costCenterIds: ["cc-1"], workIds: [] },
	};
}

describe("userService - delegacao e escopo (DEC-005)", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		userFindUnique.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
		userFindFirst.mockResolvedValue({
			id: "user-1",
			role: "ADMIN",
			email: "supervisor@obra.bi",
		});
		ccFindMany.mockResolvedValue([
			{ id: "cc-1", organizationId: "org-1" },
			{ id: "cc-2", organizationId: "org-2" },
		]);
		orgMembershipFindMany.mockResolvedValue([]);
		ccMembershipFindMany.mockResolvedValue([]);
		userCreate.mockResolvedValue({ id: "user-1" });
		userFindMany.mockResolvedValue([]);
		userCount.mockResolvedValue(0);
		orgMembershipUpsert.mockResolvedValue({});
		ccMembershipUpsert.mockResolvedValue({});
		workFindMany.mockResolvedValue([]);
		workMembershipUpsert.mockResolvedValue({});
		workMembershipUpdateMany.mockResolvedValue({ count: 1 });
		workMembershipFindMany.mockResolvedValue([]);
	});

	it("ADMIN lista usuarios globais mesmo sem memberships", async () => {
		orgFindMany.mockResolvedValueOnce([]);
		userFindMany.mockResolvedValueOnce([
			{
				id: "admin-2",
				name: "Administrador Novo",
				email: "admin.novo@obra.bi",
				role: "ADMIN",
				emailVerified: true,
				createdAt: new Date("2026-08-16T10:00:00.000Z"),
				organizationMemberships: [],
				costCenterMemberships: [],
				workMemberships: [],
			},
		]);
		userCount.mockResolvedValueOnce(1);

		const result = await userService.listScoped("admin-1", 1, 20);

		expect(result.data).toHaveLength(1);
		expect(result.data[0]?.email).toBe("admin.novo@obra.bi");
		expect(userFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: {} }),
		);
	});

	it("ADMIN cria Supervisor com organizacoes e centros", async () => {
		await userService.create(supervisorInput(), { actorId: "admin-1" });

		expect(userCreate).toHaveBeenCalled();
		expect(userUpdate).toHaveBeenCalledWith({
			where: { id: "user-1" },
			data: { role: "SUPERVISOR" },
		});
		expect(orgMembershipUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: { organizationId: "org-1", userId: "user-1", role: "GERENTE" },
			}),
		);
		expect(ccMembershipUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: { costCenterId: "cc-1", userId: "user-1", role: "GESTOR" },
			}),
		);
	});

	it("mapeia email duplicado para conflito sem expor erro do Prisma", async () => {
		userCreate.mockRejectedValueOnce({
			code: "P2002",
			message: "Invalid prisma.user.create invocation",
		});

		let error: ConstructionError | undefined;
		try {
			await userService.create(supervisorInput(), { actorId: "admin-1" });
		} catch (caught) {
			error = caught as ConstructionError;
		}

		expect(error?.code).toBe("EMAIL_ALREADY_EXISTS");
		expect(error?.message).toBe("Ja existe uma conta com este email");
		expect(error?.status).toBe(409);
	});

	it("ADMIN vincula usuario a uma obra com o centro pai no escopo", async () => {
		workFindMany.mockResolvedValue([
			{ id: "work-1", costCenter: { id: "cc-1", organizationId: "org-1" } },
		]);

		await userService.create(
			{
				...supervisorInput(),
				scope: {
					organizationIds: ["org-1"],
					costCenterIds: ["cc-1"],
					workIds: ["work-1"],
				},
			},
			{ actorId: "admin-1" },
		);

		expect(workMembershipUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: { workId: "work-1", userId: "user-1", role: "GESTOR" },
			}),
		);
	});

	it("GERENTE cria Gestor e Supervisor nas proprias organizacoes", async () => {
		userFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);

		await userService.create(supervisorInput(), { actorId: "gerente-1" });

		expect(userCreate).toHaveBeenCalled();
	});

	it("GERENTE nao pode criar Gerente ou Admin", async () => {
		userFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);

		let error: ConstructionError | undefined;
		try {
			await userService.create(
				{ ...supervisorInput(), role: "GERENTE" },
				{ actorId: "gerente-1" },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
		expect(userCreate).not.toHaveBeenCalled();
	});

	it("GERENTE nao pode vincular organizacao fora do proprio escopo", async () => {
		userFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);

		let error: ConstructionError | undefined;
		try {
			await userService.create(
				{
					...supervisorInput(),
					scope: {
						organizationIds: ["org-2"],
						costCenterIds: ["cc-2"],
						workIds: [],
					},
				},
				{ actorId: "gerente-1" },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("GESTOR sem centro de custo e rejeitado com 422", async () => {
		let error: ConstructionError | undefined;
		try {
			await userService.create(
				{
					...supervisorInput(),
					role: "GESTOR",
					scope: { organizationIds: ["org-1"], costCenterIds: [], workIds: [] },
				},
				{ actorId: "admin-1" },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("COST_CENTER_REQUIRED");
		expect(error?.status).toBe(422);
		expect(userCreate).not.toHaveBeenCalled();
	});

	it("centro de custo de outra organizacao e rejeitado com 422", async () => {
		let error: ConstructionError | undefined;
		try {
			await userService.create(
				{
					...supervisorInput(),
					scope: {
						organizationIds: ["org-1"],
						costCenterIds: ["cc-2"],
						workIds: [],
					},
				},
				{ actorId: "admin-1" },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("COST_CENTER_OUTSIDE_ORGANIZATION");
		expect(error?.status).toBe(422);
	});

	it("usuario nao-admin sem organizacao e rejeitado com 422", async () => {
		let error: ConstructionError | undefined;
		try {
			await userService.create(
				{
					...supervisorInput(),
					scope: { organizationIds: [], costCenterIds: [], workIds: [] },
				},
				{ actorId: "admin-1" },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("ORGANIZATION_REQUIRED");
		expect(error?.status).toBe(422);
	});

	it("GESTOR/SUPERVISOR nao podem administrar usuarios", async () => {
		userFindUnique.mockResolvedValue({ id: "gestor-1", role: "GESTOR" });

		let error: ConstructionError | undefined;
		try {
			await userService.create(supervisorInput(), { actorId: "gestor-1" });
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("escopo com workIds duplicados e rejeitado com 422", async () => {
		workFindMany.mockResolvedValue([
			{ id: "work-1", costCenter: { id: "cc-1", organizationId: "org-1" } },
		]);

		let error: ConstructionError | undefined;
		try {
			await userService.create(
				{
					...supervisorInput(),
					scope: {
						organizationIds: ["org-1"],
						costCenterIds: ["cc-1"],
						workIds: ["work-1", "work-1"],
					},
				},
				{ actorId: "admin-1" },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("DUPLICATED_SCOPE_ENTRY");
		expect(error?.status).toBe(422);
		expect(userCreate).not.toHaveBeenCalled();
	});

	it("alteracao de papel ou escopo revoga as sessoes do usuario alvo", async () => {
		await userService.update("admin-1", "user-1", {
			role: "GESTOR",
			scope: {
				organizationIds: ["org-1"],
				costCenterIds: ["cc-1"],
				workIds: [],
			},
		});

		expect(sessionDeleteMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
		});
	});

	it("ADMIN exclui usuario dentro do escopo e audita antes do cascade", async () => {
		userFindUnique
			.mockResolvedValueOnce({ id: "admin-1", role: "ADMIN" })
			.mockResolvedValueOnce({ id: "admin-1", role: "ADMIN" })
			.mockResolvedValueOnce({
				id: "user-1",
				email: "supervisor@obra.bi",
				role: "SUPERVISOR",
			});
		userFindFirst.mockResolvedValue({ id: "user-1" });

		await userService.delete("admin-1", "user-1");

		expect(auditLogCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					action: "DELETE",
					entityType: "USER",
					entityId: "user-1",
				}),
			}),
		);
		expect(userDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
	});

	it("nao permite excluir o proprio usuario", async () => {
		let error: ConstructionError | undefined;
		try {
			await userService.delete("admin-1", "admin-1");
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(userDelete).not.toHaveBeenCalled();
	});

	it("GERENTE atualiza somente Gestores/Supervisores", async () => {
		userFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		userFindFirst.mockResolvedValue({
			id: "user-1",
			role: "SUPERVISOR",
			email: "supervisor@obra.bi",
		});

		await userService.update("gerente-1", "user-1", {
			role: "GESTOR",
			scope: {
				organizationIds: ["org-1"],
				costCenterIds: ["cc-1"],
				workIds: [],
			},
		});

		expect(sessionDeleteMany).toHaveBeenCalled();
	});

	it("GERENTE nao promove Supervisor a Gerente", async () => {
		userFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		orgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);

		let error: ConstructionError | undefined;
		try {
			await userService.update("gerente-1", "user-1", { role: "GERENTE" });
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("nao expoe metadados administrativos no retorno do usuario", async () => {
		userFindUnique.mockResolvedValue({
			id: "user-1",
			name: "Usuario Teste",
			email: "usuario@obra.bi",
			role: "ADMIN",
			emailVerified: true,
			createdAt: new Date("2026-08-12T10:00:00.000Z"),
			banned: true,
			banReason: "metadado interno",
			banExpires: new Date("2026-08-13T10:00:00.000Z"),
			organizationMemberships: [],
			costCenterMemberships: [],
			workMemberships: [],
		});

		const user = await userService.create(supervisorInput(), {
			actorId: "admin-1",
		});

		expect(user).not.toHaveProperty("banned");
		expect(user).not.toHaveProperty("banReason");
		expect(user).not.toHaveProperty("banExpires");
		expect(userFindUnique).toHaveBeenLastCalledWith({
			where: { id: "user-1" },
			select: expect.any(Object),
		});
	});
});
