import { Elysia } from "elysia";
import { resolveAuthenticatedUser } from "./resolve-auth";

const PUBLIC_PREFIXES = ["/health", "/api/auth/"];

function isApiKeyRequest(request: Request): boolean {
	return (
		request.headers.get("authorization")?.startsWith("Bearer obi_") ?? false
	);
}

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const globalAuth = new Elysia({ name: "global-auth" }).onBeforeHandle(
	{ as: "global" },
	async ({ request }) => {
		if (request.method === "OPTIONS") return;
		const pathname = new URL(request.url).pathname;
		if (isPublicPath(pathname) && !isApiKeyRequest(request)) return;
		await resolveAuthenticatedUser(request);
	},
);
