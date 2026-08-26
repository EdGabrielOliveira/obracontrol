import { createHash } from "node:crypto";
import type { AuthorizationRole } from "../../lib/authorization";

export type ApprovalMode = "AUTONOMOUS" | "MANUAL" | "BLOCKED";
export type ApprovalDecisionMode =
	| "AUTOMATICO_POR_POLITICA"
	| "MANUAL_POR_SUPERIOR"
	| "ADMIN_OVERRIDE";

/**
 * GOV-01 — tabela de acoes (fluxo de aprovacao).
 *
 * | Origem | Fluxo | Decisor |
 * | --- | --- | --- |
 * | SUPERVISOR | PENDING, sem efeito | GESTOR do mesmo centro |
 * | GESTOR | AUTONOMOUS direto auditado | — |
 * | GERENTE | AUTONOMOUS direto auditado | — |
 * | ADMIN | AUTONOMOUS direto; override exige motivo (ADMIN_OVERRIDE) | — |
 *
 * ADMIN/GERENTE/GESTOR executam diretamente também a ativação de uma versão de
 * orçamento; a decisão automática fica registrada para auditoria.
 */

export type ApprovalResolution = {
	mode: ApprovalMode;
	action: string;
	scope: {
		organizationId: string;
		costCenterId: string | null;
		workId: string | null;
		resourceOwnerId: string;
	};
	policyId: string | null;
	approverRole: "GERENTE" | "GESTOR" | null;
	valueLimit: { toNumber(): number } | null;
};

export type ApprovalEffectHandler = {
	action: string;
	apply: (input: {
		tx: import("@prisma/client").Prisma.TransactionClient;
		request: ApprovalRequest;
		decision: ApprovalDecision;
	}) => Promise<unknown>;
	reject?: (input: {
		tx: import("@prisma/client").Prisma.TransactionClient;
		request: ApprovalRequest;
		decision: ApprovalDecision;
	}) => Promise<void>;
	/**
	 * GOV-03: capacidade de reversao compensatoria, por dominio. Nao existe
	 * handler generico permissivo; sem esta funcao o efeito nao e reversivel.
	 */
	canReverse?: (input: {
		request: ApprovalRequest;
	}) => Promise<{ reversible: boolean; reason?: string | null }>;
	compensate?: (input: {
		tx: import("@prisma/client").Prisma.TransactionClient;
		request: ApprovalRequest;
		decision: ApprovalDecision;
		reason: string;
		expectedVersion: number;
	}) => Promise<unknown>;
};

export type ApprovalRequestStatus =
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "CONFLICTED"
	| "CANCELLED"
	| "EXECUTED";

export type ApprovalRequest = {
	id: string;
	ownerId: string;
	actorId: string;
	actorRole: AuthorizationRole;
	organizationId: string;
	costCenterId: string | null;
	resourceType: string;
	resourceId: string | null;
	commandId: string | null;
	effectAction: string;
	payloadJson: unknown;
	payloadHash: string;
	expectedVersion: number;
	idempotencyKey: string;
	requiredApproverRole: "GERENTE" | "GESTOR";
	status: ApprovalRequestStatus;
	decidedAt: string | null;
	executedAt: string | null;
	conflictReason: string | null;
};

export type ApprovalDecision = {
	id: string;
	requestId: string;
	approverId: string | null;
	decisionMode: ApprovalDecisionMode;
	decision: "APPROVE" | "REJECT";
	reason: string | null;
};

export function hashApprovalPayload(payload: unknown): string {
	return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * DEC-004: papel exigido para decidir solicitações pendentes. Supervisor
 * solicita ao Gestor do mesmo centro; papéis confiáveis executam diretamente.
 */
export function requiredApproverRoleFor(
	actorRole: AuthorizationRole,
): "GERENTE" | "GESTOR" {
	return actorRole === "SUPERVISOR" ? "GESTOR" : "GERENTE";
}
