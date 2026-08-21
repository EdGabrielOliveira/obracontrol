import { Elysia, t } from "elysia";
import { parseAsOfDate } from "../../../lib/as-of-date";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { managementService } from "../management.service";

export const managementRoutes = new Elysia({ name: "management-routes" })
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/works/:workId/management",
		async ({ params, query, scope }) => {
			return managementService.getDashboard(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: { tags: ["Management"] },
		},
	)
	.get(
		"/works/:workId/schedule/physical-financial",
		async ({ params, query, scope }) => {
			return managementService.getPhysicalFinancialSchedule(
				scope.resourceOwnerId,
				params.workId,
				query.period,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				period: t.Optional(
					t.Union([
						t.Literal("daily"),
						t.Literal("monthly"),
						t.Literal("biweekly"),
						t.Literal("weekly"),
					]),
				),
				asOfDate: t.Optional(t.String()),
			}),
			detail: { tags: ["Schedule"] },
		},
	);
