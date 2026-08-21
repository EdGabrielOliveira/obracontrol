import { Elysia } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { listCurrentCostBudgetItems } from "../cost-budget-item.service";

export const costBudgetItemsRoutes = new Elysia({
	prefix: "/works/:workId/budget-versions",
	name: "cost-budget-items-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/effective/cost-items",
		async ({ params, scope }) =>
			listCurrentCostBudgetItems(scope.resourceOwnerId, params.workId),
		{
			detail: {
				tags: ["Budget"],
				summary: "Itens folha elegíveis da versão vigente para custos",
			},
		},
	);
