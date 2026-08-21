import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { env } from "../env";
import { hashPassword, verifyPassword } from "./password-hasher";
import { prisma } from "./prisma";

export function buildTrustedOrigins(
	frontendOrigin?: string,
	nodeEnv?: string,
	extraOrigins?: string,
): string[] {
	const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");
	const isProduction = (nodeEnv ?? env.NODE_ENV) === "production";
	const origins: (string | undefined)[] = [
		frontendOrigin ? normalizeOrigin(frontendOrigin) : undefined,
		...(extraOrigins ?? "")
			.split(",")
			.map((origin) => normalizeOrigin(origin.trim()))
			.filter(Boolean),
	];

	if (!isProduction) {
		origins.push(
			"http://localhost:7000",
			"http://localhost:7001",
			"http://localhost:5173",
		);
	}

	return Array.from(
		new Set(origins.filter((origin): origin is string => Boolean(origin))),
	);
}

export const authTrustedOrigins = buildTrustedOrigins(
	env.FRONTEND_ORIGIN,
	env.NODE_ENV,
	env.AUTH_TRUSTED_ORIGINS,
);

export const authCookieNames = {
	sessionToken: "better-auth.session_token_obracontrol",
	sessionData: "better-auth.session_data_obracontrol",
	accountData: "better-auth.account_data_obracontrol",
	dontRemember: "better-auth.dont_remember_obracontrol",
} as const;

const legacyAuthCookiePrefixes = [
	"better-auth.session_token",
	"better-auth.session_data",
	"better-auth.account_data",
	"better-auth.dont_remember",
	"__Secure-better-auth.session_token",
	"__Secure-better-auth.session_data",
	"__Secure-better-auth.account_data",
	"__Secure-better-auth.dont_remember",
] as const;

function cookieNamesFromHeader(value: string | null): string[] {
	if (!value) return [];
	return value
		.split(";")
		.map((part) => {
			const separator = part.indexOf("=");
			return separator >= 0 ? part.slice(0, separator).trim() : "";
		})
		.filter(Boolean);
}

export function expireLegacyAuthCookies(
	request: Request,
	response: Response,
): Response {
	const legacyNames = cookieNamesFromHeader(
		request.headers.get("cookie"),
	).filter((name) =>
		legacyAuthCookiePrefixes.some(
			(prefix) => name === prefix || name.startsWith(`${prefix}.`),
		),
	);
	if (legacyNames.length === 0) return response;

	const headers = new Headers(response.headers);
	for (const name of new Set(legacyNames)) {
		headers.append(
			"set-cookie",
			`${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${
				name.startsWith("__Secure-") ? "; Secure" : ""
			}`,
		);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: authTrustedOrigins,
	advanced: {
		cookies: {
			session_token: { name: authCookieNames.sessionToken },
			session_data: { name: authCookieNames.sessionData },
			account_data: { name: authCookieNames.accountData },
			dont_remember: { name: authCookieNames.dontRemember },
		},
	},
	database: prismaAdapter(prisma, {
		provider: "sqlite",
	}),
	emailAndPassword: {
		enabled: true,
		// DEC-005: usuarios sao criados exclusivamente pela administracao
		// (userService), que valida papel e memberships antes de persistir.
		disableSignUp: true,
		password: {
			hash: hashPassword,
			verify: ({ hash, password }: { hash: string; password: string }) =>
				verifyPassword(hash, password),
			validate: (password: string) => {
				if (password.length < 8) {
					return "A senha deve ter pelo menos 8 caracteres";
				}
				if (!/[A-Z]/.test(password)) {
					return "A senha deve conter pelo menos 1 letra maiuscula";
				}
				if (!/[a-z]/.test(password)) {
					return "A senha deve conter pelo menos 1 letra minuscula";
				}
				if (!/[0-9]/.test(password)) {
					return "A senha deve conter pelo menos 1 numero";
				}
				return true;
			},
		},
		requireEmailVerification: false,
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					return {
						data: { ...user, emailVerified: true },
					};
				},
			},
		},
	},
	plugins: [
		admin({
			defaultBanReason: "Banido",
			defaultBanExpiresIn: 60 * 60 * 24 * 30,
		}),
	],
	basePath: "/api/auth",
});

export type Session = typeof auth.$Infer.Session;
