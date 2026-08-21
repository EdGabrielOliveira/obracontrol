import { Elysia, t } from "elysia";
import { requireRole } from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { resolveAuth } from "../../../lib/resolve-auth";
import { resolveResourceScope } from "../../../lib/resource-scope";
import { budgetReconciliationService } from "../budget-reconciliation.service";

async function assertWorkAccess(
	actorId: string,
	workId: string,
	action: "read" | "write",
): Promise<string> {
	const scope = await resolveResourceScope(actorId, { workId });
	const allowed = action === "write" ? scope.canWrite : scope.canRead;
	if (!allowed) {
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	}
	return scope.resourceOwnerId;
}

export const budgetReconciliationRoutes = new Elysia({
	prefix: "/reconciliation",
	name: "budget-reconciliation-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/pending",
		async ({ query, user }) => {
			const ownerId = await assertWorkAccess(user.id, query.workId, "read");
			return budgetReconciliationService.listPending(ownerId, query.workId);
		},
		{
			query: t.Object({ workId: t.String({ minLength: 1 }) }),
			detail: { tags: ["BudgetControl"] },
		},
	)
	.use(requireRole("write"))
	.post(
		"/suggest",
		async ({ body, user }) => {
			const ownerId = await assertWorkAccess(user.id, body.workId, "write");
			return budgetReconciliationService.suggestMatches(
				ownerId,
				body.workId,
				body.sourceType,
				body.sourceId,
			);
		},
		{
			body: t.Object({
				workId: t.String({ minLength: 1 }),
				sourceType: t.String({ minLength: 1 }),
				sourceId: t.String({ minLength: 1 }),
			}),
			detail: { tags: ["BudgetControl"] },
		},
	)
	.post(
		"/confirm",
		async ({ body, user }) => {
			const ownerId = await assertWorkAccess(user.id, body.workId, "write");
			return budgetReconciliationService.confirm(ownerId, {
				workId: body.workId,
				sourceType: body.sourceType,
				sourceId: body.sourceId,
				budgetItemId: body.budgetItemId,
				reason: body.reason,
				createdBy: user.id,
			});
		},
		{
			body: t.Object({
				workId: t.String({ minLength: 1 }),
				sourceType: t.String({ minLength: 1 }),
				sourceId: t.String({ minLength: 1 }),
				budgetItemId: t.String({ minLength: 1 }),
				reason: t.String({ minLength: 1 }),
			}),
			detail: { tags: ["BudgetControl"] },
		},
	)
	.post(
		"/reject",
		async ({ body, user }) => {
			const ownerId = await assertWorkAccess(user.id, body.workId, "write");
			return budgetReconciliationService.reject(ownerId, {
				workId: body.workId,
				sourceType: body.sourceType,
				sourceId: body.sourceId,
				reason: body.reason,
				createdBy: user.id,
			});
		},
		{
			body: t.Object({
				workId: t.String({ minLength: 1 }),
				sourceType: t.String({ minLength: 1 }),
				sourceId: t.String({ minLength: 1 }),
				reason: t.String({ minLength: 1 }),
			}),
			detail: { tags: ["BudgetControl"] },
		},
	);
