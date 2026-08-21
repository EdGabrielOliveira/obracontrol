import cors from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia, type ElysiaAdapter } from "elysia";
import { env } from "./env";
import { auth, authTrustedOrigins, expireLegacyAuthCookies } from "./lib/auth";
import { bruteForceAfter, bruteForceGuard } from "./lib/brute-force";
import { handleConstructionError } from "./lib/construction-error-handler";
import { globalAuth } from "./lib/global-auth";
import { internalRoutes } from "./lib/internal-routes";
import { logger } from "./lib/logger";
import { metrics } from "./lib/metrics";
import { enrichOpenApiDocument } from "./lib/openapi-documentation";
import { prisma } from "./lib/prisma";
import { rateLimitApi } from "./lib/rate-limit";
import { requestContextPlugin } from "./lib/request-context";
import { securityHeaders } from "./lib/security-headers";
import { decimalToNumber } from "./lib/serialize-helpers";
import { apiKeyRoutes } from "./modules/api-keys/routes";
import { auditRoutes } from "./modules/audit/routes";
import { adminRegistrationRoutes } from "./modules/auth/admin-registration.routes";
import { authorizationSessionRoutes } from "./modules/auth/authorization.routes";
import { constructionPlanningController } from "./modules/construction-planning/routes";
import { governanceRoutes } from "./modules/governance/routes";
import { organizationController } from "./modules/organizations/routes";
import { invitationAcceptRoutes, userRoutes } from "./modules/users/routes";

const requestStarts = new WeakMap<Request, number>();

export function createApp(options?: {
	adapter?: ElysiaAdapter;
	aot?: boolean;
}) {
	return new Elysia(options)
		.use(requestContextPlugin)
		.onRequest(({ request }) => {
			requestStarts.set(request, performance.now());
		})
		.onAfterResponse(({ request, response, route }) => {
			const startedAt = requestStarts.get(request);
			if (startedAt === undefined) return;
			const duration = performance.now() - startedAt;
			const status = response instanceof Response ? response.status : 200;
			const routeName = route || new URL(request.url).pathname;
			metrics.timing(`http.${request.method}.${routeName}`, duration);
			metrics.increment(`http.status.${status}`);
		})
		.onAfterHandle({ as: "global" }, async ({ request, response }) => {
			if (!new URL(request.url).pathname.endsWith("/openapi/json"))
				return response;
			if (response instanceof Response) {
				const document = await response.clone().json();
				const enriched = enrichOpenApiDocument(document);
				const headers = new Headers(response.headers);
				headers.delete("content-length");
				return new Response(JSON.stringify(enriched), {
					status: response.status,
					headers,
				});
			}
			return enrichOpenApiDocument(response);
		})
		.use(
			swagger({
				path: "/openapi",
				documentation: {
					info: {
						title: "ObraControl API",
						version: "1.0.0",
						description:
							"API de gestao de obras — orcamento, medicoes, contratos, BI e relatorios. Autenticacao via Better Auth (cookie de sessao). Hierarquia: Orgao > Centro de Custo > Obra.",
					},
					tags: [
						{ name: "Health", description: "Health check" },
						{
							name: "Works",
							description: "Obras — CRUD, medicoes, custos",
						},
						{
							name: "Import",
							description: "Importacao de planilhas Excel (6 abas unificadas)",
						},
						{
							name: "Work Measurements",
							description:
								"Medicao de Obras — CRUD + mapa + relatorios + resumo",
						},
						{
							name: "Contracts",
							description:
								"Contratos — CRUD + resumo + medicoes cross-contrato",
						},
						{
							name: "Contract Services",
							description:
								"Servicos de contrato — CRUD + vinculo com orcamento",
						},
						{
							name: "Contract Measurements",
							description: "Medicoes de contrato — CRUD + mapa hierarquico",
						},
						{
							name: "Contract Payments",
							description: "Pagamentos de contrato — CRUD + resumo",
						},
						{
							name: "Contract Files",
							description: "Arquivos de contrato — pastas + upload/delete",
						},
						{ name: "Management", description: "Dashboard de gestao da obra" },
						{
							name: "Schedule",
							description: "Cronograma e cronograma fisico-financeiro",
						},
						{
							name: "Reports",
							description:
								"Relatorios gerenciais (obra, contrato, CC, fotografico)",
						},
						{
							name: "Export",
							description:
								"Exportacao Excel (orcamento, cronograma, medicoes, custos, contratos, completo)",
						},
						{
							name: "BI",
							description:
								"Business Intelligence — EVM, Curva S, MultiObras, IDC/IDP",
						},
						{
							name: "Governance",
							description:
								"Estados, revisoes, aceite, travamento e reabertura controlada",
						},
						{ name: "Templates", description: "Modelos Excel para download" },
						{
							name: "Organizations",
							description: "Orgaos e Centros de Custo — CRUD + BI",
						},
						{
							name: "API Keys",
							description: "Chaves de API — criar, listar, revogar",
						},
						{ name: "Admin", description: "Administracao de usuarios" },
					],
				},
			}),
		)
		.onError(handleConstructionError)
		.onAfterHandle(({ response }) => {
			if (response instanceof Response) return response;
			return decimalToNumber(response);
		})
		.use(
			cors({
				origin: authTrustedOrigins,
				methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
				credentials: true,
				allowedHeaders: [
					"Content-Type",
					"Authorization",
					"Cache-Control",
					"Idempotency-Key",
				],
			}),
		)
		.use(rateLimitApi({ windowMs: 60 * 1000, max: 300 }))
		.use(securityHeaders)
		.use(globalAuth)
		.use(authorizationSessionRoutes)
		.use(adminRegistrationRoutes)
		.all("/api/auth/*", async ({ request }) => {
			const blocked = await bruteForceGuard(request);
			if (blocked) return blocked;

			const response = await auth.handler(request);

			bruteForceAfter(request, response as Response);
			return expireLegacyAuthCookies(request, response as Response);
		})
		.get("/health", async ({ set }) => {
			try {
				await prisma.$queryRaw`SELECT 1`;
				return { status: "ok", database: "connected" };
			} catch (error) {
				const errorCode =
					typeof error === "object" && error !== null && "code" in error
						? String((error as { code?: unknown }).code)
						: undefined;
				logger.warn("health.database_unavailable", { errorCode });
				set.status = 503;
				return { status: "error", database: "disconnected", errorCode };
			}
		})
		.use(constructionPlanningController)
		.use(governanceRoutes)
		.use(organizationController)
		.use(auditRoutes)
		.use(apiKeyRoutes)
		.use(userRoutes)
		.use(invitationAcceptRoutes)
		.use(internalRoutes);
}
