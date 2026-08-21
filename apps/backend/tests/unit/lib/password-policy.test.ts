import { beforeEach, describe, expect, mock, test } from "bun:test";
import { bruteForceAfter, bruteForceGuard } from "../../../src/lib/brute-force";
import { resetLoginAttemptStores } from "../../../src/lib/login-attempt-store";
import {
	checkLoginBruteForce,
	clearLoginAttempts,
	hashLoginEmail,
	recordLoginFailure,
} from "../../../src/lib/password-policy";

const warnSpy = mock((_action: string, _fields: Record<string, unknown>) => {});
const infoSpy = mock((_action: string, _fields: Record<string, unknown>) => {});
const errorSpy = mock(
	(_action: string, _fields: Record<string, unknown>) => {},
);
const debugSpy = mock(
	(_action: string, _fields: Record<string, unknown>) => {},
);

mock.module("../../../src/lib/logger", () => ({
	logger: {
		warn: warnSpy,
		info: infoSpy,
		error: errorSpy,
		debug: debugSpy,
	},
}));

function loginRequest(email: string) {
	return new Request("http://localhost/api/auth/sign-in/email", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password: "qualquer" }),
	});
}

function failedResponse() {
	return new Response(JSON.stringify({ message: "credenciais invalidas" }), {
		status: 401,
	});
}

describe("password-policy (memory store)", () => {
	beforeEach(() => {
		resetLoginAttemptStores();
		warnSpy.mockClear();
	});

	test("bloqueia apos 5 falhas dentro da janela", async () => {
		const email = "usuario@exemplo.com";
		for (let i = 0; i < 5; i++) {
			await recordLoginFailure(email);
		}
		expect(await checkLoginBruteForce(email)).toBe(false);
	});

	test("permite apos expiracao da janela", async () => {
		const email = "usuario@exemplo.com";
		for (let i = 0; i < 5; i++) {
			await recordLoginFailure(email, { windowMs: 50 });
		}
		expect(await checkLoginBruteForce(email, { windowMs: 50 })).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(await checkLoginBruteForce(email, { windowMs: 50 })).toBe(true);
	});

	test("isola bloqueios entre emails", async () => {
		for (let i = 0; i < 5; i++) {
			await recordLoginFailure("bloqueado@exemplo.com");
		}
		expect(await checkLoginBruteForce("bloqueado@exemplo.com")).toBe(false);
		expect(await checkLoginBruteForce("outro@exemplo.com")).toBe(true);
	});

	test("clearLoginAttempts libera o email", async () => {
		const email = "usuario@exemplo.com";
		for (let i = 0; i < 5; i++) {
			await recordLoginFailure(email);
		}
		await clearLoginAttempts(email);
		expect(await checkLoginBruteForce(email)).toBe(true);
	});

	test("hashLoginEmail nao expoe o email em logs", async () => {
		const email = "privado@exemplo.com";
		const hash = hashLoginEmail(email);
		expect(hash).not.toContain("privado");
		expect(hash).not.toContain("@exemplo");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(hashLoginEmail(email)).toBe(hash);
	});
});

describe("brute-force guard (integracao)", () => {
	beforeEach(() => {
		resetLoginAttemptStores();
		warnSpy.mockClear();
	});

	test("retorna 429 sem email no corpo quando bloqueado", async () => {
		const email = "alvo@exemplo.com";
		for (let i = 0; i < 5; i++) {
			await bruteForceAfter(loginRequest(email), failedResponse());
		}

		const response = await bruteForceGuard(loginRequest(email));
		expect(response?.status).toBe(429);
		const body = await response?.json();
		expect(JSON.stringify(body)).not.toContain(email);
	});

	test("registra em log somente o hash do email, nunca o email cru", async () => {
		const email = "alvo-log@exemplo.com";
		for (let i = 0; i < 5; i++) {
			await bruteForceAfter(loginRequest(email), failedResponse());
		}
		await bruteForceGuard(loginRequest(email));

		expect(warnSpy).toHaveBeenCalledTimes(1);
		const [action, fields] = warnSpy.mock.calls[0];
		expect(action).toBe("auth.bruteforce.blocked");
		expect(fields?.emailHash).toBe(hashLoginEmail(email));
		expect(JSON.stringify(fields)).not.toContain(email);
	});

	test("sucesso (status fora de 400/401) nao registra falha", async () => {
		const email = "ok@exemplo.com";
		await bruteForceAfter(
			loginRequest(email),
			new Response("ok", { status: 200 }),
		);
		expect(await checkLoginBruteForce(email)).toBe(true);
	});

	test("metodo nao-POST ou rota fora de auth nao e bloqueada", async () => {
		expect(
			await bruteForceGuard(
				new Request("http://localhost/api/auth/sign-in/email"),
			),
		).toBeNull();
		expect(
			await bruteForceGuard(
				new Request("http://localhost/health", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email: "x@exemplo.com" }),
				}),
			),
		).toBeNull();
	});
});
