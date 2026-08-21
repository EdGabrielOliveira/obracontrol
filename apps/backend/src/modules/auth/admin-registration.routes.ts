import { Elysia, t } from "elysia";
import { rateLimitApi } from "../../lib/rate-limit";
import { adminRegistrationService } from "./admin-registration.service";

export const adminRegistrationRoutes = new Elysia({
	prefix: "/api/auth",
	name: "admin-registration-routes",
})
	.use(
		rateLimitApi({
			windowMs: 15 * 60 * 1000,
			max: 10,
			key: "admin-registration",
		}),
	)
	.post(
		"/admin-signup",
		async ({ body, set }) => {
			set.status = 201;
			return adminRegistrationService.create(body);
		},
		{
			body: t.Object({
				email: t.String({ format: "email" }),
				password: t.String({ minLength: 8 }),
				authorizationKey: t.String({ minLength: 1 }),
			}),
			detail: {
				tags: ["Auth"],
				summary: "Criar conta administrador",
				description:
					"Cria uma conta ADMIN usando a chave de autorização configurada como segredo no backend. O e-mail é marcado como validado e nenhum e-mail é enviado.",
			},
		},
	);
