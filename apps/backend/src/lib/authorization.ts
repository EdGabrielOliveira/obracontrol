import { ConstructionError } from "./errors";

export const AUTH_ROLES = ["ADMIN", "GERENTE", "GESTOR", "SUPERVISOR"] as const;

export type AuthorizationRole = (typeof AUTH_ROLES)[number];

// `OPERADOR` was the operational role used before the four-role authority
// model. Keep the alias at the boundary so pre-existing accounts continue to
// work with the least-privileged equivalent; do not promote them or grant
// scope during the CompanyMembership migration.
const LEGACY_ROLE_ALIASES: Readonly<Record<string, AuthorizationRole>> = {
	OPERADOR: "SUPERVISOR",
};

export type RoleAction =
	| "read"
	| "write"
	| "approve"
	| "admin"
	| "audit"
	| "manage";

const ROLE_PERMISSIONS: Record<AuthorizationRole, readonly RoleAction[]> = {
	ADMIN: ["read", "write", "approve", "admin", "audit"],

	GERENTE: ["read", "write", "approve", "manage", "audit"],

	GESTOR: ["read", "write", "approve"],
	SUPERVISOR: ["read", "write"],
};

export type ScopeAccessFlags = {
	canRead: boolean;
	canWrite: boolean;
	canApprove: boolean;
	canAdmin: boolean;

	canAudit?: boolean;
};

export function roleToScopeAccess(role?: string | null): ScopeAccessFlags {
	const normalized = normalizeRole(role);
	const perms = isAuthorizationRole(normalized)
		? ROLE_PERMISSIONS[normalized]
		: undefined;
	return {
		canRead: perms?.includes("read") ?? false,
		canWrite: perms?.includes("write") ?? false,
		canApprove: perms?.includes("approve") ?? false,
		canAdmin: perms?.includes("admin") ?? false,
		canAudit: perms?.includes("audit") ?? false,
	};
}

export function normalizeRole(role: string | null | undefined): string | null {
	if (!role) return null;
	const normalized = role.trim().toUpperCase();
	return LEGACY_ROLE_ALIASES[normalized] ?? normalized;
}

export function isAuthorizationRole(
	role: string | null | undefined,
): role is AuthorizationRole {
	const normalized = normalizeRole(role);
	return AUTH_ROLES.some((finalRole) => finalRole === normalized);
}

export function canPerformRoleAction(
	role: string | null | undefined,
	action: RoleAction,
): boolean {
	const normalized = normalizeRole(role);
	if (!isAuthorizationRole(normalized)) return false;
	return ROLE_PERMISSIONS[normalized].includes(action);
}

export function assertRoleCan(
	role: string | null | undefined,
	action: RoleAction,
): void {
	if (canPerformRoleAction(role, action)) return;
	throw new ConstructionError(
		"FORBIDDEN",
		"Voce nao tem permissao para executar esta acao",
		403,
	);
}
