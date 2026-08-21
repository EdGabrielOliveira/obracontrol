import { createHash } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import type { AuthorizationRole } from "../../lib/authorization";
import { isAuthorizationRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { buildPaginatedResponse } from "../../lib/pagination";
import { prisma } from "../../lib/prisma";
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
	const memberships = await prisma.organizationMembership.findMany({
		where: { userId: actorId, revokedAt: null },
		select: { organizationId: true },
	});
	const allowed = new Set(memberships.map((m) => m.organizationId));
	if (scope.organizationIds.some((id) => !allowed.has(id))) {
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
	if (targetRole === "ADMIN") return;
	if (scope.organizationIds.length === 0) {
		throw new ConstructionError(
			"ORGANIZATION_REQUIRED",
			"Convite exige ao menos uma organizacao",
			422,
		);
	}
	if (
		(targetRole === "GESTOR" || targetRole === "SUPERVISOR") &&
		scope.costCenterIds.length === 0 &&
		scope.workIds.length === 0
	) {
		throw new ConstructionError(
			"COST_CENTER_REQUIRED",
			`O papel ${targetRole} exige vinculo com ao menos um centro de custo ou obra`,
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
	if (works.some((work) => !scope.costCenterIds.includes(work.costCenterId))) {
		throw new ConstructionError(
			"WORK_WITHOUT_CENTER_ACCESS",
			"Obra do convite exige vinculo com o centro de custo pai no mesmo escopo",
			422,
		);
	}
}

export const invitationService = {
	async createInvitation(actorId: string, input: CreateInvitationInput) {
		const scope: UserScopeInput = {
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
		const scope = (invitation.scopeJson as UserScopeInput | null) ?? {
			organizationIds:
				invitation.scopeType === "organization" ? [invitation.scopeId] : [],
			costCenterIds: [],
			workIds: [],
		};
		assertInvitationScope(role, scope);
		await assertWorksHaveCenterAccess(scope);

		await prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: { role },
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
					create: { organizationId, userId, role: "GERENTE" },
					update: { revokedAt: null },
				});
			}
			for (const costCenterId of scope.costCenterIds) {
				await tx.costCenterMembership.upsert({
					where: { costCenterId_userId: { costCenterId, userId } },
					create: { costCenterId, userId, role: "GESTOR" },
					update: { revokedAt: null },
				});
			}
			for (const workId of scope.workIds) {
				await tx.workMembership.upsert({
					where: { workId_userId: { workId, userId } },
					create: { workId, userId, role: "GESTOR" },
					update: { revokedAt: null },
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
			select: { role: true },
		});
		let where = {};
		if (actor?.role !== "ADMIN") {
			const memberships = await prisma.organizationMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: { organizationId: true },
			});
			const orgIds = memberships.map((m) => m.organizationId);
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
