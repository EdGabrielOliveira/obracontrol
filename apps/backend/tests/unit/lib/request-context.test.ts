import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
	requestContext,
	requestContextPlugin,
} from "../../../src/lib/request-context";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildApp() {
	return new Elysia()
		.use(requestContextPlugin)
		.get("/", async ({ set }) => ({
			requestId: requestContext.getRequestId() ?? null,
			header: set.headers["x-request-id"],
		}))
		.get("/user", async () => {
			requestContext.setUserId("user-1");
			await Promise.resolve();
			return { userId: requestContext.getUserId() ?? null };
		})
		.onError(({ error, set }) => ({
			code: error instanceof Error ? error.message : String(error),
			requestId: requestContext.getRequestId() ?? null,
			header: set.headers["x-request-id"],
		}));
}

describe("requestContextPlugin", () => {
	it("generates a requestId and echoes it in the x-request-id header", async () => {
		const app = buildApp();
		const res = await app.handle(new Request("http://localhost/"));
		const header = res.headers.get("x-request-id") ?? "";
		const body = (await res.json()) as {
			requestId: string | null;
			header: string | undefined;
		};
		expect(header).toMatch(UUID_RE);
		expect(body.requestId).toBe(header);
		expect(body.header).toBe(header);
	});

	it("propagates the requestId into handlers across awaits", async () => {
		const app = buildApp();
		const res = await app.handle(new Request("http://localhost/user"));
		const body = (await res.json()) as { userId: string | null };
		expect(body.userId).toBe("user-1");
	});

	it("propagates the requestId into error hooks", async () => {
		const app = buildApp();
		const res = await app.handle(new Request("http://localhost/missing"));
		const body = (await res.json()) as { requestId: string | null };
		expect(body.requestId).toMatch(UUID_RE);
	});

	it("keeps a valid incoming x-request-id for tracing", async () => {
		const app = buildApp();
		const res = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-request-id": "11111111-2222-4333-8444-555555555555" },
			}),
		);
		expect(res.headers.get("x-request-id")).toBe(
			"11111111-2222-4333-8444-555555555555",
		);
	});

	it("ignores an invalid incoming x-request-id and generates a fresh one", async () => {
		const app = buildApp();
		const res = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-request-id": "not-a-uuid" },
			}),
		);
		const header = res.headers.get("x-request-id") ?? "";
		expect(header).not.toBe("not-a-uuid");
		expect(header).toMatch(UUID_RE);
	});
});

describe("requestContext.withRequestContext", () => {
	it("scopes the context to the callback only", () => {
		let inside = "";
		requestContext.withRequestContext({ requestId: "req-abc" }, () => {
			inside = requestContext.getRequestId() ?? "";
		});
		expect(inside).toBe("req-abc");
		expect(requestContext.getRequestId()).toBeUndefined();
	});

	it("propagates the context into async work", async () => {
		const result = await requestContext.withRequestContext(
			{ requestId: "req-async" },
			async () => {
				await Promise.resolve();
				return requestContext.getRequestId();
			},
		);
		expect(result).toBe("req-async");
	});
});
