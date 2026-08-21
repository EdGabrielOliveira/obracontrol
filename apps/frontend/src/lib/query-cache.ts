import type { QueryClient } from "@tanstack/react-query";

export const queryCacheDuration = {
	defaultStale: 1000 * 60 * 2,
	sessionStale: 1000 * 30,
	inactiveGc: 1000 * 60 * 30,
} as const;

export const authQueryKeys = {
	session: ["auth", "session"] as const,
	authorization: ["auth", "authorization"] as const,
};

export function clearAuthSessionCache(client: QueryClient) {
	client.removeQueries({ queryKey: ["auth"] });
}
