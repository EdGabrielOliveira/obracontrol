import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash } from "node:crypto";
import type { ConstructionError } from "../../../../src/lib/errors";

const RAW_TOKEN = "raw-token";
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

const mockUserFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => ({
		id: "actor-1",
		role: "ADMIN",
	}),
);

const mockInvitationCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "inv-1",
		tokenHash: args.data.tokenHash as string,
		scopeType: args.data.scopeType as string,
		scopeId: args.data.scopeId as string,
		scopeJson: args.data.scopeJson ?? null,
		role: args.data.role as string,
		email: args.data.email as string,
		expiresAt: args.data.expiresAt as Date,
		acceptedAt: null,
		revokedAt: null,
		createdAt: new Date(),
	}),
);
const mockInvitationFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const mockInvitationUpdateMany = mock(async () => ({ count: 0 }));
const mockInvitationUpdate = mock(async () => ({}));
const mockInvitationFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const mockInvitationCount = mock(async (): Promise<number> => 0);

const mockOrgMembershipFindMany = mock(
	async (): Promise<{ organizationId: string }[]> => [],
);
const mockOrgMembershipUpsert = mock(async () => ({}));
const mockOrgMembershipUpdateMany = mock(async () => ({ count: 1 }));
const mockCcMembershipUpsert = mock(async () => ({}));
const mockCcMembershipUpdateMany = mock(async () => ({ count: 1 }));
const mockWorkMembershipUpsert = mock(async () => ({}));
const mockWorkMembershipUpdateMany = mock(async () => ({ count: 1 }));
const mockSessionDeleteMany = mock(async () => ({ count: 1 }));
const mockUserUpdate = mock(async () => ({}));

const mockTransaction = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			userInvitation: {
				create: mockInvitationCreate,
				updateMany: mockInvitationUpdateMany,
				update: mockInvitationUpdate,
			},
			user: { update: mockUserUpdate },
			organizationMembership: {
				upsert: mockOrgMembershipUpsert,
				updateMany: mockOrgMembershipUpdateMany,
			},
			costCenterMembership: {
				upsert: mockCcMembershipUpsert,
				updateMany: mockCcMembershipUpdateMany,
			},
			workMembership: {
				upsert: mockWorkMembershipUpsert,
				updateMany: mockWorkMembershipUpdateMany,
			},
		}),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
		userInvitation: {
			create: mockInvitationCreate,
			findUnique: mockInvitationFindUnique,
			updateMany: mockInvitationUpdateMany,
			update: mockInvitationUpdate,
			findMany: mockInvitationFindMany,
			count: mockInvitationCount,
		},
		organizationMembership: {
			findMany: mockOrgMembershipFindMany,
			upsert: mockOrgMembershipUpsert,
			updateMany: mockOrgMembershipUpdateMany,
		},
		costCenterMembership: {
			upsert: mockCcMembershipUpsert,
			updateMany: mockCcMembershipUpdateMany,
		},
		session: { deleteMany: mockSessionDeleteMany },
		$transaction: mockTransaction,
	},
}));

function makeInvitation(overrides: Record<string, unknown> = {}) {
	const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
	return {
		id: "inv-1",
		tokenHash: TOKEN_HASH,
		scopeType: "organization",
		scopeId: "org-1",
		scopeJson: {
			organizationIds: ["org-1"],
			costCenterIds: ["cc-1"],
			workIds: [],
		},
		role: "SUPERVISOR",
		email: "convite@example.com",
		expiresAt,
		acceptedAt: null,
		revokedAt: null,
		createdAt: new Date(),
		...overrides,
	};
}

async function importService() {
	return import("../../../../src/modules/users/invitation.service");
}

describe("invitation service - pacote de escopo (DEC-005)", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		mockUserFindUnique.mockResolvedValue({ id: "actor-1", role: "ADMIN" });
		mockOrgMembershipFindMany.mockResolvedValue([]);
		mockInvitationFindUnique.mockResolvedValue(null);
		mockInvitationFindMany.mockResolvedValue([]);
		mockInvitationCount.mockResolvedValue(0);
		mockInvitationUpdateMany.mockResolvedValue({ count: 0 });
	});

	it("ADMIN cria convite com papel e escopo de organizacoes/centros", async () => {
		const { invitationService } = await importService();
		const result = await invitationService.createInvitation("actor-1", {
			email: "convite@example.com",
			role: "SUPERVISOR",
			scope: {
				organizationIds: ["org-1"],
				costCenterIds: ["cc-1"],
				workIds: [],
			},
		});

		expect(result.role).toBe("SUPERVISOR");
		expect(result.scope).toEqual({
			organizationIds: ["org-1"],
			costCenterIds: ["cc-1"],
			workIds: [],
		});
		expect(mockInvitationCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					role: "SUPERVISOR",
					scopeJson: {
						organizationIds: ["org-1"],
						costCenterIds: ["cc-1"],
						workIds: [],
					},
				}),
			}),
		);
	});

	it("GERENTE convida Gestor/Supervisor nas proprias organizacoes", async () => {
		mockUserFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		mockOrgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		const { invitationService } = await importService();

		const result = await invitationService.createInvitation("gerente-1", {
			email: "supervisor@obra.bi",
			role: "SUPERVISOR",
			scope: {
				organizationIds: ["org-1"],
				costCenterIds: ["cc-1"],
				workIds: [],
			},
		});

		expect(result.role).toBe("SUPERVISOR");
	});

	it("GERENTE nao convida Gerente ou Admin", async () => {
		mockUserFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		mockOrgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		const { invitationService } = await importService();

		let error: ConstructionError | undefined;
		try {
			await invitationService.createInvitation("gerente-1", {
				email: "gerente@obra.bi",
				role: "GERENTE",
				scope: { organizationIds: ["org-1"], costCenterIds: [], workIds: [] },
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("GERENTE nao convida fora das proprias organizacoes", async () => {
		mockUserFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		mockOrgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		const { invitationService } = await importService();

		let error: ConstructionError | undefined;
		try {
			await invitationService.createInvitation("gerente-1", {
				email: "supervisor@obra.bi",
				role: "SUPERVISOR",
				scope: {
					organizationIds: ["org-2"],
					costCenterIds: ["cc-2"],
					workIds: [],
				},
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("FORBIDDEN");
		expect(error?.status).toBe(403);
	});

	it("convite para GESTOR sem centro de custo e rejeitado", async () => {
		const { invitationService } = await importService();

		let error: ConstructionError | undefined;
		try {
			await invitationService.createInvitation("actor-1", {
				email: "gestor@obra.bi",
				role: "GESTOR",
				scope: { organizationIds: ["org-1"], costCenterIds: [], workIds: [] },
			});
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("COST_CENTER_REQUIRED");
		expect(error?.status).toBe(422);
	});

	it("aceitar convite aplica papel, membros e revoga sessoes", async () => {
		mockInvitationFindUnique.mockResolvedValue(makeInvitation());
		const { invitationService } = await importService();

		const result = await invitationService.acceptInvitation(
			"user-1",
			"convite@example.com",
			{ token: RAW_TOKEN },
		);

		expect(result.accepted).toBe(true);
		expect(result.role).toBe("SUPERVISOR");
		expect(mockUserUpdate).toHaveBeenCalledWith({
			where: { id: "user-1" },
			data: { role: "SUPERVISOR" },
		});
		expect(mockOrgMembershipUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: { organizationId: "org-1", userId: "user-1", role: "GERENTE" },
			}),
		);
		expect(mockCcMembershipUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: { costCenterId: "cc-1", userId: "user-1", role: "GESTOR" },
			}),
		);
		expect(mockSessionDeleteMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
		});
	});

	it("rejeita convite com papel legado", async () => {
		mockInvitationFindUnique.mockResolvedValue(
			makeInvitation({ role: "OPERADOR" }),
		);
		const { invitationService } = await importService();

		let error: ConstructionError | undefined;
		try {
			await invitationService.acceptInvitation(
				"user-1",
				"convite@example.com",
				{ token: RAW_TOKEN },
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("INVITATION_INVALID_ROLE");
		expect(error?.status).toBe(422);
	});

	it("lista convites restritos ao escopo do Gerente", async () => {
		mockUserFindUnique.mockResolvedValue({ id: "gerente-1", role: "GERENTE" });
		mockOrgMembershipFindMany.mockResolvedValue([{ organizationId: "org-1" }]);
		mockInvitationFindMany.mockResolvedValue([makeInvitation()]);
		mockInvitationCount.mockResolvedValue(1);
		const { invitationService } = await importService();

		const result = await invitationService.listInvitations("gerente-1", {
			page: 1,
			limit: 20,
		});

		expect(result.total).toBe(1);
		expect(mockInvitationFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					OR: expect.arrayContaining([
						expect.objectContaining({ createdBy: "gerente-1" }),
					]),
				}),
			}),
		);
	});
});
