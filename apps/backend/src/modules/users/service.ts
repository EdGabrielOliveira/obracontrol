import type { Prisma } from "@prisma/client";
import { writeAudit } from "../../lib/audit-writer";
import type { AuthorizationRole } from "../../lib/authorization";
import { isAuthorizationRole, normalizeRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { buildPaginatedResponse } from "../../lib/pagination";
import { hashPassword } from "../../lib/password-hasher";
import { prisma } from "../../lib/prisma";
import { createWorkspace, ensureWorkspaceForUser } from "../../lib/workspace";
import type {
	CreateUserInput,
	ReplaceScopeInput,
	UpdateUserInput,
	UserScopeInput,
} from "./schema";

function normalizeScope(scope?: Partial<UserScopeInput>): UserScopeInput {
	return {
		companyIds: scope?.companyIds ?? [],
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
	const duplicatedCompanies = duplicate(scope.companyIds ?? []);
	const duplicatedCostCenters = duplicate(scope.costCenterIds);
	const duplicatedWorks = duplicate(scope.workIds);
	if (
		duplicatedCompanies.length > 0 ||
		duplicatedOrganizations.length > 0 ||
		duplicatedCostCenters.length > 0 ||
		duplicatedWorks.length > 0
	) {
		throw new ConstructionError(
			"DUPLICATED_SCOPE_ENTRY",
			"Escopo contem vinculos duplicados: " +
				[
					duplicatedCompanies.length > 0 ? "empresas" : "",
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

	const companyIds = scope.companyIds ?? [];
	if (
		targetRole === "GERENTE" &&
		companyIds.length === 0 &&
		scope.organizationIds.length === 0
	) {
		throw new ConstructionError(
			"ORGANIZATION_REQUIRED",
			"Gerente exige vinculo com ao menos uma empresa ou organizacao",
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
			"Gestor exige ao menos uma organizacao, centro de custo ou obra",
			422,
		);
	}
	if (targetRole === "GESTOR" && companyIds.length > 0) {
		throw new ConstructionError(
			"GESTOR_SCOPE_INVALID",
			"Gestor deve ser vinculado por organizacao, centro de custo ou obra",
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
	const companies = await prisma.company.findMany({
		where: { id: { in: companyIds } },
		select: { id: true },
	});
	if (companies.length !== companyIds.length) {
		throw new ConstructionError(
			"INVALID_COMPANY",
			"Empresa selecionada nao existe",
			422,
		);
	}

	const organizations = await prisma.organization.findMany({
		where: { id: { in: scope.organizationIds } },
		select: { id: true, companyId: true },
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
	const selectedCompanies = new Set(scope.companyIds);
	if (
		selectedCompanies.size > 0 &&
		organizations.some(
			(org) => org.companyId && !selectedCompanies.has(org.companyId),
		)
	) {
		throw new ConstructionError(
			"ORGANIZATION_OUTSIDE_COMPANY",
			"Organizacao nao pertence a empresa vinculada",
			422,
		);
	}
	if (targetRole === "GERENTE") {
		if (scope.costCenterIds.length > 0 || scope.workIds.length > 0) {
			throw new ConstructionError(
				"GERENTE_SCOPE_INVALID",
				"Gerente deve ser vinculado por empresa ou organizacao",
				422,
			);
		}
		return;
	}

	const workIds = scope.workIds ?? [];
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
	const orphan =
		scope.organizationIds.length > 0
			? scope.costCenterIds.filter(
					(id) =>
						!scope.organizationIds.some((orgId) =>
							(centersByOrg.get(orgId) ?? []).includes(id),
						),
				)
			: [];
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
	const allowedWorkOrganizations = new Set([
		...scope.organizationIds,
		...costCenters.map((cc) => cc.organizationId),
	]);
	if (
		allowedWorkOrganizations.size > 0 &&
		works.some(
			(work) => !allowedWorkOrganizations.has(work.costCenter.organizationId),
		)
	) {
		throw new ConstructionError(
			"WORK_OUTSIDE_ORGANIZATION",
			"Obra nao pertence a uma organizacao vinculada ao usuario",
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
	workspaceId: true,
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
	companyMemberships: {
		select: {
			id: true,
			companyId: true,
			role: true,
			revokedAt: true,
			company: { select: { name: true } },
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
	companyMemberships: Array<{
		id: string;
		companyId: string;
		role: string;
		revokedAt: Date | null;
		company: { name: string } | null;
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
		companyMemberships: (user.companyMemberships ?? []).map((membership) => ({
			id: membership.id,
			companyId: membership.companyId,
			role: membership.role,
			revokedAt: membership.revokedAt,
			company: membership.company ? { name: membership.company.name } : null,
		})),
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
	companyIds: string[];
	organizationIds: string[];
	isGlobalAdmin: boolean;
	workspaceId: string | null;
};

/**
 * Escopo administrativo do ator: organizacoes que ele possui ou onde possui
 * membership ativa. Gerente herda o escopo administrativo das organizacoes
 * em que e Gerente.
 */
async function resolveAdminScope(actorId: string): Promise<AdminScope> {
	const actor = await prisma.user.findUnique({
		where: { id: actorId },
		select: { role: true, banned: true, workspaceId: true },
	});
	if (!actor || actor.banned) {
		return {
			companyIds: [],
			organizationIds: [],
			isGlobalAdmin: false,
			workspaceId: null,
		};
	}
	if (normalizeRole(actor.role) === "ADMIN") {
		const orgs = await prisma.organization.findMany({
			where: actor.workspaceId ? { workspaceId: actor.workspaceId } : undefined,
			select: { id: true },
		});
		return {
			companyIds: [],
			organizationIds: orgs.map((org) => org.id),
			isGlobalAdmin: true,
			workspaceId: actor.workspaceId ?? null,
		};
	}

	const workspaceFilter = actor.workspaceId
		? { workspaceId: actor.workspaceId }
		: { workspaceId: null };
	const [owned, memberships, companyMemberships] = await Promise.all([
		prisma.organization.findMany({
			where: { ownerId: actorId, ...workspaceFilter },
			select: { id: true },
		}),
		prisma.organizationMembership.findMany({
			where: {
				userId: actorId,
				revokedAt: null,
				organization: workspaceFilter,
			},
			select: { organizationId: true },
		}),
		prisma.companyMembership.findMany({
			where: {
				userId: actorId,
				revokedAt: null,
				company: workspaceFilter,
			},
			select: {
				companyId: true,
				company: { select: { organizations: { select: { id: true } } } },
			},
		}),
	]);

	const organizationIds = [
		...new Set([
			...owned.map((org) => org.id),
			...memberships.map((m) => m.organizationId),
			...companyMemberships.flatMap((m) =>
				m.company.organizations.map((o) => o.id),
			),
		]),
	];
	return {
		companyIds: companyMemberships.map((m) => m.companyId),
		organizationIds,
		isGlobalAdmin: false,
		workspaceId: null,
	};
}

function assertAdminWorkspace(
	scope: AdminScope,
	targetWorkspaceId?: string | null,
) {
	if (
		scope.isGlobalAdmin &&
		scope.workspaceId !== null &&
		targetWorkspaceId !== scope.workspaceId
	) {
		throw notFoundUser();
	}
}

function inScopeWhere(scope: AdminScope) {
	return {
		OR: [
			...(scope.organizationIds.length > 0
				? [
						{
							organizationMemberships: {
								some: { organizationId: { in: scope.organizationIds } },
							},
						},
					]
				: []),
			...(scope.companyIds.length > 0
				? [
						{
							companyMemberships: {
								some: { companyId: { in: scope.companyIds } },
							},
						},
					]
				: []),
			...(scope.organizationIds.length > 0
				? [
						{
							costCenterMemberships: {
								some: {
									costCenter: { organizationId: { in: scope.organizationIds } },
								},
							},
						},
						{
							workMemberships: {
								some: {
									work: {
										costCenter: {
											organizationId: { in: scope.organizationIds },
										},
									},
								},
							},
						},
					]
				: []),
		],
	};
}

async function assertUserInScope(
	actorId: string,
	userId: string,
	scope: AdminScope,
): Promise<void> {
	if (userId === actorId) return;
	if (scope.isGlobalAdmin) return;
	if (scope.organizationIds.length === 0 && scope.companyIds.length === 0) {
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
	role: AuthorizationRole,
): Promise<void> {
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
	for (const workId of scope.workIds ?? []) {
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
}

export const userService = {
	async create(input: CreateUserInput, ctx?: { actorId: string }) {
		const scope = normalizeScope(input.scope);
		await assertValidScope(input.role, scope);
		let inheritedWorkspaceId: string | null = null;

		if (ctx?.actorId) {
			const actor = await prisma.user.findUnique({
				where: { id: ctx.actorId },
				select: { role: true },
			});
			const actorRole = normalizeRole(actor?.role);
			if (!isAuthorizationRole(actorRole)) {
				throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
			}
			const adminScope = await resolveAdminScope(ctx.actorId);
			const orgIds = await resolveScopeOrganizationIds(scope);
			assertActorCanManage(
				actorRole as AuthorizationRole,
				adminScope.organizationIds,
				input.role,
				orgIds,
			);
			inheritedWorkspaceId = await ensureWorkspaceForUser(ctx.actorId);
		}

		let userId: string;
		try {
			const passwordHash = await hashPassword(input.password);
			const workspaceId =
				inheritedWorkspaceId ?? (await createWorkspace(`Conta ${input.name}`));
			const user = await prisma.user.create({
				data: {
					id: `usr-${crypto.randomUUID()}`,
					name: input.name,
					email: input.email,
					emailVerified: true,
					role: input.role,
					...(workspaceId ? { workspaceId } : {}),
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
			await applyScope(tx, userId, scope, input.role);
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
		const actor = await prisma.user.findUnique({
			where: { id: actorId },
			select: { workspaceId: true },
		});
		const where = scope.isGlobalAdmin
			? actor?.workspaceId
				? { workspaceId: actor.workspaceId }
				: {}
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
		assertAdminWorkspace(
			scope,
			(user as { workspaceId?: string | null }).workspaceId,
		);
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
		assertAdminWorkspace(adminScope, target.workspaceId);

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
				await resolveScopeOrganizationIds(targetScope),
			);
		} else if (scope) {
			assertActorCanManage(
				actor?.role as AuthorizationRole,
				adminScope.organizationIds,
				nextRole,
				await resolveScopeOrganizationIds(scope),
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
				await applyScope(tx, id, scope, nextRole);
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
			select: { email: true, role: true, workspaceId: true },
		});
		if (!target) throw notFoundUser();
		assertAdminWorkspace(adminScope, target.workspaceId);
		if (target.role === "ADMIN") {
			const activeAdmins = await prisma.user.count({
				where: {
					role: "ADMIN",
					banned: false,
					...(target.workspaceId ? { workspaceId: target.workspaceId } : {}),
				},
			});
			if (activeAdmins <= 1) {
				throw new ConstructionError(
					"LAST_ADMIN_REQUIRED",
					"Nao e permitido excluir o ultimo administrador ativo do workspace",
					409,
				);
			}
		}

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
		assertAdminWorkspace(adminScope, target.workspaceId);

		const targetRole = target.role as AuthorizationRole;
		const scope = normalizeScope(input);
		await assertValidScope(targetRole, scope);
		assertActorCanManage(
			actor?.role as AuthorizationRole,
			adminScope.organizationIds,
			targetRole,
			await resolveScopeOrganizationIds(scope),
		);

		await prisma.$transaction(async (tx) => {
			await applyScope(tx, userId, scope, targetRole);
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
	const [companies, organizations, costCenters, works] = await Promise.all([
		prisma.companyMembership.findMany({
			where: { userId, revokedAt: null },
			select: { companyId: true },
		}),
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
		companyIds: companies.map((m) => m.companyId),
		organizationIds: organizations.map((m) => m.organizationId),
		costCenterIds: costCenters.map((m) => m.costCenterId),
		workIds: works.map((m) => m.workId),
	};
}

async function resolveScopeOrganizationIds(
	scope: UserScopeInput,
): Promise<string[]> {
	const [centers, works] = await Promise.all([
		prisma.costCenter.findMany({
			where: { id: { in: scope.costCenterIds } },
			select: { organizationId: true },
		}),
		prisma.constructionWork.findMany({
			where: { id: { in: scope.workIds } },
			select: { costCenter: { select: { organizationId: true } } },
		}),
	]);
	return [
		...new Set([
			...scope.organizationIds,
			...centers.map((center) => center.organizationId),
			...works.map((work) => work.costCenter.organizationId),
		]),
	];
}

async function getByIdUnscoped(id: string) {
	const user = await prisma.user.findUnique({
		where: { id },
		select: adminUserSelect,
	});
	if (!user) throw notFoundUser();
	return serializeAdminUser(user);
}
