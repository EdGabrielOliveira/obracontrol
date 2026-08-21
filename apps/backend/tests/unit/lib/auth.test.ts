import { describe, expect, it } from "bun:test";
import {
	auth,
	authCookieNames,
	authTrustedOrigins,
	buildTrustedOrigins,
	expireLegacyAuthCookies,
} from "../../../src/lib/auth";

describe("buildTrustedOrigins", () => {
	it("trusts the explicit frontend origin and local development origins", () => {
		expect(buildTrustedOrigins("http://example.local")).toEqual([
			"http://example.local",
			"http://localhost:7000",
			"http://localhost:7001",
			"http://localhost:5173",
		]);
	});

	it("omits empty origins and avoids duplicates", () => {
		expect(buildTrustedOrigins()).toEqual([
			"http://localhost:7000",
			"http://localhost:7001",
			"http://localhost:5173",
		]);

		expect(buildTrustedOrigins("http://localhost:7001")).toEqual([
			"http://localhost:7001",
			"http://localhost:7000",
			"http://localhost:5173",
		]);
	});

	it("normalizes trailing slashes from deployment environment variables", () => {
		expect(
			buildTrustedOrigins(
				"http://obracontrol-144-22-159-122.traefik.me/",
				"production",
				"http://obracontrol-144-22-159-122.traefik.me/",
			),
		).toEqual(["http://obracontrol-144-22-159-122.traefik.me"]);
	});
});

describe("auth cookie namespace", () => {
	it("configures every Better Auth cookie with the ObraControl suffix", () => {
		expect(authCookieNames).toEqual({
			sessionToken: "better-auth.session_token_obracontrol",
			sessionData: "better-auth.session_data_obracontrol",
			accountData: "better-auth.account_data_obracontrol",
			dontRemember: "better-auth.dont_remember_obracontrol",
		});

		expect(auth.options.advanced?.cookies).toEqual({
			session_token: { name: authCookieNames.sessionToken },
			session_data: { name: authCookieNames.sessionData },
			account_data: { name: authCookieNames.accountData },
			dont_remember: { name: authCookieNames.dontRemember },
		});
	});

	it("exposes the namespaced cookies through Better Auth context with secure defaults", async () => {
		const context = await auth.$context;

		expect(context.authCookies.sessionToken.name).toBe(
			authCookieNames.sessionToken,
		);
		expect(context.authCookies.sessionData.name).toBe(
			authCookieNames.sessionData,
		);
		expect(context.authCookies.accountData.name).toBe(
			authCookieNames.accountData,
		);
		expect(context.authCookies.dontRememberToken.name).toBe(
			authCookieNames.dontRemember,
		);
		expect(context.authCookies.sessionToken.attributes).toMatchObject({
			httpOnly: true,
			sameSite: "lax",
			path: "/",
		});
	});

	it("expires legacy cookies, including session-data chunks, without replacing the response", () => {
		const response = expireLegacyAuthCookies(
			new Request("http://localhost:7000/api/auth/get-session", {
				headers: {
					cookie:
						"better-auth.session_token=old; better-auth.session_data.0=chunk; unrelated=value",
				},
			}),
			new Response("ok", { headers: { "x-test": "kept" } }),
		);

		expect(response.headers.get("x-test")).toBe("kept");
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session_token=; Max-Age=0",
		);
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session_data.0=; Max-Age=0",
		);
	});

	it("does not add expiration headers when no legacy cookie is present", () => {
		const response = expireLegacyAuthCookies(
			new Request("http://localhost:7000/api/auth/get-session", {
				headers: { cookie: `${authCookieNames.sessionToken}=new` },
			}),
			new Response("ok"),
		);

		expect(response.headers.has("set-cookie")).toBe(false);
	});
});

describe("authTrustedOrigins", () => {
	it("trusts the local frontend origin", () => {
		expect(authTrustedOrigins).toContain("http://localhost:7001");
	});
});
