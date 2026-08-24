import { Elysia } from "elysia";
import { apiKeyService } from "./api-key.service";
import type { Session } from "./auth";
import { getSessionUser } from "./auth-middleware";
import { isAuthorizationRole } from "./authorization";
import { ConstructionError } from "./errors";
import { prisma } from "./prisma";
import { requestContext } from "./request-context";
import { requestPath } from "./request-path";
import { isTenantApiRouteAllowed } from "./tenant-api-allowlist";

type AuthUser = Session["user"] & { role?: string | null };

function assertAuthorizedRole(
	role: string | null | undefined,
): asserts role is string {
	if (!isAuthorizationRole(role)) {
		throw new ConstructionError(
			"UNAUTHORIZED",
			"Papel do usuario nao e mais valido; faca login novamente",
			401,
		);
	}
}

export async function resolveAuthenticatedUser(
	request: Request,
): Promise<{ user: AuthUser }> {
	const authHeader = request.headers.get("authorization");

	if (authHeader?.startsWith("Bearer obi_")) {
		const token = authHeader.slice(7).trim();
		const keyResult = await apiKeyService.validateKey(token);
		if (!keyResult) {
			throw new ConstructionError(
				"UNAUTHORIZED",
				"Chave de API invalida ou revogada",
				401,
			);
		}
		const user = await prisma.user.findUnique({
			where: { id: keyResult.userId },
			select: { role: true, banned: true },
		});
		if (!user || user.banned) {
			throw new ConstructionError("UNAUTHORIZED", "Usuario desativado", 401);
		}
		assertAuthorizedRole(user.role);
		const pathname = requestPath(request);
		if (!isTenantApiRouteAllowed(request.method, pathname)) {
			throw new ConstructionError(
				request.method.toUpperCase() === "GET"
					? "FORBIDDEN"
					: "METHOD_NOT_ALLOWED",
				request.method.toUpperCase() === "GET"
					? "Esta rota nao esta disponivel para chaves de API"
					: "Chaves de API permitem apenas requisicoes GET",
				request.method.toUpperCase() === "GET" ? 403 : 405,
			);
		}
		requestContext.setUserId(keyResult.userId);
		requestContext.setApiKeyOrgScope(keyResult.organizationId ?? null);
		return {
			user: {
				id: keyResult.userId,
				name: "",
				email: "",
				emailVerified: true,
				image: null,
				banned: false,
				role: user.role,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		};
	}

	const sessionUser = await getSessionUser(request);
	const user = await prisma.user.findUnique({
		where: { id: sessionUser.id },
		select: { role: true, banned: true },
	});
	if (!user || user.banned) {
		throw new ConstructionError("UNAUTHORIZED", "Usuario desativado", 401);
	}
	const role = (sessionUser as AuthUser).role ?? user.role;
	assertAuthorizedRole(role);
	requestContext.setUserId(sessionUser.id);
	return {
		user: {
			...(sessionUser as AuthUser),
			role,
		},
	};
}

export const resolveAuth = new Elysia({ name: "resolve-auth" }).resolve(
	{ as: "scoped" },
	async ({ request }) => resolveAuthenticatedUser(request),
);
