import { createHash } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import type { AuthorizationRole } from "../../lib/authorization";
import { isAuthorizationRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { buildPaginatedResponse } from "../../lib/pagination";
import { prisma } from "../../lib/prisma";
import { getWorkspaceIdForUser } from "../../lib/workspace";
import type {
	AcceptInvitationInput,
	CreateInvitationInput,
	UserScopeInput,
} from "./schema";

const INVITATION_TTL_DAYS = 7;
const TOKEN_LENGTH = 32;

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

async function assertActorCanInvite(
	actorId: string,
	targetRole: AuthorizationRole,
	scope: UserScopeInput,
): Promise<void> {
	const actor = await prisma.user.findUnique({
		where: { id: actorId },
		select: { role: true },
	});
	if (actor?.role === "ADMIN") return;
	if (actor?.role !== "GERENTE") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Voce nao tem permissao para convidar usuarios",
			403,
		);
	}
	if (targetRole !== "GESTOR" && targetRole !== "SUPERVISOR") {
		throw new ConstructionError(
			"FORBIDDEN",
			"O Gerente so pode convidar Gestores e Supervisores",
			403,
		);
	}
	const [memberships, companyMemberships, centers, works] = await Promise.all([
		prisma.organizationMembership.findMany({
			where: { userId: actorId, revokedAt: null },
			select: { organizationId: true },
		}),
		prisma.companyMembership.findMany({
			where: { userId: actorId, revokedAt: null },
			select: {
				company: { select: { organizations: { select: { id: true } } } },
			},
		}),
		prisma.costCenter.findMany({
			where: { id: { in: scope.costCenterIds } },
			select: { organizationId: true },
		}),
		prisma.constructionWork.findMany({
			where: { id: { in: scope.workIds } },
			select: { costCenter: { select: { organizationId: true } } },
		}),
	]);
	const allowed = new Set([
		...memberships.map((m) => m.organizationId),
		...companyMemberships.flatMap((m) =>
			m.company.organizations.map((o) => o.id),
		),
	]);
	const targetOrganizations = new Set([
		...scope.organizationIds,
		...centers.map((c) => c.organizationId),
		...works.map((w) => w.costCenter.organizationId),
	]);
	if ([...targetOrganizations].some((id) => !allowed.has(id))) {
		throw new ConstructionError(
			"FORBIDDEN",
			"Convite fora das organizacoes do Gerente",
			403,
		);
	}
}

function assertInvitationScope(
	targetRole: AuthorizationRole,
	scope: UserScopeInput,
) {
	const companyIds = scope.companyIds ?? [];
	if (targetRole === "ADMIN") return;
	if (
		targetRole === "GERENTE" &&
		companyIds.length === 0 &&
		scope.organizationIds.length === 0
	) {
		throw new ConstructionError(
			"ORGANIZATION_REQUIRED",
			"Convite de Gerente exige empresa ou organizacao",
			422,
		);
	}
	if (targetRole === "GESTOR" && companyIds.length > 0) {
		throw new ConstructionError(
			"GESTOR_SCOPE_INVALID",
			"Gestor nao pode receber escopo de empresa",
			422,
		);
	}
	if (
		targetRole === "GESTOR" &&
		scope.organizationIds.length === 0 &&
		scope.costCenterIds.length === 0 &&
		scope.workIds.length === 0
	) {
		throw new ConstructionError(
			"SCOPE_REQUIRED",
			"Convite de Gestor exige organizacao, centro de custo ou obra",
			422,
		);
	}
	if (
		targetRole === "SUPERVISOR" &&
		(companyIds.length > 0 ||
			scope.organizationIds.length > 0 ||
			scope.workIds.length > 0 ||
			scope.costCenterIds.length === 0)
	) {
		throw new ConstructionError(
			"SUPERVISOR_COST_CENTER_ONLY",
			"Supervisor exige somente centros de custo",
			422,
		);
	}
}

async function assertWorksHaveCenterAccess(
	scope: UserScopeInput,
): Promise<void> {
	if (scope.workIds.length === 0) return;
	const works = await prisma.constructionWork.findMany({
		where: { id: { in: scope.workIds } },
		select: { id: true, costCenterId: true },
	});
	if (works.length !== scope.workIds.length) {
		throw new ConstructionError(
			"INVALID_WORK",
			"Obra selecionada no convite nao existe",
			422,
		);
	}
}

export const invitationService = {
	async createInvitation(actorId: string, input: CreateInvitationInput) {
		const scope: UserScopeInput = {
			companyIds: input.scope.companyIds ?? [],
			organizationIds: input.scope.organizationIds,
			costCenterIds: input.scope.costCenterIds,
			workIds: input.scope.workIds ?? [],
		};
		assertInvitationScope(input.role, scope);
		await assertActorCanInvite(actorId, input.role, scope);
		await assertWorksHaveCenterAccess(scope);

		const raw = Buffer.from(
			crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH)),
		).toString("base64url");
		const tokenHash = hashToken(raw);
		const expiresAt = new Date(
			Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
		);
		const workspaceId = await getWorkspaceIdForUser(actorId);

		const invitation = await prisma.$transaction(async (tx) => {
			await tx.userInvitation.updateMany({
				where: {
					email: input.email,
					acceptedAt: null,
					revokedAt: null,
				},
				data: { revokedAt: new Date() },
			});
			return tx.userInvitation.create({
				data: {
					tokenHash,
					scopeType: "organization",
					scopeId: scope.organizationIds[0] ?? "",
					scopeJson: scope,
					role: input.role,
					email: input.email,
					expiresAt,
					createdBy: actorId,
					workspaceId,
				},
			});
		});

		return {
			id: invitation.id,
			email: invitation.email,
			role: invitation.role,
			scope,
			expiresAt: invitation.expiresAt.toISOString(),
			token: raw,
		};
	},

	async acceptInvitation(
		userId: string,
		email: string,
		input: AcceptInvitationInput,
	) {
		const tokenHash = hashToken(input.token);
		const invitation = await prisma.userInvitation.findUnique({
			where: { tokenHash },
		});
		if (!invitation) {
			throw new ConstructionError(
				"INVITATION_NOT_FOUND",
				"Convite invalido ou inexistente",
				404,
			);
		}
		if (invitation.acceptedAt) {
			throw new ConstructionError(
				"INVITATION_ALREADY_ACCEPTED",
				"Convite ja utilizado",
				409,
			);
		}
		if (invitation.revokedAt) {
			throw new ConstructionError(
				"INVITATION_REVOKED",
				"Convite revogado",
				409,
			);
		}
		if (invitation.expiresAt < new Date()) {
			throw new ConstructionError(
				"INVITATION_EXPIRED",
				"Convite expirado",
				410,
			);
		}
		if (invitation.email.toLowerCase() !== email.toLowerCase()) {
			throw new ConstructionError(
				"INVITATION_EMAIL_MISMATCH",
				"Convite destinado a outro email",
				403,
			);
		}
		if (!isAuthorizationRole(invitation.role)) {
			throw new ConstructionError(
				"INVITATION_INVALID_ROLE",
				"Convite com papel invalido",
				422,
			);
		}

		const role = invitation.role as AuthorizationRole;
		const persistedScope = invitation.scopeJson as UserScopeInput | null;
		const scope: UserScopeInput = {
			companyIds: persistedScope?.companyIds ?? [],
			organizationIds:
				persistedScope?.organizationIds ??
				(invitation.scopeType === "organization" ? [invitation.scopeId] : []),
			costCenterIds: persistedScope?.costCenterIds ?? [],
			workIds: persistedScope?.workIds ?? [],
		};
		assertInvitationScope(role, scope);
		await assertWorksHaveCenterAccess(scope);

		await prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: { role, workspaceId: invitation.workspaceId },
			});
			await tx.companyMembership.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});
			await tx.organizationMembership.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});
			await tx.costCenterMembership.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});
			await tx.workMembership.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});
			for (const organizationId of scope.organizationIds) {
				await tx.organizationMembership.upsert({
					where: {
						organizationId_userId: { organizationId, userId },
					},
					create: { organizationId, userId, role },
					update: { revokedAt: null, role },
				});
			}
			for (const costCenterId of scope.costCenterIds) {
				await tx.costCenterMembership.upsert({
					where: { costCenterId_userId: { costCenterId, userId } },
					create: { costCenterId, userId, role },
					update: { revokedAt: null, role },
				});
			}
			for (const workId of scope.workIds) {
				await tx.workMembership.upsert({
					where: { workId_userId: { workId, userId } },
					create: { workId, userId, role },
					update: { revokedAt: null, role },
				});
			}
			for (const companyId of scope.companyIds ?? []) {
				await tx.companyMembership.upsert({
					where: { companyId_userId: { companyId, userId } },
					create: { companyId, userId, role },
					update: { revokedAt: null, role },
				});
			}
			await tx.userInvitation.update({
				where: { id: invitation.id },
				data: { acceptedAt: new Date() },
			});
		});

		await prisma.session.deleteMany({ where: { userId } });

		return {
			accepted: true,
			role,
			scope,
		};
	},

	async resendInvitation(actorId: string, invitationId: string) {
		const invitation = await prisma.userInvitation.findUnique({
			where: { id: invitationId },
		});
		if (!invitation) {
			throw new ConstructionError("NOT_FOUND", "Convite nao encontrado", 404);
		}
		if (!isAuthorizationRole(invitation.role)) {
			throw new ConstructionError(
				"INVITATION_INVALID_ROLE",
				"Convite com papel invalido",
				422,
			);
		}
		const scope = (invitation.scopeJson as UserScopeInput | null) ?? {
			companyIds: [],
			organizationIds: [invitation.scopeId],
			costCenterIds: [],
			workIds: [],
		};
		await assertActorCanInvite(
			actorId,
			invitation.role as AuthorizationRole,
			scope,
		);
		if (invitation.acceptedAt) {
			throw new ConstructionError(
				"INVITATION_ALREADY_ACCEPTED",
				"Convite ja utilizado",
				409,
			);
		}

		const raw = Buffer.from(
			crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH)),
		).toString("base64url");
		const tokenHash = hashToken(raw);
		const expiresAt = new Date(
			Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
		);

		const updated = await prisma.$transaction(async (tx) => {
			await tx.userInvitation.update({
				where: { id: invitation.id },
				data: { revokedAt: new Date() },
			});
			return tx.userInvitation.create({
				data: {
					tokenHash,
					scopeType: invitation.scopeType,
					scopeId: invitation.scopeId,
					scopeJson:
						invitation.scopeJson === null
							? Prisma.JsonNull
							: (invitation.scopeJson as Prisma.InputJsonValue),
					role: invitation.role,
					email: invitation.email,
					expiresAt,
					createdBy: actorId,
					workspaceId: invitation.workspaceId,
				},
			});
		});

		return {
			id: updated.id,
			email: updated.email,
			role: updated.role,
			scope,
			expiresAt: updated.expiresAt.toISOString(),
			token: raw,
		};
	},

	async revokeInvitation(actorId: string, invitationId: string) {
		const invitation = await prisma.userInvitation.findUnique({
			where: { id: invitationId },
		});
		if (!invitation) {
			throw new ConstructionError("NOT_FOUND", "Convite nao encontrado", 404);
		}
		if (!isAuthorizationRole(invitation.role)) {
			throw new ConstructionError(
				"INVITATION_INVALID_ROLE",
				"Convite com papel invalido",
				422,
			);
		}
		const scope = (invitation.scopeJson as UserScopeInput | null) ?? {
			companyIds: [],
			organizationIds: [invitation.scopeId],
			costCenterIds: [],
			workIds: [],
		};
		await assertActorCanInvite(
			actorId,
			invitation.role as AuthorizationRole,
			scope,
		);
		if (invitation.acceptedAt) {
			throw new ConstructionError(
				"INVITATION_ALREADY_ACCEPTED",
				"Convite ja utilizado",
				409,
			);
		}

		await prisma.userInvitation.update({
			where: { id: invitation.id },
			data: { revokedAt: new Date() },
		});
		return { revoked: true };
	},

	async listInvitations(
		actorId: string,
		filters: { page?: number; limit?: number } = {},
	) {
		const page = filters.page ?? 1;
		const limit = filters.limit ?? 20;

		const actor = await prisma.user.findUnique({
			where: { id: actorId },
			select: {
				role: true,
				companyMemberships: {
					where: { revokedAt: null },
					select: { companyId: true },
				},
			},
		});
		let where = {};
		if (actor?.role !== "ADMIN") {
			const [memberships, companyOrganizations] = await Promise.all([
				prisma.organizationMembership.findMany({
					where: { userId: actorId, revokedAt: null },
					select: { organizationId: true },
				}),
				actor?.companyMemberships?.length
					? prisma.organization.findMany({
							where: {
								companyId: {
									in: actor.companyMemberships.map((m) => m.companyId),
								},
							},
							select: { id: true },
						})
					: Promise.resolve([]),
			]);
			const orgIds = [
				...new Set([
					...memberships.map((m) => m.organizationId),
					...companyOrganizations.map((organization) => organization.id),
				]),
			];
			if (orgIds.length === 0) {
				return buildPaginatedResponse([], 0, page, limit);
			}
			where = {
				OR: [
					{ createdBy: actorId },
					{
						scopeType: "organization",
						scopeId: { in: orgIds },
					},
				],
			};
		}

		const [data, total] = await Promise.all([
			prisma.userInvitation.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.userInvitation.count({ where }),
		]);

		return buildPaginatedResponse(
			data.map((invitation) => ({
				id: invitation.id,
				email: invitation.email,
				role: invitation.role,
				scope: invitation.scopeJson,
				expiresAt: invitation.expiresAt.toISOString(),
				acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
				revokedAt: invitation.revokedAt?.toISOString() ?? null,
				createdAt: invitation.createdAt.toISOString(),
			})),
			total,
			page,
			limit,
		);
	},
};
