import type { Prisma } from "@prisma/client";
import { writeAudit } from "../../lib/audit-writer";
import type { AuthorizationRole } from "../../lib/authorization";
import { isAuthorizationRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { buildPaginatedResponse } from "../../lib/pagination";
import { hashPassword } from "../../lib/password-hasher";
import { prisma } from "../../lib/prisma";
import type {
	CreateUserInput,
	ReplaceScopeInput,
	UpdateUserInput,
	UserScopeInput,
} from "./schema";

function normalizeScope(scope?: Partial<UserScopeInput>): UserScopeInput {
	return {
		organizationIds: scope?.organizationIds ?? [],
		costCenterIds: scope?.costCenterIds ?? [],
		workIds: scope?.workIds ?? [],
	};
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	return (error as { code?: unknown }).code === "P2002";
}

function assertActorCanManage(
	actorRole: AuthorizationRole | null | undefined,
	actorOrganizationIds: string[],
	targetRole: AuthorizationRole,
	organizationIds: string[],
): void {
	if (actorRole === "ADMIN") return;
	if (actorRole !== "GERENTE") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Voce nao tem permissao para administrar usuarios",
			403,
		);
	}
	if (targetRole !== "GESTOR" && targetRole !== "SUPERVISOR") {
		throw new ConstructionError(
			"FORBIDDEN",
			"O Gerente so pode criar ou editar Gestores e Supervisores",
			403,
		);
	}
	const outside = organizationIds.filter(
		(id) => !actorOrganizationIds.includes(id),
	);
	if (outside.length > 0) {
		throw new ConstructionError(
			"FORBIDDEN",
			"Vinculo fora das organizacoes do Gerente",
			403,
		);
	}
}

function assertNoDuplicates(scope: UserScopeInput): void {
	const duplicate = (ids: string[]): string[] =>
		ids.filter((id, index) => ids.indexOf(id) !== index);
	const duplicatedOrganizations = duplicate(scope.organizationIds);
	const duplicatedCostCenters = duplicate(scope.costCenterIds);
	const duplicatedWorks = duplicate(scope.workIds);
	if (
		duplicatedOrganizations.length > 0 ||
		duplicatedCostCenters.length > 0 ||
		duplicatedWorks.length > 0
	) {
		throw new ConstructionError(
			"DUPLICATED_SCOPE_ENTRY",
			"Escopo contem vinculos duplicados: " +
				[
					duplicatedOrganizations.length > 0 ? "organizacoes" : "",
					duplicatedCostCenters.length > 0 ? "centros de custo" : "",
					duplicatedWorks.length > 0 ? "obras" : "",
				]
					.filter(Boolean)
					.join(", "),
			422,
		);
	}
}

async function assertValidScope(
	targetRole: AuthorizationRole,
	scope: UserScopeInput,
): Promise<void> {
	assertNoDuplicates(scope);

	if (targetRole === "ADMIN") return;

	if (scope.organizationIds.length === 0) {
		throw new ConstructionError(
			"ORGANIZATION_REQUIRED",
			"Usuario nao administrador exige vinculo com ao menos uma organizacao",
			422,
		);
	}

	const organizations = await prisma.organization.findMany({
		where: { id: { in: scope.organizationIds } },
		select: { id: true },
	});
	const validOrgIds = new Set(organizations.map((org) => org.id));
	const invalidOrg = scope.organizationIds.filter((id) => !validOrgIds.has(id));
	if (invalidOrg.length > 0) {
		throw new ConstructionError(
			"INVALID_ORGANIZATION",
			"Organizacao selecionada nao existe",
			422,
		);
	}
	if (targetRole === "GERENTE") return;

	const workIds = scope.workIds ?? [];
	if (scope.costCenterIds.length === 0 && workIds.length === 0) {
		throw new ConstructionError(
			"COST_CENTER_REQUIRED",
			`O papel ${targetRole} exige vinculo com ao menos um centro de custo ou obra`,
			422,
		);
	}

	const costCenters = await prisma.costCenter.findMany({
		where: { id: { in: scope.costCenterIds } },
		select: { id: true, organizationId: true },
	});
	const centersByOrg = new Map<string, string[]>();
	for (const cc of costCenters) {
		const list = centersByOrg.get(cc.organizationId) ?? [];
		list.push(cc.id);
		centersByOrg.set(cc.organizationId, list);
	}
	const unknown = scope.costCenterIds.filter(
		(id) => !costCenters.some((cc) => cc.id === id),
	);
	if (unknown.length > 0) {
		throw new ConstructionError(
			"INVALID_COST_CENTER",
			"Centro de custo selecionado nao existe",
			422,
		);
	}
	const orphan = scope.costCenterIds.filter(
		(id) =>
			!scope.organizationIds.some((orgId) =>
				(centersByOrg.get(orgId) ?? []).includes(id),
			),
	);
	if (orphan.length > 0) {
		throw new ConstructionError(
			"COST_CENTER_OUTSIDE_ORGANIZATION",
			"Centro de custo nao pertence a uma organizacao vinculada ao usuario",
			422,
		);
	}

	const works = await prisma.constructionWork.findMany({
		where: { id: { in: workIds } },
		select: {
			id: true,
			costCenter: { select: { id: true, organizationId: true } },
		},
	});
	const knownWorkIds = new Set(works.map((work) => work.id));
	if (workIds.some((id) => !knownWorkIds.has(id))) {
		throw new ConstructionError(
			"INVALID_WORK",
			"Obra selecionada nao existe",
			422,
		);
	}
	if (
		works.some(
			(work) => !scope.organizationIds.includes(work.costCenter.organizationId),
		)
	) {
		throw new ConstructionError(
			"WORK_OUTSIDE_ORGANIZATION",
			"Obra nao pertence a uma organizacao vinculada ao usuario",
			422,
		);
	}
	// Work membership so e valida com centro pai ativo (spec 6.1): cada obra
	// listada exige membership ativa do proprio centro no mesmo escopo.
	if (works.some((work) => !scope.costCenterIds.includes(work.costCenter.id))) {
		throw new ConstructionError(
			"WORK_WITHOUT_CENTER_ACCESS",
			"Obra exige vinculo com o centro de custo pai no mesmo escopo",
			422,
		);
	}
}

async function revokeSessions(userId: string): Promise<void> {
	await prisma.session.deleteMany({ where: { userId } });
}

const adminUserSelect = {
	id: true,
	name: true,
	email: true,
	role: true,
	emailVerified: true,
	createdAt: true,
	organizationMemberships: {
		select: {
			id: true,
			organizationId: true,
			role: true,
			revokedAt: true,
			organization: { select: { name: true } },
		},
	},
	costCenterMemberships: {
		select: {
			id: true,
			costCenterId: true,
			role: true,
			revokedAt: true,
			costCenter: { select: { name: true } },
		},
	},
	workMemberships: {
		select: {
			id: true,
			workId: true,
			role: true,
			revokedAt: true,
			work: { select: { name: true } },
		},
	},
} satisfies Prisma.UserSelect;

type AdminUserResponse = {
	id: string;
	name: string;
	email: string;
	role: string;
	emailVerified: boolean;
	createdAt: Date;
	organizationMemberships: Array<{
		id: string;
		organizationId: string;
		role: string;
		revokedAt: Date | null;
		organization: { name: string } | null;
	}>;
	costCenterMemberships: Array<{
		id: string;
		costCenterId: string;
		role: string;
		revokedAt: Date | null;
		costCenter: { name: string } | null;
	}>;
	workMemberships: Array<{
		id: string;
		workId: string;
		role: string;
		revokedAt: Date | null;
		work: { name: string } | null;
	}>;
};

function serializeAdminUser(user: AdminUserResponse): AdminUserResponse {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		emailVerified: user.emailVerified,
		createdAt: user.createdAt,
		organizationMemberships: (user.organizationMemberships ?? []).map(
			(membership) => ({
				id: membership.id,
				organizationId: membership.organizationId,
				role: membership.role,
				revokedAt: membership.revokedAt,
				organization: membership.organization
					? { name: membership.organization.name }
					: null,
			}),
		),
		costCenterMemberships: (user.costCenterMemberships ?? []).map(
			(membership) => ({
				id: membership.id,
				costCenterId: membership.costCenterId,
				role: membership.role,
				revokedAt: membership.revokedAt,
				costCenter: membership.costCenter
					? { name: membership.costCenter.name }
					: null,
			}),
		),
		workMemberships: (user.workMemberships ?? []).map((membership) => ({
			id: membership.id,
			workId: membership.workId,
			role: membership.role,
			revokedAt: membership.revokedAt,
			work: membership.work ? { name: membership.work.name } : null,
		})),
	};
}

type AdminScope = {
	organizationIds: string[];
	isGlobalAdmin: boolean;
};

/**
 * Escopo administrativo do ator: organizacoes que ele possui ou onde possui
 * membership ativa. Gerente herda o escopo administrativo das organizacoes
 * em que e Gerente.
 */
async function resolveAdminScope(actorId: string): Promise<AdminScope> {
	const actor = await prisma.user.findUnique({
		where: { id: actorId },
		select: { role: true, banned: true },
	});
	if (actor?.role === "ADMIN" && !actor.banned) {
		const orgs = await prisma.organization.findMany({
			select: { id: true },
		});
		return {
			organizationIds: orgs.map((org) => org.id),
			isGlobalAdmin: true,
		};
	}

	const [owned, memberships] = await Promise.all([
		prisma.organization.findMany({
			where: { ownerId: actorId },
			select: { id: true },
		}),
		prisma.organizationMembership.findMany({
			where: { userId: actorId, revokedAt: null },
			select: { organizationId: true },
		}),
	]);

	const organizationIds = [
		...new Set([
			...owned.map((org) => org.id),
			...memberships.map((m) => m.organizationId),
		]),
	];
	return { organizationIds, isGlobalAdmin: false };
}

function inScopeWhere(scope: AdminScope) {
	return {
		organizationMemberships: {
			some: { organizationId: { in: scope.organizationIds } },
		},
	};
}

async function assertUserInScope(
	actorId: string,
	userId: string,
	scope: AdminScope,
): Promise<void> {
	if (userId === actorId || scope.isGlobalAdmin) return;
	if (scope.organizationIds.length === 0) {
		throw notFoundUser();
	}
	const found = await prisma.user.findFirst({
		where: { id: userId, OR: [{ id: actorId }, inScopeWhere(scope)] },
		select: { id: true },
	});
	if (!found) throw notFoundUser();
}

function notFoundUser() {
	return new ConstructionError("NOT_FOUND", "Usuario nao encontrado", 404);
}

async function applyScope(
	tx: Prisma.TransactionClient,
	userId: string,
	scope: UserScopeInput,
): Promise<void> {
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
	for (const workId of scope.workIds ?? []) {
		await tx.workMembership.upsert({
			where: { workId_userId: { workId, userId } },
			create: { workId, userId, role: "GESTOR" },
			update: { revokedAt: null },
		});
	}
}

export const userService = {
	async create(input: CreateUserInput, ctx?: { actorId: string }) {
		const scope = normalizeScope(input.scope);
		await assertValidScope(input.role, scope);

		if (ctx?.actorId) {
			const actor = await prisma.user.findUnique({
				where: { id: ctx.actorId },
				select: { role: true },
			});
			if (!isAuthorizationRole(actor?.role)) {
				throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
			}
			const adminScope = await resolveAdminScope(ctx.actorId);
			const orgIds = scope.organizationIds;
			assertActorCanManage(
				actor?.role as AuthorizationRole,
				adminScope.organizationIds,
				input.role,
				orgIds,
			);
		}

		let userId: string;
		try {
			const passwordHash = await hashPassword(input.password);
			const user = await prisma.user.create({
				data: {
					id: `usr-${crypto.randomUUID()}`,
					name: input.name,
					email: input.email,
					emailVerified: true,
					role: input.role,
				},
			});
			await prisma.account.create({
				data: {
					id: `credential-${user.id}`,
					userId: user.id,
					accountId: user.id,
					providerId: "credential",
					issuer: "local:credential",
					password: passwordHash,
				},
			});
			userId = user.id;
		} catch (err) {
			if (isPrismaUniqueConstraintError(err)) {
				throw new ConstructionError(
					"EMAIL_ALREADY_EXISTS",
					"Ja existe uma conta com este email",
					409,
				);
			}
			throw new ConstructionError(
				"USER_CREATION_FAILED",
				err instanceof Error ? err.message : "Falha ao criar usuario",
				400,
			);
		}

		return prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: { role: input.role },
			});
			await applyScope(tx, userId, scope);
			if (ctx?.actorId) {
				await writeAudit(tx, {
					userId: ctx.actorId,
					ownerId: ctx.actorId,
					action: "CREATE",
					entityType: "USER",
					entityId: userId,
					entityDescription: input.email,
					newState: { role: input.role, scope: input.scope },
				});
			}
			return getByIdUnscoped(userId);
		});
	},

	async listScoped(actorId: string, page: number, limit: number) {
		const scope = await resolveAdminScope(actorId);
		if (!scope.isGlobalAdmin && scope.organizationIds.length === 0) {
			return buildPaginatedResponse([], 0, page, limit);
		}
		const skip = (page - 1) * limit;
		const where = scope.isGlobalAdmin
			? {}
			: { OR: [{ id: actorId }, inScopeWhere(scope)] };
		const [users, total] = await Promise.all([
			prisma.user.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: "desc" },
				select: adminUserSelect,
			}),
			prisma.user.count({ where }),
		]);
		return buildPaginatedResponse(
			users.map(serializeAdminUser),
			total,
			page,
			limit,
		);
	},

	async getByIdScoped(actorId: string, id: string) {
		const scope = await resolveAdminScope(actorId);
		await assertUserInScope(actorId, id, scope);
		const user = await prisma.user.findUnique({
			where: { id },
			select: adminUserSelect,
		});
		if (!user) throw notFoundUser();
		return serializeAdminUser(user);
	},

	async update(actorId: string, id: string, input: UpdateUserInput) {
		const actor = await prisma.user.findUnique({
			where: { id: actorId },
			select: { role: true },
		});
		if (!isAuthorizationRole(actor?.role)) {
			throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
		}
		const adminScope = await resolveAdminScope(actorId);
		await assertUserInScope(actorId, id, adminScope);

		const target = await prisma.user.findUnique({ where: { id } });
		if (!target) throw notFoundUser();

		const nextRole = (input.role ?? target.role) as AuthorizationRole;
		const scope = input.scope ? normalizeScope(input.scope) : undefined;
		if (scope) {
			await assertValidScope(nextRole, scope);
		}
		if (input.role) {
			const targetScope = await getCurrentScope(id);
			assertActorCanManage(
				actor?.role as AuthorizationRole,
				adminScope.organizationIds,
				input.role,
				targetScope.organizationIds,
			);
		} else if (scope) {
			assertActorCanManage(
				actor?.role as AuthorizationRole,
				adminScope.organizationIds,
				nextRole,
				scope.organizationIds,
			);
		}

		await prisma.$transaction(async (tx) => {
			const data: { name?: string; role?: string } = {};
			if (input.name) data.name = input.name;
			if (input.role) data.role = input.role;
			if (Object.keys(data).length > 0) {
				await tx.user.update({ where: { id }, data });
			}
			if (scope) {
				await applyScope(tx, id, scope);
			}
			if (input.role || input.scope) {
				await writeAudit(tx, {
					userId: actorId,
					ownerId: actorId,
					action: "UPDATE",
					entityType: "USER",
					entityId: id,
					entityDescription: target.email,
					previousState: { role: target.role },
					newState: { role: input.role ?? target.role, scope: input.scope },
				});
			}
		});

		// Mudanca de papel ou escopo invalida as sessoes do usuario alvo.
		await revokeSessions(id);

		return userService.getByIdScoped(actorId, id);
	},

	async delete(actorId: string, id: string): Promise<void> {
		if (actorId === id) {
			throw new ConstructionError(
				"FORBIDDEN",
				"Nao e permitido excluir o proprio usuario",
				403,
			);
		}

		const actor = await prisma.user.findUnique({
			where: { id: actorId },
			select: { role: true },
		});
		if (!isAuthorizationRole(actor?.role)) {
			throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
		}

		const adminScope = await resolveAdminScope(actorId);
		await assertUserInScope(actorId, id, adminScope);

		const target = await prisma.user.findUnique({
			where: { id },
			select: { email: true, role: true },
		});
		if (!target) throw notFoundUser();

		const targetScope = await getCurrentScope(id);
		assertActorCanManage(
			actor.role as AuthorizationRole,
			adminScope.organizationIds,
			target.role as AuthorizationRole,
			targetScope.organizationIds,
		);

		await prisma.$transaction(async (tx) => {
			await writeAudit(tx, {
				userId: actorId,
				ownerId: actorId,
				action: "DELETE",
				entityType: "USER",
				entityId: id,
				entityDescription: target.email,
				previousState: { role: target.role, scope: targetScope },
			});
			await tx.user.delete({ where: { id } });
		});
	},

	async replaceScope(
		actorId: string,
		userId: string,
		input: ReplaceScopeInput,
	) {
		const actor = await prisma.user.findUnique({
			where: { id: actorId },
			select: { role: true },
		});
		if (!isAuthorizationRole(actor?.role)) {
			throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
		}
		const adminScope = await resolveAdminScope(actorId);
		await assertUserInScope(actorId, userId, adminScope);

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target) throw notFoundUser();

		const targetRole = target.role as AuthorizationRole;
		const scope = normalizeScope(input);
		await assertValidScope(targetRole, scope);
		assertActorCanManage(
			actor?.role as AuthorizationRole,
			adminScope.organizationIds,
			targetRole,
			scope.organizationIds,
		);

		await prisma.$transaction(async (tx) => {
			await applyScope(tx, userId, scope);
			await writeAudit(tx, {
				userId: actorId,
				ownerId: actorId,
				action: "UPDATE",
				entityType: "USER_SCOPE",
				entityId: userId,
				entityDescription: target.email,
				newState: scope,
			});
		});

		await revokeSessions(userId);

		return userService.getByIdScoped(actorId, userId);
	},
};

async function getCurrentScope(userId: string): Promise<UserScopeInput> {
	const [organizations, costCenters, works] = await Promise.all([
		prisma.organizationMembership.findMany({
			where: { userId, revokedAt: null },
			select: { organizationId: true },
		}),
		prisma.costCenterMembership.findMany({
			where: { userId, revokedAt: null },
			select: { costCenterId: true },
		}),
		prisma.workMembership.findMany({
			where: { userId, revokedAt: null },
			select: { workId: true },
		}),
	]);
	return {
		organizationIds: organizations.map((m) => m.organizationId),
		costCenterIds: costCenters.map((m) => m.costCenterId),
		workIds: works.map((m) => m.workId),
	};
}

async function getByIdUnscoped(id: string) {
	const user = await prisma.user.findUnique({
		where: { id },
		select: adminUserSelect,
	});
	if (!user) throw notFoundUser();
	return serializeAdminUser(user);
}
