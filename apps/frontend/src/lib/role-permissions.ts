import type { AuthorizationCapabilities } from "@/types/authorization";

export function canDecideSupervisorRequests(
	capabilities: AuthorizationCapabilities | null,
): boolean {
	return capabilities?.canDecideSupervisorRequests ?? false;
}

export function canDecideGestorRequests(
	capabilities: AuthorizationCapabilities | null,
): boolean {
	return capabilities?.canDecideGestorRequests ?? false;
}

export function canReviewExecutedSupervisorRequests(
	capabilities: AuthorizationCapabilities | null,
): boolean {
	return capabilities?.canReviewExecutedSupervisorRequests ?? false;
}

export function canAdministerCompanies(
	capabilities: AuthorizationCapabilities | null,
): boolean {
	return capabilities?.canAdministerCompanies ?? false;
}

export function canManageUsers(
	capabilities: AuthorizationCapabilities | null,
): boolean {
	return capabilities?.canManageUsers ?? false;
}

export function canFinalizeContracts(
	capabilities: AuthorizationCapabilities | null,
): boolean {
	return capabilities?.canFinalizeContracts ?? false;
}
