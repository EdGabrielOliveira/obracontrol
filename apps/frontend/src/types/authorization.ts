export type Role = "ADMIN" | "GERENTE" | "GESTOR" | "SUPERVISOR";

export type AuthorizationCapabilities = {
	canManageUsers: boolean;
	canAdministerCompanies: boolean;
	canManageScopedCompanies?: boolean;
	canManageStructure?: boolean;
	canManageApiKeys: boolean;
	canDecideSupervisorRequests: boolean;
	canReviewExecutedSupervisorRequests: boolean;
	canRequestSupervisorDecisionReversal: boolean;
	canDecideGestorRequests: boolean;
	canFinalizeContracts: boolean;
};

export type AuthorizationSession = {
	user: { id: string; name: string; email: string; role: Role };
	organizations: Array<{ id: string; name: string }>;
	costCenters: Array<{ id: string; organizationId: string; name: string }>;
	capabilities: AuthorizationCapabilities;
};

export type PendingApprovalSummary = {
	id: string;
	requiredApproverRole: "GESTOR" | "GERENTE";
	organizationId: string;
	costCenterId: string | null;
	createdAt: string;
};

export type CommandResult<T> =
	| { status: "EXECUTED"; data: T }
	| { status: "PENDING"; approvalRequest: PendingApprovalSummary };

export const ROLES: readonly Role[] = [
	"ADMIN",
	"GERENTE",
	"GESTOR",
	"SUPERVISOR",
];

export const ROLE_LABELS: Record<Role, string> = {
	ADMIN: "Administrador",
	GERENTE: "Gerente",
	GESTOR: "Gestor",
	SUPERVISOR: "Supervisor",
};

export function isRole(value: string | null | undefined): value is Role {
	return ROLES.includes(value as Role);
}
