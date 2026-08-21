import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys, clearAuthSessionCache } from "@/lib/query-cache";

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
