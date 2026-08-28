import { Elysia, t } from "elysia";
import {
	requireRole,
	requireScopedAccess,
} from "../../lib/authorization-middleware";
import { resolveAuth } from "../../lib/resolve-auth";
import { auditService } from "./audit.service";
import { auditCommentService } from "./comment.service";

export const auditRoutes = new Elysia({
	prefix: "/audit-logs",
	name: "audit-routes",
})
	.use(resolveAuth)
	.use(requireRole("audit"))
	.get(
		"/",
		async ({ query, user }) =>
			auditService.list({
				ownerId: user.id,
				workspaceId: user.workspaceId,
				entityType: query.entityType,
				entityTypes: query.entityTypes,
				entityId: query.entityId,
				userId: query.userId,
				userSearch: query.userSearch,
				action: query.action,
				actions: query.actions,
				fromDate: query.fromDate,
				toDate: query.toDate,
				companyId: query.companyId,
				organizationId: query.organizationId,
				costCenterId: query.costCenterId,
				workId: query.workId,
				page: query.page ? Number(query.page) : 1,
				limit: query.limit ? Number(query.limit) : 50,
			}),
		{
			query: t.Object({
				entityType: t.Optional(t.String()),
				entityTypes: t.Optional(t.String()),
				entityId: t.Optional(t.String()),
				userId: t.Optional(t.String()),
				userSearch: t.Optional(t.String()),
				action: t.Optional(t.String()),
				actions: t.Optional(t.String()),
				fromDate: t.Optional(t.String()),
				toDate: t.Optional(t.String()),
				companyId: t.Optional(t.String()),
				organizationId: t.Optional(t.String()),
				costCenterId: t.Optional(t.String()),
				workId: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Audit"],
				summary: "Listar logs de auditoria",
				description:
					"Consulta a trilha de auditoria do proprietário com filtros por entidade, ator, ação e hierarquia operacional.",
			},
		},
	)
	.use(
		requireScopedAccess(
			"read",
			(params) => ({ workId: params?.workId }),
			"Obra nao encontrada",
			"require-audit-work-read",
		),
	)
	.get(
		"/work/:workId",
		({ params, query, scope }) =>
			auditService.listForWork(scope.resourceOwnerId, params.workId, {
				entityType: query.entityType,
				entityTypes: query.entityTypes,
				action: query.action,
				actions: query.actions,
				userId: query.userId,
				userSearch: query.userSearch,
				fromDate: query.fromDate,
				toDate: query.toDate,
				page: query.page ? Number(query.page) : 1,
				limit: query.limit ? Number(query.limit) : 50,
			}),
		{
			params: t.Object({ workId: t.String({ minLength: 1 }) }),
			query: t.Object({
				entityType: t.Optional(t.String()),
				entityTypes: t.Optional(t.String()),
				action: t.Optional(t.String()),
				actions: t.Optional(t.String()),
				userId: t.Optional(t.String()),
				userSearch: t.Optional(t.String()),
				fromDate: t.Optional(t.String()),
				toDate: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Audit"],
				summary: "Listar histórico por obra",
				description:
					"Lista os eventos de auditoria pertencentes à obra e aos seus agregados, com filtros e paginação.",
			},
		},
	)
	.get(
		"/work/:workId/comments",
		({ params, query, scope }) =>
			auditCommentService.list(
				scope.resourceOwnerId,
				params.workId,
				query.auditLogId,
			),
		{
			params: t.Object({ workId: t.String({ minLength: 1 }) }),
			query: t.Object({ auditLogId: t.Optional(t.String()) }),
			detail: {
				tags: ["Audit"],
				summary: "Listar comentários da auditoria",
				description:
					"Lista os comentários da obra, opcionalmente filtrados pelo evento de auditoria relacionado.",
			},
		},
	)
	.use(requireRole("write"))
	.post(
		"/work/:workId/comments",
		({ params, body, user, scope }) =>
			auditCommentService.create(
				scope.resourceOwnerId,
				params.workId,
				user.id,
				body.body,
				body.auditLogId,
			),
		{
			params: t.Object({ workId: t.String({ minLength: 1 }) }),
			body: t.Object({ body: t.String(), auditLogId: t.Optional(t.String()) }),
			detail: {
				tags: ["Audit"],
				summary: "Adicionar comentário de auditoria",
				description:
					"Adiciona um comentário auditável à obra ou a um evento de auditoria específico.",
			},
		},
	)
	.patch(
		"/work/:workId/comments/:commentId",
		({ params, body, user, scope }) =>
			auditCommentService.update(
				scope.resourceOwnerId,
				params.workId,
				params.commentId,
				user.id,
				body.body,
			),
		{
			params: t.Object({
				workId: t.String({ minLength: 1 }),
				commentId: t.String({ minLength: 1 }),
			}),
			body: t.Object({ body: t.String() }),
			detail: {
				tags: ["Audit"],
				summary: "Editar comentário de auditoria",
				description:
					"Edita um comentário somente quando o ator autenticado é seu autor e permanece no escopo da obra.",
			},
		},
	)
	.delete(
		"/work/:workId/comments/:commentId",
		({ params, user, scope }) =>
			auditCommentService.remove(
				scope.resourceOwnerId,
				params.workId,
				params.commentId,
				user.id,
			),
		{
			params: t.Object({
				workId: t.String({ minLength: 1 }),
				commentId: t.String({ minLength: 1 }),
			}),
			detail: {
				tags: ["Audit"],
				summary: "Excluir comentário de auditoria",
				description:
					"Exclui um comentário quando o ator autenticado é seu autor e possui acesso à obra.",
			},
		},
	);
