import { isRole, type Role } from "@/types/authorization";

export type AppRole = string | null | undefined;

export function normalizedRole(role: AppRole): string | null {
	if (!role) return null;
	return role.trim().toUpperCase();
}

export function toRole(role: AppRole): Role | null {
	const normalized = normalizedRole(role);
	return isRole(normalized) ? normalized : null;
}

export function isAdmin(role: AppRole): boolean {
	return normalizedRole(role) === "ADMIN";
}

export function canAccessAdministration(role: AppRole): boolean {
	const normalized = normalizedRole(role);
	return normalized === "ADMIN" || normalized === "GERENTE";
}

export function canAccessApiKeys(role: AppRole): boolean {
	return normalizedRole(role) === "ADMIN";
}

export function canAccessAudit(role: AppRole): boolean {
	return normalizedRole(role) === "ADMIN";
}

export function isGestorOrSupervisor(role: AppRole): boolean {
	const normalized = normalizedRole(role);
	return normalized === "GESTOR" || normalized === "SUPERVISOR";
}

export function roleRequiresCostCenter(role: AppRole): boolean {
	return isGestorOrSupervisor(role);
}
