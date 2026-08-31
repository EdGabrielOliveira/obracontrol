import { Elysia, t } from "elysia";
import { parseAsOfDate } from "../../../lib/as-of-date";
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
				parseAsOfDate(query.asOfDate),
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
				asOfDate: t.Optional(t.String()),
			}),
		},
	);
