import { createAuthClient } from "better-auth/react";
import { api } from "@/api/api";
import { SERVER_URL } from "@/env";
import type { AuthorizationSession } from "@/types/authorization";

export const authClient = createAuthClient({
	baseURL: SERVER_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;

export type BetterAuthSession = NonNullable<
	ReturnType<typeof useSession>["data"]
>;

export async function fetchAuthorizationSession(): Promise<AuthorizationSession> {
	const { data } = await api.get<AuthorizationSession>(
		"/api/auth/authorization-session",
	);
	return data;
}
