import { redirect } from "@tanstack/react-router";
import { fetchAuthorizationSession } from "@/lib/auth-client";
import type { AuthorizationCapabilities } from "@/types/authorization";

export async function requireAuthorizationCapability(
	capability: keyof AuthorizationCapabilities,
): Promise<void> {
	const authorization = await fetchAuthorizationSession();
	if (!authorization.capabilities[capability]) {
		throw redirect({ to: "/app" });
	}
}

export async function requireManagementAccess(): Promise<void> {
	const authorization = await fetchAuthorizationSession();
	if (authorization.user.role === "SUPERVISOR") {
		throw redirect({ to: "/app/obras" });
	}
}
