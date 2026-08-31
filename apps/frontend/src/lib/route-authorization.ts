import { redirect } from "@tanstack/react-router";
import { fetchAuthorizationSession } from "@/lib/auth-client";
import { authorizationSessionQueryOptions } from "@/lib/authorization-session-query";
import { queryClient } from "@/lib/query-client";
import { authQueryKeys } from "@/lib/query-cache";
import type { AuthorizationCapabilities } from "@/types/authorization";

async function getAuthorizationForGuard() {
	return (
		queryClient.getQueryData<Awaited<ReturnType<typeof fetchAuthorizationSession>>>(
			authQueryKeys.authorization,
		) ?? queryClient.fetchQuery(authorizationSessionQueryOptions())
	);
}

export async function requireAuthorizationCapability(
	capability: keyof AuthorizationCapabilities,
): Promise<void> {
	const authorization = await getAuthorizationForGuard();
	if (!authorization.capabilities[capability]) {
		throw redirect({ to: "/app" });
	}
}

export async function requireManagementAccess(): Promise<void> {
	const authorization = await getAuthorizationForGuard();
	if (authorization.user.role === "SUPERVISOR") {
		throw redirect({ to: "/app/obras" });
	}
}
