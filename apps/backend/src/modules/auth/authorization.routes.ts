import { Elysia } from "elysia";
import { buildAuthorizationSession } from "../../lib/authorization-session";
import { resolveAuth } from "../../lib/resolve-auth";

export const authorizationSessionRoutes = new Elysia({
	prefix: "/api/auth",
	name: "authorization-session-routes",
})
	.use(resolveAuth)
	.get(
		"/authorization-session",
		async ({ user }) => buildAuthorizationSession(user.id),
		{
			detail: {
				tags: ["Auth"],
				summary: "Sessão de autorização com escopos e capacidades",
				description:
					"Retorna a fotografia de autorização da sessão, incluindo o papel, as organizações, os centros de custo e as capacidades calculadas pelo backend.",
			},
		},
	);
