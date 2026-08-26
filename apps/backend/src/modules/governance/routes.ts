import { Elysia, t } from "elysia";
import { normalizeRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { resolveAuth } from "../../lib/resolve-auth";
import { resolveResourceScope } from "../../lib/resource-scope";
import {
	decideApproval,
	listPendingApprovals,
	requestReversal,
} from "./approval.service";
import {
	governanceService,
	normalizeGovernanceRole,
} from "./governance.service";
import { resolveGovernanceTarget } from "./governance-target";
import { notificationService } from "./notification.service";

const governanceStatus = t.Union([
	t.Literal("RASCUNHO"),
	t.Literal("EM_REVISAO"),
	t.Literal("ACEITO"),
	t.Literal("TRAVADO"),
]);

type ResolvedGovernanceScope = {
	workId: string;
	ownerId: string;
	role: string | null;
	canRead: boolean;
	canWrite: boolean;
	canApprove: boolean;
};

type ApprovalRequestViewRow = {
	id: string;
	status: string;
	effectAction: string;
	actorId: string;
	actorRole: string;
	organizationId: string;
	costCenterId: string | null;
	resourceType: string;
	resourceId: string | null;
	requiredApproverRole: string;
	createdAt: Date;
	decisionReason: string | null;
	actorName: string | null;
	payloadJson: unknown;
};

function approvalDescription(payloadJson: unknown): string | null {
	const payload = payloadJson as {
		description?: unknown;
		title?: unknown;
	} | null;
	const description = payload?.description ?? payload?.title;
	return typeof description === "string" && description.trim()
		? description.trim()
		: null;
}

function approvalTarget(row: ApprovalRequestViewRow) {
	const payload = row.payloadJson as { workId?: unknown } | null;
	const workId = typeof payload?.workId === "string" ? payload.workId : null;
	const encodedWorkId = workId ? encodeURIComponent(workId) : null;
	const encodedResourceId = row.resourceId
		? encodeURIComponent(row.resourceId)
		: null;

	if (
		row.effectAction === "WORK_MEASUREMENT_APPROVE" &&
		encodedWorkId &&
		encodedResourceId
	) {
		return {
			label: "Medição da obra",
			path: `/app/obras/${encodedWorkId}/medicoes/${encodedResourceId}`,
		};
	}
	if (
		row.effectAction === "COST_APPROVE" &&
		encodedWorkId &&
		encodedResourceId
	) {
		return {
			label: "Custo da obra",
			path: `/app/obras/${encodedWorkId}/custos/${encodedResourceId}`,
		};
	}
	return {
		label: "Solicitação da obra",
		path: encodedWorkId ? `/app/obras/${encodedWorkId}/aprovacoes` : null,
	};
}

function toApprovalRequestView(row: ApprovalRequestViewRow) {
	const target = approvalTarget(row);
	return {
		id: row.id,
		status: row.status,
		effectAction: row.effectAction,
		actor: {
			id: row.actorId,
			name: row.actorName ?? "",
			role: row.actorRole,
		},
		scope: {
			organizationId: row.organizationId,
			costCenterId: row.costCenterId,
			resourceType: row.resourceType,
			resourceId: row.resourceId,
		},
		target,
		description: approvalDescription(row.payloadJson),
		requiredApproverRole: row.requiredApproverRole,
		createdAt: row.createdAt.toISOString(),
		decisionReason: row.decisionReason,
	};
}

async function resolveGovernanceScope(
	actorId: string,
	actorRole: string | null | undefined,
	actorWorkspaceId: string | null | undefined,
	entityType: string,
	entityId: string,
): Promise<ResolvedGovernanceScope> {
	const target = await resolveGovernanceTarget(entityType, entityId);
	if (!target) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Entidade de governanca nao encontrada",
			404,
		);
	}
	const scope = await resolveResourceScope(actorId, { workId: target.workId });
	// Obras legadas podem ter uma cadeia organizacional incompleta (por
	// exemplo, centro de custo removido). O Admin ainda deve conseguir
	// governar o recurso real dentro do próprio workspace. A exceção é
	// limitada ao workspace da obra e não amplia acesso entre workspaces.
	if (
		!scope.canRead &&
		normalizeRole(actorRole) === "ADMIN" &&
		target.resourceOwnerId &&
		target.workspaceId === (actorWorkspaceId ?? null)
	) {
		return {
			workId: target.workId,
			ownerId: target.resourceOwnerId,
			role: "ADMIN",
			canRead: true,
			canWrite: true,
			canApprove: true,
		};
	}
	return {
		workId: target.workId,
		ownerId: target.resourceOwnerId ?? scope.resourceOwnerId,
		role: scope.role,
		canRead: scope.canRead,
		canWrite: scope.canWrite,
		canApprove: scope.canApprove,
	};
}

export const governanceRoutes = new Elysia({
	prefix: "/governance",
	name: "governance-routes",
})
	.use(resolveAuth)
	.get(
		"/:entityType/:entityId",
		async ({ params, user }) => {
			const resolved = await resolveGovernanceScope(
				user.id,
				user.role,
				user.workspaceId,
				params.entityType,
				params.entityId,
			);
			if (!resolved.canRead) {
				throw new ConstructionError(
					"FORBIDDEN",
					"Voce nao tem permissao para consultar esta entidade",
					403,
				);
			}
			return governanceService.get(
				resolved.ownerId,
				params.entityType,
				params.entityId,
			);
		},
		{
			detail: {
				tags: ["Governance"],
				summary: "Consultar estado de governança de uma entidade",
				description:
					"Retorna o estado de governança, a versão e a última decisão da entidade dentro do escopo autorizado.",
			},
		},
	)
	.post(
		"/:entityType/:entityId/transition",
		async ({ params, body, user }) => {
			const resolved = await resolveGovernanceScope(
				user.id,
				user.role,
				user.workspaceId,
				params.entityType,
				params.entityId,
			);
			if (
				(!resolved.canWrite && !resolved.canApprove) ||
				normalizeGovernanceRole(resolved.role) === "SUPERVISOR"
			) {
				throw new ConstructionError(
					"FORBIDDEN",
					"Voce nao tem permissao para alterar o estado de governanca",
					403,
				);
			}
			return governanceService.transition({
				ownerId: resolved.ownerId,
				userId: user.id,
				entityType: params.entityType,
				entityId: params.entityId,
				toStatus: body.toStatus,
				role: normalizeGovernanceRole(resolved.role),
				reason: body.reason,
				override: body.override,
			});
		},
		{
			body: t.Object({
				toStatus: governanceStatus,
				reason: t.Optional(t.String({ maxLength: 1000 })),
				override: t.Optional(t.Boolean()),
			}),
			detail: {
				tags: ["Governance"],
				summary: "Solicitar transição de governança",
				description:
					"Solicita ou executa a transição de estado conforme o papel, o escopo e a política de governança vigentes.",
			},
		},
	)
	.get(
		"/approvals/pending",
		async ({ query, user }) => {
			const rows = await listPendingApprovals(user.id, query.workId);
			return rows.map((row) =>
				toApprovalRequestView({
					id: row.id,
					status: row.status,
					effectAction: row.effectAction,
					actorId: row.actorId,
					actorRole: row.actorRole,
					organizationId: row.organizationId,
					costCenterId: row.costCenterId,
					resourceType: row.resourceType,
					resourceId: row.resourceId,
					requiredApproverRole: row.requiredApproverRole,
					createdAt: row.createdAt,
					decisionReason: row.decisions?.[0]?.reason ?? null,
					actorName: row.actor?.name ?? null,
					payloadJson: row.payloadJson,
				}),
			);
		},
		{
			query: t.Object({
				workId: t.Optional(t.String({ minLength: 1 })),
			}),
			detail: {
				tags: ["Governance"],
				summary: "Listar solicitações de aprovação pendentes",
				description:
					"Lista as solicitações de aprovação pendentes visíveis ao ator, com destino interno para acompanhamento.",
			},
		},
	)
	.post(
		"/approvals/:requestId/decide",
		({ params, body, user }) =>
			decideApproval({
				approverId: user.id,
				requestId: params.requestId,
				decision: body.decision,
				reason: body.reason,
			}),
		{
			body: t.Object({
				decision: t.Union([t.Literal("APPROVE"), t.Literal("REJECT")]),
				reason: t.Optional(t.String({ maxLength: 1000 })),
			}),
			detail: {
				tags: ["Governance"],
				summary: "Decidir solicitação de aprovação",
				description:
					"Registra a decisão do aprovador e aplica o efeito somente quando a política de revisão estiver satisfeita.",
			},
		},
	)
	.get(
		"/notifications",
		({ query, user }) =>
			notificationService.list(user.id, {
				status: query.status as "PENDING" | "READ" | "DISMISSED" | undefined,
				page: query.page ? Number(query.page) : 1,
				limit: query.limit ? Number(query.limit) : 20,
			}),
		{
			query: t.Object({
				status: t.Optional(
					t.Union([
						t.Literal("PENDING"),
						t.Literal("READ"),
						t.Literal("DISMISSED"),
					]),
				),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Governance"],
				summary: "Listar notificações do usuário",
				description:
					"Lista as notificações do usuário autenticado, filtradas por estado e paginadas.",
			},
		},
	)
	.post(
		"/approvals/:requestId/reversal",
		async ({ params, body, user }) =>
			requestReversal({
				actorId: user.id,
				requestId: params.requestId,
				reason: body.reason,
				expectedVersion: body.expectedVersion,
			}),
		{
			body: t.Object({
				reason: t.String({ minLength: 1, maxLength: 1000 }),
				expectedVersion: t.Number(),
			}),
			detail: {
				tags: ["Governance"],
				summary: "Solicitar reversão compensatória de uma execução",
				description:
					"Solicita a reversão auditável de uma execução aprovada, sujeita à validação de versão e dependências.",
			},
		},
	)
	.get(
		"/notifications/pending-count",
		({ user }) => notificationService.pendingCount(user.id),
		{
			detail: {
				tags: ["Governance"],
				summary: "Contador de notificações pendentes",
				description:
					"Retorna a quantidade de notificações pendentes pertencentes ao usuário autenticado.",
			},
		},
	)
	.post(
		"/notifications/:notificationId/read",
		({ params, user }) =>
			notificationService.markRead(user.id, params.notificationId),
		{
			detail: {
				tags: ["Governance"],
				summary: "Marcar notificação como lida",
				description:
					"Marca como lida uma notificação pertencente ao usuário autenticado.",
			},
		},
	)
	.post(
		"/notifications/:notificationId/dismiss",
		({ params, user }) =>
			notificationService.markDismissed(user.id, params.notificationId),
		{
			detail: {
				tags: ["Governance"],
				summary: "Descartar notificação",
				description:
					"Descarta uma notificação pertencente ao usuário autenticado.",
			},
		},
	);
