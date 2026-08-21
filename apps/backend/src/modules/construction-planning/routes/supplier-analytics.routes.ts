import { Elysia, t } from "elysia";
import { requireRole } from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { resolveAuth } from "../../../lib/resolve-auth";
import { resolveResourceScope } from "../../../lib/resource-scope";
import { supplierAnalyticsService } from "../suppliers/supplier-analytics.service";

export const supplierAnalyticsRoutes = new Elysia({
	prefix: "/suppliers/analytics",
	name: "supplier-analytics-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/",
		async ({ query, user }) => {
			if (query.workId) {
				const scope = await resolveResourceScope(user.id, {
					workId: query.workId,
				});
				if (!scope.canRead) {
					throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
				}
			}
			return supplierAnalyticsService.list(user.id, {
				q: query.q,
				workId: query.workId,
				sort: query.sort,
				order: query.order,
				page: query.page,
				limit: query.limit,
			});
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				workId: t.Optional(t.String()),
				sort: t.Optional(
					t.Union([
						t.Literal("contractCount"),
						t.Literal("contractedAmount"),
						t.Literal("measuredAmount"),
						t.Literal("paidAmount"),
					]),
				),
				order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
				page: t.Optional(t.Numeric({ minimum: 1 })),
				limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
			}),
			detail: { tags: ["Suppliers"] },
		},
	);
