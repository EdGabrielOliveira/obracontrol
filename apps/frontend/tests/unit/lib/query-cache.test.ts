import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys, clearAuthSessionCache } from "@/lib/query-cache";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import { createQueryClient, queryClient } from "@/lib/query-client";

test("removes cached authentication data without clearing domain queries", () => {
	const client = new QueryClient();
	client.setQueryData(authQueryKeys.session, { session: null });
	client.setQueryData(authQueryKeys.authorization, { capabilities: {} });
	client.setQueryData(["works", "list"], { data: [] });

	clearAuthSessionCache(client);

	expect(client.getQueryData(authQueryKeys.session)).toBeUndefined();
	expect(client.getQueryData(authQueryKeys.authorization)).toBeUndefined();
	expect(client.getQueryData(["works", "list"])).toEqual({ data: [] });
});

test("groups every authentication query under one cache key", () => {
	expect(authQueryKeys.session.slice(0, 1)).toEqual(authQueryKeys.all);
	expect(authQueryKeys.authorization.slice(0, 1)).toEqual(authQueryKeys.all);
});

test("guards reutilizam autorização já cacheada", async () => {
	queryClient.setQueryData(authQueryKeys.authorization, {
		user: { role: "ADMIN" },
		capabilities: { canManageUsers: true },
	});

	await expect(
		requireAuthorizationCapability("canManageUsers"),
	).resolves.toBeUndefined();

	clearAuthSessionCache(queryClient);
});

test("invalidates cached queries after every successful mutation", async () => {
	const client = createQueryClient();
	const queryKey = ["works", "list"] as const;
	client.setQueryData(queryKey, { data: [] });

	const mutation = client.getMutationCache().build(client, {
		mutationFn: async () => ({ id: "work-1" }),
	});

	await mutation.execute(undefined);

	expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
});
