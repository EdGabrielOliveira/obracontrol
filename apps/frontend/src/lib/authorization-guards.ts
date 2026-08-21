import type { AuthorizationCapabilities } from "@/types/authorization";

export function requireCapability(
	capabilities: AuthorizationCapabilities | null,
	capability: keyof AuthorizationCapabilities,
): void {
	if (!capabilities?.[capability]) {
		const error = new Error("FORBIDDEN_ROUTE");
		error.name = "ForbiddenRouteError";
		throw error;
	}
}
