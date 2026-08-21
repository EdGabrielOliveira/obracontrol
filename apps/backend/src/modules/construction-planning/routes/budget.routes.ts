import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { prisma } from "../../../lib/prisma";
import { resolveAuth } from "../../../lib/resolve-auth";
import { throwInvalidInput } from "../../../lib/zod-validation";
import { auditService } from "../../audit/audit.service";
import { budgetService } from "../budget.service";
import {
	createBudgetItemSchema,
	reorderBudgetItemsSchema,
	updateBdiSchema,
	updateBudgetItemSchema,
} from "../schemas/budget.schema";

export const budgetRoutes = new Elysia({
	prefix: "/works/:workId/budget",
	name: "budget-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/",
		async ({ params, scope }) =>
			budgetService.getBudget(scope.resourceOwnerId, params.workId),
		{ detail: { tags: ["Budget"] } },
	)
	.get(
		"/items/:itemId",
		async ({ params, scope }) =>
			budgetService.getBudgetItem(
				scope.resourceOwnerId,
				params.workId,
				params.itemId,
			),
		{ detail: { tags: ["Budget"] } },
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/items",
		async ({ params, body, user, set, scope }) => {
			const parsed = createBudgetItemSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			set.status = 201;
			const createdItem = await budgetService.createItem(
				scope.resourceOwnerId,
				params.workId,
				parsed.data,
			);
			if (createdItem) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "CREATE",
					entityType: "BUDGET_ITEM",
					entityId: createdItem.id,
					entityDescription: `Item ${createdItem.index} - ${createdItem.description}`,
					newState: createdItem as unknown as Record<string, unknown>,
				});
			}
			return createdItem;
		},
		{
			body: t.Object({
				parentId: t.Optional(t.Union([t.String(), t.Null()])),
				index: t.String(),
				type: t.Union([
					t.Literal("STAGE"),
					t.Literal("SUBSTAGE"),
					t.Literal("ITEM"),
					t.Literal("COMPOSITION"),
					t.Literal("INPUT"),
				]),
				description: t.String(),
				unit: t.Optional(t.Union([t.String(), t.Null()])),
				quantity: t.Optional(t.Union([t.Number(), t.Null()])),
				laborUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				materialUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				equipmentUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				otherUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				unitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				totalCost: t.Optional(t.Union([t.Number(), t.Null()])),
				plannedStart: t.Optional(t.Union([t.String(), t.Null()])),
				plannedEnd: t.Optional(t.Union([t.String(), t.Null()])),
				actualStart: t.Optional(t.Union([t.String(), t.Null()])),
				actualEnd: t.Optional(t.Union([t.String(), t.Null()])),
				completionPercentage: t.Optional(t.Number()),
				providedStatus: t.Optional(t.Union([t.String(), t.Null()])),
				sortOrder: t.Optional(t.Number()),
			}),
			detail: { tags: ["Budget"] },
		},
	)
	.patch(
		"/items/reorder",
		async ({ params, body, scope }) => {
			const parsed = reorderBudgetItemsSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			return budgetService.reorderItems(
				scope.resourceOwnerId,
				params.workId,
				parsed.data.items,
			);
		},
		{
			body: t.Object({
				items: t.Array(
					t.Object({
						id: t.String(),
						sortOrder: t.Number(),
					}),
				),
			}),
			detail: { tags: ["Budget"] },
		},
	)
	.patch(
		"/items/:itemId",
		async ({ params, body, user, scope }) => {
			const parsed = updateBudgetItemSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			const old = await prisma.constructionBudgetItem.findUnique({
				where: { id: params.itemId },
			});
			const updatedItem = await budgetService.updateItem(
				scope.resourceOwnerId,
				params.workId,
				params.itemId,
				parsed.data,
			);
			if (updatedItem) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "UPDATE",
					entityType: "BUDGET_ITEM",
					entityId: params.itemId,
					entityDescription: `Item ${updatedItem.index} - ${updatedItem.description}`,
					previousState: old as unknown as Record<string, unknown>,
					newState: updatedItem as unknown as Record<string, unknown>,
				});
			}
			return updatedItem;
		},
		{
			body: t.Object({
				parentId: t.Optional(t.Union([t.String(), t.Null()])),
				index: t.Optional(t.String()),
				type: t.Optional(
					t.Union([
						t.Literal("STAGE"),
						t.Literal("SUBSTAGE"),
						t.Literal("ITEM"),
						t.Literal("COMPOSITION"),
						t.Literal("INPUT"),
					]),
				),
				description: t.Optional(t.String()),
				unit: t.Optional(t.Union([t.String(), t.Null()])),
				quantity: t.Optional(t.Union([t.Number(), t.Null()])),
				laborUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				materialUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				equipmentUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				otherUnitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				unitCost: t.Optional(t.Union([t.Number(), t.Null()])),
				totalCost: t.Optional(t.Union([t.Number(), t.Null()])),
				plannedStart: t.Optional(t.Union([t.String(), t.Null()])),
				plannedEnd: t.Optional(t.Union([t.String(), t.Null()])),
				actualStart: t.Optional(t.Union([t.String(), t.Null()])),
				actualEnd: t.Optional(t.Union([t.String(), t.Null()])),
				completionPercentage: t.Optional(t.Number()),
				providedStatus: t.Optional(t.Union([t.String(), t.Null()])),
				sortOrder: t.Optional(t.Number()),
			}),
			detail: { tags: ["Budget"] },
		},
	)
	.delete(
		"/items/:itemId",
		async ({ params, user, scope }) => {
			const old = await prisma.constructionBudgetItem.findUnique({
				where: { id: params.itemId },
			});
			await budgetService.deleteItem(
				scope.resourceOwnerId,
				params.workId,
				params.itemId,
			);
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "DELETE",
					entityType: "BUDGET_ITEM",
					entityId: params.itemId,
					entityDescription: `Item ${old.index} - ${old.description}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Budget"] } },
	)
	.patch(
		"/bdi",
		async ({ params, body, scope }) => {
			const parsed = updateBdiSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			return budgetService.updateBdi(
				scope.resourceOwnerId,
				params.workId,
				parsed.data,
			);
		},
		{
			body: t.Object({
				bdiPercentage: t.Number(),
			}),
			detail: { tags: ["Budget"] },
		},
	)
	.put(
		"/import",
		async ({ params, body, set, scope }) => {
			const result = await budgetService.importBudget(
				scope.resourceOwnerId,
				params.workId,
				body,
			);
			set.status = result.errors.length > 0 ? 200 : 201;
			return result;
		},
		{
			body: t.Object({
				file: t.File(),
				sheetName: t.Optional(t.String()),
			}),
			detail: { tags: ["Budget"] },
		},
	);
