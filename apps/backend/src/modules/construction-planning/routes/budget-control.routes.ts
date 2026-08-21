import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { throwInvalidInput } from "../../../lib/zod-validation";
import { budgetPreviewSchema } from "../budget-control/budget-control.schema";
import { budgetControlService } from "../budget-control/budget-control.service";

export const budgetControlRoutes = new Elysia({
	prefix: "/works/:workId/budget",
	name: "budget-control-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/availability",
		async ({ params, query, scope }) => {
			const budgetItemIds = (query.budgetItemIds ?? "")
				.split(",")
				.map((id) => id.trim())
				.filter((id) => id.length > 0);
			return budgetControlService.getAvailability(
				scope.resourceOwnerId,
				params.workId,
				budgetItemIds,
			);
		},
		{
			query: t.Object({
				budgetItemIds: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Budget"],
				summary: "Disponibilidade orçamentária por item",
			},
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/preview",
		async ({ params, body, scope }) => {
			const parsed = budgetPreviewSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			return budgetControlService.preview(
				scope.resourceOwnerId,
				params.workId,
				parsed.data,
			);
		},
		{
			body: t.Object({
				allocations: t.Array(
					t.Object({
						budgetItemId: t.String(),
						quantity: t.Optional(t.Number()),
						value: t.Optional(t.Number()),
						percentage: t.Optional(t.Number()),
					}),
				),
				amount: t.Optional(t.Number()),
			}),
			detail: {
				tags: ["Budget"],
				summary: "Prévia de impacto orçamentário",
			},
		},
	);
