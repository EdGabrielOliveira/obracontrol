import { Elysia, t } from "elysia";
import { requireWorkAccess } from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { getWorkStatistics } from "../statistics/statistics.service";

export const statisticsRoutes = new Elysia({ name: "statistics-routes" })
	.use(resolveAuth)
	.use(requireWorkAccess("read"))
	.get(
		"/works/:workId/statistics",
		({ params, query, scope }) =>
			getWorkStatistics(
				scope.resourceOwnerId,
				params.workId,
				query.period ?? "monthly",
			),
		{
			query: t.Object({
				period: t.Optional(
					t.Union([
						t.Literal("daily"),
						t.Literal("weekly"),
						t.Literal("monthly"),
					]),
				),
			}),
		},
	);
