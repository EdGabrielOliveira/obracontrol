import { Elysia, t } from "elysia";
import { apiKeyService } from "../../lib/api-key.service";
import { requireRole } from "../../lib/authorization-middleware";
import { handleConstructionError } from "../../lib/construction-error-handler";
import { resolveAuth } from "../../lib/resolve-auth";

export const apiKeyRoutes = new Elysia({
	prefix: "/api-keys",
	name: "api-key-routes",
})
	.use(resolveAuth)
	.use(requireRole("admin"))
	.onError(handleConstructionError)
	.post(
		"/",
		async ({ body, user }) => {
			return apiKeyService.createKey(user.id, user.id, {
				name: body.name,
				expiresInDays: body.expiresInDays,
				organizationId: body.organizationId,
			});
		},
		{
			body: t.Object({
				name: t.String(),
				expiresInDays: t.Optional(t.Number()),
				organizationId: t.Optional(t.String()),
			}),
			detail: {
				tags: ["API Keys"],
				summary: "Criar chave de API",
				description:
					"Cria uma chave para integração externa e devolve o segredo uma única vez junto dos metadados de expiração.",
			},
		},
	)
	.get(
		"/",
		async ({ query, user }) => {
			const { apiKeyFilterSchema } = await import("./schema");
			const parsed = apiKeyFilterSchema.safeParse(query);
			const filters = parsed.success ? parsed.data : {};
			return apiKeyService.listKeys(user.id, user.id, filters);
		},
		{
			detail: {
				tags: ["API Keys"],
				summary: "Listar chaves de API",
				description:
					"Lista as chaves ativas do usuário autenticado com paginação e sem reexibir o segredo.",
			},
		},
	)
	.get(
		"/:keyId",
		async ({ params, user }) => {
			return apiKeyService.getKey(user.id, user.id, params.keyId);
		},
		{
			detail: {
				tags: ["API Keys"],
				summary: "Detalhar chave de API",
				description:
					"Retorna os metadados de uma chave específica sem expor seu segredo.",
			},
		},
	)
	.delete(
		"/:keyId",
		async ({ params, user }) => {
			return apiKeyService.revokeKey(user.id, user.id, params.keyId);
		},
		{
			detail: {
				tags: ["API Keys"],
				summary: "Revogar chave de API",
				description:
					"Revoga a chave indicada e impede novas autenticações com ela.",
			},
		},
	);
