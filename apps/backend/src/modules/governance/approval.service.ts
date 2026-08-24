import { Prisma } from "../../../generated/prisma/client";
import { writeAudit } from "../../lib/audit-writer";
import type { AuthorizationRole } from "../../lib/authorization";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import { withSerializableRetry } from "../../lib/transaction-retry";
import type {
	ApprovalDecisionMode,
	ApprovalEffectHandler,
	ApprovalRequest,
	ApprovalRequestStatus,
} from "./approval.types";
import { hashApprovalPayload, requiredApproverRoleFor } from "./approval.types";
import { approvalEffectHandlers } from "./approval-effect-handlers";
import { notificationService } from "./notification.service";

const effectHandlers = new Map<string, ApprovalEffectHandler>();

for (const handler of approvalEffectHandlers) {
	effectHandlers.set(handler.action, handler);
}

export function registerApprovalEffectHandler(handler: ApprovalEffectHandler) {
	effectHandlers.set(handler.action, handler);
}

function toRequestView(row: Record<string, unknown>): ApprovalRequest {
	return {
		id: String(row.id),
		ownerId: String(row.ownerId),
		actorId: String(row.actorId),
		actorRole: String(row.actorRole) as AuthorizationRole,
		organizationId: String(row.organizationId),
		costCenterId: row.costCenterId ? String(row.costCenterId) : null,
		resourceType: String(row.resourceType),
		resourceId: row.resourceId ? String(row.resourceId) : null,
		commandId: row.commandId ? String(row.commandId) : null,
		effectAction: String(row.effectAction),
		payloadJson: row.payloadJson,
		payloadHash: String(row.payloadHash),
		expectedVersion: Number(row.expectedVersion),
		idempotencyKey: String(row.idempotencyKey),
		requiredApproverRole: String(row.requiredApproverRole) as
			| "GERENTE"
			| "GESTOR",
		status: String(row.status) as ApprovalRequestStatus,
		decidedAt: row.decidedAt ? String(row.decidedAt) : null,
		executedAt: row.executedAt ? String(row.executedAt) : null,
		conflictReason: row.conflictReason ? String(row.conflictReason) : null,
	};
}

type SubmitApprovalInput<T> = {
	actorId: string;
	resourceType: string;
	resourceId: string | null;
	effectAction: string;
	payload: T;
	expectedVersion: number;
	idempotencyKey: string;
	commandId?: string | null;
	organizationId?: string;
	costCenterId?: string | null;
};

function resolveSubmitResource(input: SubmitApprovalInput<unknown>): {
	workId: string | null;
	costCenterId: string | null;
	organizationId: string | null;
} {
	const payload = input.payload as {
		workId?: unknown;
		costCenterId?: unknown;
		organizationId?: unknown;
	};
	const workId =
		typeof payload.workId === "string" && payload.workId.length > 0
			? payload.workId
			: input.resourceType === "WORK"
				? input.resourceId
				: null;
	const costCenterId =
		typeof payload.costCenterId === "string" && payload.costCenterId.length > 0
			? payload.costCenterId
			: typeof input.costCenterId === "string" && input.costCenterId.length > 0
				? input.costCenterId
				: null;
	const organizationId =
		typeof payload.organizationId === "string" &&
		payload.organizationId.length > 0
			? payload.organizationId
			: typeof input.organizationId === "string" &&
					input.organizationId.length > 0
				? input.organizationId
				: null;
	return { workId, costCenterId, organizationId };
}

export async function submitApproval<T>(
	input: SubmitApprovalInput<T>,
): Promise<{
	status: "APPROVED" | "PENDING";
	approvalRequestId: string | null;
	requiredApproverRole?: "GERENTE" | "GESTOR" | null;
	data?: unknown;
	scope?: { organizationId: string; costCenterId: string | null };
}> {
	const handler = effectHandlers.get(input.effectAction);
	if (!handler) {
		throw new ConstructionError(
			"UNSUPPORTED_EFFECT_ACTION",
			`Efeito de aprovacao nao registrado: ${input.effectAction}`,
			422,
		);
	}

	const { workId, costCenterId, organizationId } = resolveSubmitResource(input);
	const resource = workId
		? { workId }
		: costCenterId
			? { costCenterId }
			: { organizationId: organizationId ?? input.resourceId ?? "" };

	const scope = await resolveResourceScope(input.actorId, resource);
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}

	const actorRole = scope.role;
	if (!actorRole) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const isTrustedRole = actorRole === "ADMIN" || actorRole === "GERENTE";

	const payloadHash = hashApprovalPayload(input.payload);
	const existing = await prisma.approvalRequest.findUnique({
		where: {
			effectAction_resourceId_idempotencyKey: {
				effectAction: input.effectAction,
				resourceId: input.resourceId ?? "",
				idempotencyKey: input.idempotencyKey,
			},
		},
	});
	if (existing) {
		if (
			existing.actorId !== input.actorId ||
			existing.payloadHash !== payloadHash ||
			existing.expectedVersion !== input.expectedVersion
		) {
			throw new ConstructionError(
				"APPROVAL_IDEMPOTENCY_CONFLICT",
				"A chave de idempotencia ja foi usada com outra solicitacao",
				409,
			);
		}
		if (existing.status === "APPROVED" || existing.status === "EXECUTED") {
			return {
				status: "APPROVED",
				approvalRequestId: existing.id,
			};
		}
		if (existing.status === "PENDING" && isTrustedRole) {
			return prisma.$transaction(async (tx) => {
				const decision = {
					id: "automatic-legacy",
					requestId: existing.id,
					approverId: null,
					decisionMode: "AUTOMATICO_POR_POLITICA" as ApprovalDecisionMode,
					decision: "APPROVE" as const,
					reason: "Pendência legada resolvida pelo papel confiável",
				};
				await tx.approvalDecision.create({
					data: {
						requestId: existing.id,
						approverId: null,
						decisionMode: decision.decisionMode,
						decision: decision.decision,
						reason: decision.reason,
					},
				});
				const data = await handler.apply({
					tx,
					request: toRequestView(existing),
					decision,
				});
				await writeAudit(tx, {
					userId: input.actorId,
					ownerId: scope.resourceOwnerId,
					action: "APPROVE",
					entityType: "APPROVAL_REQUEST",
					entityId: existing.id,
					entityDescription: `${input.effectAction}:${input.resourceId ?? input.commandId ?? ""}`,
					newState: {
						status: "EXECUTED",
						execution: "DIRECT_LEGACY_RESOLUTION",
					},
					metadata: {
						actorRole,
						organizationId: scope.path.organizationId,
						costCenterId: scope.path.costCenterId,
						workId,
					},
				});
				await tx.approvalRequest.update({
					where: { id: existing.id },
					data: { status: "EXECUTED", executedAt: new Date() },
				});
				return {
					status: "APPROVED" as const,
					approvalRequestId: existing.id,
					data,
				};
			});
		}
		if (existing.status === "PENDING") {
			await notifyEligibleApprovers({
				request: existing,
				scope,
				requiredApproverRole: existing.requiredApproverRole as
					| "GERENTE"
					| "GESTOR",
			});
		}
		return {
			status: "PENDING",
			approvalRequestId: existing.id,
			requiredApproverRole: existing.requiredApproverRole as
				| "GERENTE"
				| "GESTOR",
		};
	}

	const requiredApproverRole = requiredApproverRoleFor(actorRole);

	if (isTrustedRole) {
		return prisma.$transaction(async (tx) => {
			const request = await tx.approvalRequest.create({
				data: {
					ownerId: scope.resourceOwnerId,
					actorId: input.actorId,
					actorRole,
					organizationId: scope.path.organizationId,
					costCenterId: scope.path.costCenterId,
					resourceType: input.resourceType,
					resourceId: input.resourceId,
					commandId: input.commandId ?? null,
					effectAction: input.effectAction,
					payloadJson: input.payload as object,
					payloadHash,
					expectedVersion: input.expectedVersion,
					idempotencyKey: input.idempotencyKey,
					requiredApproverRole,
					status: "APPROVED",
					decidedAt: new Date(),
				},
			});
			const decision = {
				id: "automatic",
				requestId: request.id,
				approverId: null,
				decisionMode: "AUTOMATICO_POR_POLITICA" as ApprovalDecisionMode,
				decision: "APPROVE" as const,
				reason: null,
			};
			await tx.approvalDecision.create({
				data: {
					requestId: request.id,
					approverId: null,
					decisionMode: "AUTOMATICO_POR_POLITICA",
					decision: "APPROVE",
					reason: null,
				},
			});
			const data = await handler.apply({
				tx,
				request: toRequestView(request),
				decision,
			});
			await writeAudit(tx, {
				userId: input.actorId,
				ownerId: scope.resourceOwnerId,
				action: "APPROVE",
				entityType: "APPROVAL_REQUEST",
				entityId: request.id,
				entityDescription: `${input.effectAction}:${input.resourceId ?? input.commandId ?? ""}`,
				newState: { status: "EXECUTED", execution: "DIRECT" },
				metadata: {
					actorRole,
					organizationId: scope.path.organizationId,
					costCenterId: scope.path.costCenterId,
					workId,
				},
			});
			await tx.approvalRequest.update({
				where: { id: request.id },
				data: { status: "EXECUTED", executedAt: new Date() },
			});
			const response: {
				status: "APPROVED";
				approvalRequestId: string;
				data?: unknown;
			} = {
				status: "APPROVED" as const,
				approvalRequestId: request.id,
			};
			if (data !== undefined) response.data = data;
			return response;
		});
	}

	const request = await prisma.approvalRequest.create({
		data: {
			ownerId: scope.resourceOwnerId,
			actorId: input.actorId,
			actorRole,
			organizationId: scope.path.organizationId,
			costCenterId: scope.path.costCenterId,
			resourceType: input.resourceType,
			resourceId: input.resourceId,
			commandId: input.commandId ?? null,
			effectAction: input.effectAction,
			payloadJson: input.payload as object,
			payloadHash,
			expectedVersion: input.expectedVersion,
			idempotencyKey: input.idempotencyKey,
			requiredApproverRole,
			status: "PENDING",
		},
	});
	if (prisma.auditLog) {
		await writeAudit(prisma, {
			userId: input.actorId,
			ownerId: scope.resourceOwnerId,
			action: "SUBMIT",
			entityType: "APPROVAL_REQUEST",
			entityId: request.id,
			entityDescription: `${input.effectAction}:${input.resourceId ?? input.commandId ?? ""}`,
			newState: { status: "PENDING", execution: "APPROVAL_CHAIN" },
			metadata: {
				actorRole,
				requiredApproverRole,
				organizationId: scope.path.organizationId,
				costCenterId: scope.path.costCenterId,
				workId,
			},
		});
	}

	await notificationService.create({
		recipientId: input.actorId,
		eventType: "APPROVAL_REQUESTED",
		referenceId: request.id,
		title: `Aprovacao pendente: ${input.effectAction}`,
	});
	await notifyEligibleApprovers({
		request,
		scope,
		requiredApproverRole,
	});

	return {
		status: "PENDING",
		approvalRequestId: request.id,
		requiredApproverRole,
		scope: {
			organizationId: scope.path.organizationId,
			costCenterId: scope.path.costCenterId,
		},
	};
}

async function notifyEligibleApprovers(input: {
	request: {
		id: string;
		effectAction: string;
		resourceType: string;
		resourceId: string | null;
		organizationId: string;
		costCenterId: string | null;
	};
	scope: { path: { organizationId: string; costCenterId: string | null } };
	requiredApproverRole: "GERENTE" | "GESTOR";
}) {
	const [organizationMembers, costCenterMembers, admins] = await Promise.all([
		prisma.organizationMembership.findMany({
			where: {
				organizationId: input.scope.path.organizationId,
				revokedAt: null,
			},
			select: { userId: true, user: { select: { role: true } } },
		}),
		input.scope.path.costCenterId
			? prisma.costCenterMembership.findMany({
					where: {
						costCenterId: input.scope.path.costCenterId,
						revokedAt: null,
					},
					select: { userId: true, user: { select: { role: true } } },
				})
			: Promise.resolve([]),
		prisma.user.findMany({
			where: { role: "ADMIN", banned: false },
			select: { id: true },
		}),
	]);

	const recipients = new Set(admins.map((admin) => admin.id));
	for (const member of organizationMembers) {
		if (
			input.requiredApproverRole === "GERENTE" &&
			member.user?.role === "GERENTE"
		) {
			recipients.add(member.userId);
		}
	}
	for (const member of costCenterMembers) {
		if (
			input.requiredApproverRole === "GESTOR" &&
			member.user?.role === "GESTOR"
		) {
			recipients.add(member.userId);
		}
	}

	for (const recipientId of recipients) {
		await notificationService.create({
			recipientId,
			eventType: "APPROVAL_DECISION_REQUIRED",
			referenceId: input.request.id,
			title: `Aprovacao necessaria: ${input.request.effectAction}`,
			body: `${input.request.resourceType}:${input.request.resourceId ?? "-"}`,
		});
	}
}

/**
 * DEC-004/005: decide uma solicitacao dentro da cadeia fixa.
 * - Autoaprovacao e proibida.
 * - O aprovador precisa do papel exigido e de escopo ativo (mesmo centro
 *   para GESTOR, mesma organizacao para GERENTE).
 * - Rejeicao exige motivo.
 * - Aprovacao de Supervisor pelo Gestor avanca para uma segunda revisao de
 *   Gerente; somente a decisao final executa o efeito.
 */
export async function decideApproval(input: {
	approverId: string;
	requestId: string;
	decision: "APPROVE" | "REJECT";
	reason?: string;
}): Promise<{ id: string; requestId: string; decision: "APPROVE" | "REJECT" }> {
	const approverUser = await prisma.user.findUnique({
		where: { id: input.approverId },
		select: { role: true },
	});
	const isAdminOverride = approverUser?.role === "ADMIN";
	const requiresDecisionReason =
		approverUser?.role === "GESTOR" || input.decision === "REJECT";
	if (requiresDecisionReason && !input.reason?.trim()) {
		throw new ConstructionError(
			"APPROVAL_REASON_REQUIRED",
			"Justificativa obrigatoria para aprovar ou rejeitar uma solicitacao",
			422,
		);
	}
	const request = await prisma.approvalRequest.findUnique({
		where: { id: input.requestId },
	});

	if (!request) {
		throw new ConstructionError("NOT_FOUND", "Solicitacao nao encontrada", 404);
	}
	if (request.status !== "PENDING") {
		throw new ConstructionError(
			"APPROVAL_CONFLICT",
			"Solicitacao ja decidida",
			409,
		);
	}
	const isTrustedApprover =
		approverUser?.role === "ADMIN" || approverUser?.role === "GERENTE";
	const isTrustedRequestActor =
		request.actorRole === "ADMIN" || request.actorRole === "GERENTE";
	if (
		input.decision === "APPROVE" &&
		request.actorId === input.approverId &&
		isTrustedApprover &&
		isTrustedRequestActor
	) {
		const handler = effectHandlers.get(request.effectAction);
		if (!handler) {
			throw new ConstructionError(
				"UNSUPPORTED_EFFECT_ACTION",
				`Efeito de aprovacao nao registrado: ${request.effectAction}`,
				422,
			);
		}
		return withSerializableRetry(async (tx) => {
			const updated = await tx.approvalRequest.updateMany({
				where: { id: request.id, status: "PENDING" },
				data: { status: "APPROVED", decidedAt: new Date() },
			});
			if (updated.count === 0) {
				throw new ConstructionError(
					"APPROVAL_CONFLICT",
					"Solicitacao ja decidida por outro superior",
					409,
				);
			}
			const decision = {
				id: "automatic-legacy",
				requestId: request.id,
				approverId: input.approverId,
				decisionMode: isAdminOverride
					? ("ADMIN_OVERRIDE" as ApprovalDecisionMode)
					: ("MANUAL_POR_SUPERIOR" as ApprovalDecisionMode),
				decision: "APPROVE" as const,
				reason: input.reason?.trim() ?? null,
			};
			await handler.apply({
				tx,
				request: toRequestView({ ...request, status: "APPROVED" }),
				decision,
			});
			await tx.approvalDecision.create({
				data: {
					requestId: request.id,
					approverId: input.approverId,
					decisionMode: decision.decisionMode,
					decision: "APPROVE",
					reason: decision.reason,
				},
			});
			await tx.approvalRequest.update({
				where: { id: request.id },
				data: { status: "EXECUTED", executedAt: new Date() },
			});
			return {
				id: decision.id,
				requestId: request.id,
				decision: "APPROVE" as const,
			};
		});
	}
	if (isAdminOverride && !input.reason?.trim()) {
		throw new ConstructionError(
			"APPROVAL_OVERRIDE_REASON_REQUIRED",
			"Override de ADMIN exige motivo auditavel",
			422,
		);
	}
	if (request.actorId === input.approverId) {
		throw new ConstructionError(
			"FORBIDDEN",
			"O solicitante nao pode aprovar a propria solicitacao",
			403,
		);
	}

	await assertApproverAuthorized(input.approverId, request);

	const handler = effectHandlers.get(request.effectAction);
	if (!handler) {
		throw new ConstructionError(
			"UNSUPPORTED_EFFECT_ACTION",
			`Efeito de aprovacao nao registrado: ${request.effectAction}`,
			422,
		);
	}

	return withSerializableRetry(async (tx) => {
		const updated = await tx.approvalRequest.updateMany({
			where: {
				id: request.id,
				status: "PENDING",
				expectedVersion: request.expectedVersion,
			},
			data: {
				status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
				decidedAt: new Date(),
			},
		});
		if (updated.count === 0) {
			throw new ConstructionError(
				"APPROVAL_CONFLICT",
				"Solicitacao ja decidida por outro superior",
				409,
			);
		}

		const decision = {
			id: "decision",
			requestId: request.id,
			approverId: input.approverId,
			decisionMode: isAdminOverride
				? ("ADMIN_OVERRIDE" as ApprovalDecisionMode)
				: ("MANUAL_POR_SUPERIOR" as ApprovalDecisionMode),
			decision: input.decision,
			reason: input.reason?.trim() ?? null,
		};

		const view = toRequestView({
			...request,
			status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
		});

		const requiresManagerReview =
			input.decision === "APPROVE" &&
			request.actorRole === "SUPERVISOR" &&
			!isAdminOverride &&
			approverUser?.role === "GESTOR";

		if (input.decision === "APPROVE" && !requiresManagerReview) {
			await handler.apply({ tx, request: view, decision });
			await tx.approvalRequest.update({
				where: { id: request.id },
				data: { status: "EXECUTED", executedAt: new Date() },
			});
		} else if (input.decision === "REJECT" && handler.reject) {
			await handler.reject({ tx, request: view, decision });
		} else if (handler.reject) {
			// A revisao intermediaria nao aplica nem rejeita o efeito original.
		}

		if (input.decision === "APPROVE" && !requiresManagerReview) {
			await notifyGerentesAfterSupervisorExecution(
				tx,
				{
					...request,
					actorRole: request.actorRole,
				},
				{ approverId: input.approverId, reason: input.reason?.trim() ?? null },
			);
		}

		const saved = await tx.approvalDecision.create({
			data: {
				requestId: request.id,
				approverId: input.approverId,
				decisionMode: isAdminOverride
					? "ADMIN_OVERRIDE"
					: "MANUAL_POR_SUPERIOR",
				decision: input.decision,
				reason: input.reason?.trim() ?? null,
			},
		});

		if (requiresManagerReview) {
			const managerRequest = await tx.approvalRequest.create({
				data: {
					ownerId: request.ownerId,
					actorId: input.approverId,
					actorRole: "GESTOR",
					organizationId: request.organizationId,
					costCenterId: request.costCenterId,
					resourceType: request.resourceType,
					resourceId: request.resourceId,
					commandId: request.commandId,
					effectAction: request.effectAction,
					payloadJson: request.payloadJson as object,
					payloadHash: request.payloadHash,
					expectedVersion: request.expectedVersion,
					idempotencyKey: `${request.idempotencyKey}:GERENTE`,
					requiredApproverRole: "GERENTE",
					status: "PENDING",
				},
			});

			await notifyManagersForReview(tx, managerRequest, request.actorId);
		}

		await writeAudit(tx, {
			userId: input.approverId,
			ownerId: request.ownerId,
			action: input.decision === "APPROVE" ? "APPROVE" : "REJECT",
			entityType: "APPROVAL_REQUEST",
			entityId: request.id,
			entityDescription: `${request.effectAction}:${request.resourceId ?? request.commandId ?? ""}`,
			newState: {
				decision: input.decision,
				reason: input.reason?.trim() ?? null,
			},
		});

		await notificationService.create(
			{
				recipientId: request.actorId,
				eventType: "APPROVAL_DECIDED",
				referenceId: request.id,
				version: 1,
				title:
					input.decision === "APPROVE"
						? "Solicitacao aprovada"
						: "Solicitacao rejeitada",
				body: input.reason?.trim() ?? null,
			},
			tx,
		);

		return {
			id: saved.id,
			requestId: saved.requestId,
			decision: saved.decision as "APPROVE" | "REJECT",
		};
	});
}

async function notifyManagersForReview(
	tx: import("@prisma/client").Prisma.TransactionClient,
	managerRequest: {
		id: string;
		organizationId: string;
		costCenterId: string | null;
		effectAction: string;
		resourceType: string;
		resourceId: string | null;
		payloadJson: unknown;
	},
	originalActorId: string,
) {
	const memberships = await tx.organizationMembership.findMany({
		where: { organizationId: managerRequest.organizationId, revokedAt: null },
		select: { userId: true, user: { select: { role: true } } },
	});
	const managerIds = new Set(
		memberships
			.filter((membership) => membership.user?.role === "GERENTE")
			.map((membership) => membership.userId),
	);
	for (const managerId of managerIds) {
		await notificationService.create(
			{
				recipientId: managerId,
				eventType: "APPROVAL_MANAGER_REVIEW_REQUIRED",
				referenceId: managerRequest.id,
				title: `Revisao de gerente: ${managerRequest.effectAction}`,
				body:
					`A solicitacao do supervisor ${originalActorId} foi aprovada pelo gestor e aguarda decisao final ` +
					`(${managerRequest.resourceType}:${managerRequest.resourceId ?? "-"}; ${approvalDeepLink(managerRequest)}).`,
			},
			tx,
		);
	}
}

type ApprovalRequestRow = {
	id: string;
	ownerId: string;
	actorId: string;
	actorRole: string;
	organizationId: string;
	costCenterId: string | null;
	effectAction: string;
	resourceType: string;
	resourceId: string | null;
	commandId: string | null;
	payloadJson: unknown;
	requiredApproverRole: string;
	expectedVersion: number;
};

function approvalDeepLink(row: {
	payloadJson: unknown;
	resourceType: string;
	resourceId: string | null;
	costCenterId: string | null;
	organizationId: string;
}): string {
	const workId = getApprovalWorkId(row);
	if (workId) return `/app/obras/${workId}`;
	if (row.resourceType === "COST_CENTER" || row.costCenterId) {
		return `/app/centros-de-custo/${row.costCenterId ?? ""}`;
	}
	return `/app/organizacoes/${row.organizationId}`;
}

/**
 * GOV-02: apos um Gestor (ou ADMIN via override) aprovar e executar uma
 * solicitacao de Supervisor, notifica os Gerentes elegiveis da organizacao
 * na MESMA unidade transacional da decisao/efeito/auditoria. A chave
 * idempotente (recipientId, eventType, referenceId, version) impede duplicatas.
 */
async function notifyGerentesAfterSupervisorExecution(
	tx: import("@prisma/client").Prisma.TransactionClient,
	request: ApprovalRequestRow,
	decision: { approverId: string | null; reason: string | null },
): Promise<void> {
	if (request.actorRole !== "SUPERVISOR") return;
	const memberships = await tx.organizationMembership.findMany({
		where: { organizationId: request.organizationId, revokedAt: null },
		select: { userId: true, user: { select: { role: true } } },
	});
	const gerenteIds = [
		...new Set(
			memberships
				.filter((membership) => membership.user?.role === "GERENTE")
				.map((membership) => membership.userId),
		),
	];
	for (const gerenteId of gerenteIds) {
		await notificationService.create(
			{
				recipientId: gerenteId,
				eventType: "SUPERVISOR_REQUEST_EXECUTED",
				referenceId: request.id,
				version: 1,
				title: `Supervisor executou ${request.effectAction}`,
				body:
					`Solicitacao de ${request.actorId} decidida por ` +
					`${decision.approverId ?? "politica"} (${request.effectAction}; ` +
					`recurso: ${request.resourceType}:${request.resourceId ?? "-"}; ` +
					`${approvalDeepLink(request)})` +
					(decision.reason ? ` Motivo: ${decision.reason}` : ""),
			},
			tx,
		);
	}
}

function getApprovalWorkId(row: {
	payloadJson: unknown;
	resourceType: string;
	resourceId: string | null;
}): string | null {
	const payload = row.payloadJson as { workId?: unknown } | null;
	if (typeof payload?.workId === "string" && payload.workId.length > 0) {
		return payload.workId;
	}
	return row.resourceType === "WORK" ? row.resourceId : null;
}

/**
 * DEC-004/005: o aprovador precisa de papel e escopo ativos no momento da
 * decisao. GESTOR decide solicitacoes do mesmo centro de custo; GERENTE
 * decide solicitacoes da mesma organizacao; ADMIN atua como override.
 */
async function assertApproverAuthorized(
	approverId: string,
	request: ApprovalRequestRow,
) {
	const user = await prisma.user.findUnique({
		where: { id: approverId },
		select: { role: true },
	});
	if (user?.role === "ADMIN") return;

	const workId = getApprovalWorkId(request);
	const scope = workId
		? await resolveResourceScope(approverId, { workId })
		: request.costCenterId
			? await resolveResourceScope(approverId, {
					costCenterId: request.costCenterId,
				})
			: await resolveResourceScope(approverId, {
					organizationId: request.organizationId,
				});

	const gerenteOverride =
		request.requiredApproverRole === "GESTOR" && scope.role === "GERENTE";
	if (scope.role !== request.requiredApproverRole && !gerenteOverride) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	if (scope.path.organizationId !== request.organizationId) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	if (
		request.requiredApproverRole === "GESTOR" &&
		(request.costCenterId === null ||
			scope.path.costCenterId !== request.costCenterId)
	) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
}
export async function requestReversal(input: {
	actorId: string;
	requestId: string;
	reason: string;
	expectedVersion: number;
}): Promise<{
	reversalId: string;
	requestId: string;
	status: "EXECUTED";
	result: unknown;
}> {
	if (!input.reason.trim()) {
		throw new ConstructionError(
			"REVERSAL_REASON_REQUIRED",
			"Motivo obrigatorio para reverter uma solicitacao",
			422,
		);
	}

	const request = await prisma.approvalRequest.findUnique({
		where: { id: input.requestId },
	});
	if (!request) {
		throw new ConstructionError("NOT_FOUND", "Solicitacao nao encontrada", 404);
	}

	const actor = await prisma.user.findUnique({
		where: { id: input.actorId },
		select: { role: true },
	});
	const actorRole = actor?.role as AuthorizationRole | null | undefined;
	if (actorRole !== "ADMIN" && actorRole !== "GERENTE") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Voce nao tem permissao para revisar execucoes",
			403,
		);
	}

	const workId = getApprovalWorkId(request);
	const resource = workId
		? { workId }
		: request.costCenterId
			? { costCenterId: request.costCenterId }
			: { organizationId: request.organizationId };
	const scope = await resolveResourceScope(input.actorId, resource);
	if (!scope.canRead || scope.resourceOwnerId !== request.ownerId) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}

	if (request.status !== "EXECUTED") {
		throw new ConstructionError(
			"REVERSAL_NOT_AVAILABLE",
			"Somente solicitacoes executadas podem ser revertidas",
			409,
		);
	}

	const handler = effectHandlers.get(request.effectAction);
	if (!handler?.canReverse || !handler.compensate) {
		throw new ConstructionError(
			"REVERSAL_NOT_AVAILABLE",
			"O efeito desta solicitacao nao e reversivel",
			422,
		);
	}

	const canReverse = await handler.canReverse({
		request: toRequestView(request),
	});
	if (!canReverse.reversible) {
		throw new ConstructionError(
			"REVERSAL_NOT_AVAILABLE",
			canReverse.reason ?? "Efeito nao reversivel no momento",
			422,
		);
	}

	const existing = await prisma.approvalReversalRequest.findUnique({
		where: { requestId: input.requestId },
	});
	if (existing) {
		throw new ConstructionError(
			"REVERSAL_ALREADY_EXISTS",
			"Reversao ja solicitada para esta solicitacao",
			409,
		);
	}

	const decision = {
		id: "reversal",
		requestId: request.id,
		approverId: input.actorId,
		decisionMode: "ADMIN_OVERRIDE" as ApprovalDecisionMode,
		decision: "APPROVE" as const,
		reason: input.reason.trim(),
	};

	const result = await withSerializableRetry(async (tx) => {
		const resultValue = await handler.compensate?.({
			tx,
			request: toRequestView(request),
			decision,
			reason: input.reason.trim(),
			expectedVersion: input.expectedVersion,
		});
		const reversal = await tx.approvalReversalRequest.create({
			data: {
				requestId: request.id,
				actorId: input.actorId,
				reason: input.reason.trim(),
				expectedVersion: input.expectedVersion,
				status: "EXECUTED",
				resultJson: (resultValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
			},
		});
		await writeAudit(tx, {
			userId: input.actorId,
			ownerId: request.ownerId,
			action: "REVERSE",
			entityType: "APPROVAL_REQUEST",
			entityId: request.id,
			entityDescription: `${request.effectAction}:${request.resourceId ?? request.commandId ?? ""}`,
			newState: {
				reason: input.reason.trim(),
				expectedVersion: input.expectedVersion,
			},
		});
		await notificationService.create(
			{
				recipientId: request.actorId,
				eventType: "APPROVAL_REVERSED",
				referenceId: request.id,
				version: 1,
				title: `Execucao revertida: ${request.effectAction}`,
				body: `Reversao solicitada por ${input.actorId}. Motivo: ${input.reason.trim()}`,
			},
			tx,
		);
		return { reversal, resultValue };
	});

	return {
		reversalId: result.reversal.id,
		requestId: request.id,
		status: "EXECUTED" as const,
		result: result.resultValue,
	};
}

export async function listPendingApprovals(actorId: string, workId?: string) {
	const include = {
		actor: { select: { name: true } },
		decisions: { select: { reason: true }, take: 1 },
	} as const;

	const user = await prisma.user.findUnique({
		where: { id: actorId },
		select: { role: true },
	});
	if (user?.role === "ADMIN") {
		const rows = await prisma.approvalRequest.findMany({
			where: { status: "PENDING" },
			include,
			orderBy: { createdAt: "desc" },
			take: 100,
		});
		if (!workId) return rows;
		return rows.filter((row) => getApprovalWorkId(row) === workId);
	}

	const role = user?.role as AuthorizationRole | null | undefined;
	if (role !== "GESTOR" && role !== "GERENTE") {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}

	const [orgMemberships, ccMemberships] = await Promise.all([
		prisma.organizationMembership.findMany({
			where: { userId: actorId, revokedAt: null },
			select: { organizationId: true },
		}),
		prisma.costCenterMembership.findMany({
			where: { userId: actorId, revokedAt: null },
			select: { costCenterId: true },
		}),
	]);
	const orgIds = orgMemberships.map((m) => m.organizationId);
	const ccIds = ccMemberships.map((m) => m.costCenterId);

	const rows = await prisma.approvalRequest.findMany({
		where: {
			status: "PENDING",
			requiredApproverRole: role,
			organizationId: { in: orgIds },
			...(role === "GESTOR" ? { costCenterId: { in: ccIds } } : {}),
		},
		include,
		orderBy: { createdAt: "desc" },
		take: 100,
	});
	if (!workId) return rows;
	return rows.filter((row) => getApprovalWorkId(row) === workId);
}
