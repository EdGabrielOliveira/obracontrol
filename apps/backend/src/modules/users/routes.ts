import { Elysia, t } from "elysia";
import { normalizeRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { resolveAuth } from "../../lib/resolve-auth";
import { invitationService } from "./invitation.service";
import { membershipRoles } from "./schema";
import { userService } from "./service";

const roleUnion = t.Union(membershipRoles.map((role) => t.Literal(role)));

const scopeShape = {
	companyIds: t.Optional(t.Array(t.String())),
	organizationIds: t.Array(t.String()),
	costCenterIds: t.Array(t.String()),
	workIds: t.Optional(t.Array(t.String())),
};

function normalizeScope(scope: {
	companyIds?: string[];
	organizationIds: string[];
	costCenterIds: string[];
	workIds?: string[];
}): {
	companyIds: string[];
	organizationIds: string[];
	costCenterIds: string[];
	workIds: string[];
} {
	return {
		companyIds: scope.companyIds ?? [],
		organizationIds: scope.organizationIds,
		costCenterIds: scope.costCenterIds,
		workIds: scope.workIds ?? [],
	};
}

/**
 * DEC-005: ADMIN e GERENTE podem administrar usuarios; o service valida a
 * delegacao (papel alvo e escopo) para cada operacao.
 */
function requireUserAdministration() {
	return new Elysia({ name: "require-user-administration" }).onBeforeHandle(
		{ as: "scoped" },
		(context) => {
			const user = (context as Record<string, unknown>).user as
				| { role?: string | null }
				| undefined;
			const role = normalizeRole(user?.role);
			if (role !== "ADMIN" && role !== "GERENTE") {
				throw new ConstructionError(
					"FORBIDDEN",
					"Voce nao tem permissao para administrar usuarios",
					403,
				);
			}
		},
	);
}

export const userRoutes = new Elysia({
	prefix: "/admin/users",
	name: "admin-users",
})
	.use(resolveAuth)
	.use(requireUserAdministration())
	.post(
		"/",
		async ({ body, user }) =>
			userService.create(
				{ ...body, scope: body.scope ? normalizeScope(body.scope) : undefined },
				{ actorId: user.id },
			),
		{
			body: t.Object({
				name: t.String(),
				email: t.String(),
				password: t.String({ minLength: 8 }),
				role: roleUnion,
				scope: t.Optional(
					t.Object({
						companyIds: t.Optional(t.Array(t.String())),
						organizationIds: t.Array(t.String()),
						costCenterIds: t.Array(t.String()),
						workIds: t.Optional(t.Array(t.String())),
					}),
				),
			}),
			detail: {
				tags: ["Admin"],
				summary: "Criar usuário ativo",
				description:
					"Cria um usuário ativo com papel e memberships dentro do escopo permitido pelo administrador.",
			},
		},
	)
	.get(
		"/",
		async ({ query, user, set }) => {
			// A lista administrativa depende da sessão e não deve ser
			// revalidada por ETag: alguns clientes transformam 304 em erro e
			// acabam exibindo uma lista vazia após o seed/login.
			set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
			set.headers.Pragma = "no-cache";
			const page = query.page ? Number(query.page) : 1;
			const limit = query.limit ? Number(query.limit) : 20;
			return userService.listScoped(user.id, page, limit);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Admin"],
				summary: "Listar usuários do escopo",
				description:
					"Lista os usuários visíveis ao ator autenticado, com paginação e memberships resumidas.",
			},
		},
	)
	.get(
		"/:id",
		async ({ params, user }) => userService.getByIdScoped(user.id, params.id),
		{
			detail: {
				tags: ["Admin"],
				summary: "Detalhar usuário",
				description:
					"Retorna os dados administrativos e o escopo efetivo de um usuário autorizado.",
			},
		},
	)
	.patch(
		"/:id",
		async ({ params, body, user }) =>
			userService.update(user.id, params.id, {
				...body,
				scope: body.scope ? normalizeScope(body.scope) : undefined,
			}),
		{
			body: t.Object({
				name: t.Optional(t.String()),
				role: t.Optional(roleUnion),
				scope: t.Optional(
					t.Object({
						companyIds: t.Optional(t.Array(t.String())),
						organizationIds: t.Array(t.String()),
						costCenterIds: t.Array(t.String()),
						workIds: t.Optional(t.Array(t.String())),
					}),
				),
			}),
			detail: {
				tags: ["Admin"],
				summary: "Atualizar usuário",
				description:
					"Atualiza os dados editáveis, o papel ou o escopo de um usuário autorizado.",
			},
		},
	)
	.delete(
		"/:id",
		async ({ params, user }) => {
			await userService.delete(user.id, params.id);
			return new Response(null, { status: 204 });
		},
		{
			detail: {
				tags: ["Admin"],
				summary: "Excluir usuário",
				description:
					"Exclui um usuário autorizado, suas sessões e memberships, registrando a operação na auditoria.",
			},
		},
	)
	.put(
		"/:id/scope",
		async ({ params, body, user }) =>
			userService.replaceScope(user.id, params.id, normalizeScope(body)),
		{
			body: t.Object(scopeShape),
			detail: {
				tags: ["Admin"],
				summary: "Substituir escopo do usuário",
				description:
					"Substitui integralmente as memberships de organização, centro de custo e obra do usuário.",
			},
		},
	)
	.post(
		"/invitations",
		async ({ body, user }) =>
			invitationService.createInvitation(user.id, {
				...body,
				scope: normalizeScope(body.scope),
			}),
		{
			body: t.Object({
				email: t.String({ format: "email" }),
				role: roleUnion,
				scope: t.Object(scopeShape),
			}),
			detail: {
				tags: ["Admin"],
				summary: "Criar convite",
				description:
					"Cria um convite de acesso com papel e escopo definidos pelo administrador.",
			},
		},
	)
	.get(
		"/invitations",
		async ({ query, user }) =>
			invitationService.listInvitations(user.id, {
				page: query.page ? Number(query.page) : 1,
				limit: query.limit ? Number(query.limit) : 20,
			}),
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Admin"],
				summary: "Listar convites",
				description:
					"Lista os convites visíveis ao administrador, com estado, validade e paginação.",
			},
		},
	)
	.post(
		"/invitations/:invitationId/resend",
		async ({ params, user }) =>
			invitationService.resendInvitation(user.id, params.invitationId),
		{
			detail: {
				tags: ["Admin"],
				summary: "Reenviar convite",
				description:
					"Reenvia um convite ainda elegível para o destinatário cadastrado.",
			},
		},
	)
	.post(
		"/invitations/:invitationId/revoke",
		async ({ params, user }) =>
			invitationService.revokeInvitation(user.id, params.invitationId),
		{
			detail: {
				tags: ["Admin"],
				summary: "Revogar convite",
				description: "Revoga um convite e impede sua aceitação posterior.",
			},
		},
	);

export const invitationAcceptRoutes = new Elysia({
	prefix: "/users/invitations",
	name: "user-invitations",
})
	.use(resolveAuth)
	.post(
		"/accept",
		async ({ body, user }) =>
			invitationService.acceptInvitation(user.id, user.email, body),
		{
			body: t.Object({
				token: t.String(),
			}),
			detail: {
				tags: ["Invitations"],
				summary: "Aceitar convite",
				description:
					"Aceita um convite válido para vincular o usuário ao escopo concedido.",
			},
		},
	);
