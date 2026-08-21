import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";

export type RequestContext = {
	requestId: string;
	userId?: string;

	apiKeyOrgScope?: string;
};

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
	getRequestId(): string | undefined {
		return storage.getStore()?.requestId;
	},
	getUserId(): string | undefined {
		return storage.getStore()?.userId;
	},
	setUserId(userId: string | null): void {
		const store = storage.getStore();
		if (store && userId) store.userId = userId;
	},
	getApiKeyOrgScope(): string | undefined {
		return storage.getStore()?.apiKeyOrgScope;
	},
	setApiKeyOrgScope(organizationId: string | null): void {
		const store = storage.getStore();
		if (store && organizationId) store.apiKeyOrgScope = organizationId;
	},
	withRequestContext<T>(context: RequestContext, fn: () => T): T {
		return storage.run(context, fn);
	},
};

export const requestContextPlugin = new Elysia({ name: "request-context" })
	.wrap((map, request) => {
		const incoming = request.headers.get("x-request-id");
		const requestId =
			incoming && UUID_RE.test(incoming) ? incoming : randomUUID();
		return (req: Request) =>
			requestContext.withRequestContext({ requestId }, () => map(req));
	})
	.onRequest(({ set }) => {
		const requestId = requestContext.getRequestId();
		if (requestId) set.headers["x-request-id"] = requestId;
	});
