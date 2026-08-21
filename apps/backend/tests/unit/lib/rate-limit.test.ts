import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { rateLimitApi } from "../../../src/lib/rate-limit";

let trustedProxy: string | undefined;

mock.module("../../../src/env", () => ({
	env: {
		get TRUSTED_PROXY() {
			return trustedProxy;
		},
	},
}));

function appWithUser(key: string, max: number) {
	return new Elysia()
		.resolve({ as: "scoped" }, () => ({ user: { id: "user-1" } }))
		.use(rateLimitApi({ windowMs: 60_000, max, key }))
		.get("/", () => "ok");
}

describe("rateLimitApi", () => {
	beforeEach(() => {
		trustedProxy = undefined;
	});

	it("uses the authenticated user id as clientId when present", async () => {
		const app = appWithUser("t-user", 1);

		const first = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-forwarded-for": "1.1.1.1" },
			}),
		);
		const second = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-forwarded-for": "2.2.2.2" },
			}),
		);

		expect(first.status).toBe(200);
		expect(second.status).toBe(429);
	});

	it("ignores spoofable IP headers without a trusted proxy", async () => {
		const app = new Elysia()
			.use(rateLimitApi({ windowMs: 60_000, max: 1, key: "t-no-proxy" }))
			.get("/", () => "ok");

		const first = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-forwarded-for": "1.1.1.1" },
			}),
		);
		const second = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-forwarded-for": "2.2.2.2" },
			}),
		);

		// Sem TRUSTED_PROXY, os dois requests caem no mesmo bucket "anonymous".
		expect(first.status).toBe(200);
		expect(second.status).toBe(429);
	});

	it("uses IP headers only when TRUSTED_PROXY is configured", async () => {
		trustedProxy = "10.0.0.1";
		const app = new Elysia()
			.use(rateLimitApi({ windowMs: 60_000, max: 1, key: "t-proxy" }))
			.get("/", () => "ok");

		const first = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-forwarded-for": "1.1.1.1" },
			}),
		);
		const second = await app.handle(
			new Request("http://localhost/", {
				headers: { "x-forwarded-for": "2.2.2.2" },
			}),
		);

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
	});

	it("returns 429 with Retry-After when the limit is exceeded", async () => {
		const app = appWithUser("t-429", 2);

		await app.handle(new Request("http://localhost/"));
		await app.handle(new Request("http://localhost/"));
		const third = await app.handle(new Request("http://localhost/"));

		expect(third.status).toBe(429);
		expect(third.headers.get("retry-after")).not.toBeNull();
	});

	it("scoped instances with different keys do not share buckets", async () => {
		const a = await appWithUser("t-scope-a", 1).handle(
			new Request("http://localhost/"),
		);
		const b = await appWithUser("t-scope-b", 1).handle(
			new Request("http://localhost/"),
		);

		expect(a.status).toBe(200);
		expect(b.status).toBe(200);
	});

	it("resolves o store uma unica vez para o processo (sem troca de store)", async () => {
		const { resolveStore } = await import("../../../src/lib/rate-limit");

		const first = await resolveStore();
		const second = await resolveStore();

		expect(first).toBe(second);
	});
});
