import { Elysia, t } from "elysia";
import { assertRoleCan } from "../../../lib/authorization";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { parseInput } from "../../../lib/zod-validation";
import { quotationService } from "../quotation.service";
import { quotationImportService } from "../quotation-import.service";
import { createQuotationSchema } from "../schemas/contract.schema";

export const quotationRoutes = new Elysia({
	prefix: "/works/:workId/quotations",
	name: "quotation-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/",
		async ({ params, scope }) =>
			quotationService.list(scope.resourceOwnerId, params.workId),
		{ detail: { tags: ["Quotations"] } },
	)
	.get(
		"/:quotationId",
		async ({ params, scope }) =>
			quotationService.get(scope.resourceOwnerId, params.quotationId),
		{ detail: { tags: ["Quotations"] } },
	)
	.get(
		"/:quotationId/comparison",
		async ({ params, scope }) =>
			quotationService.getComparison(
				scope.resourceOwnerId,
				params.workId,
				params.quotationId,
			),
		{ detail: { tags: ["Quotations"] } },
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/:quotationId/import",
		async ({ params, body, scope }) =>
			quotationImportService.createPreview(
				scope.resourceOwnerId,
				params.workId,
				params.quotationId,
				body.file,
			),
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Quotation Imports"] },
		},
	)
	.get(
		"/:quotationId/import/:batchId",
		async ({ params, query, scope }) =>
			quotationImportService.getPreview(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
				query.page ? Number(query.page) : 1,
				query.pageSize ? Number(query.pageSize) : 500,
			),
		{
			query: t.Object({
				page: t.Optional(t.String()),
				pageSize: t.Optional(t.String()),
			}),
			detail: { tags: ["Quotation Imports"] },
		},
	)
	.get(
		"/:quotationId/import/:batchId/selectable-row-ids",
		async ({ params, scope }) =>
			quotationImportService.listSelectableRows(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
			),
		{ detail: { tags: ["Quotation Imports"] } },
	)
	.post(
		"/:quotationId/import/:batchId/confirm",
		async ({ params, body, scope }) =>
			quotationImportService.confirm(
				scope.resourceOwnerId,
				params.workId,
				params.quotationId,
				{
					batchId: params.batchId,
					expectedBatchVersion: body.expectedBatchVersion,
					selectedRowIds: body.selectedRowIds,
					idempotencyKey: body.idempotencyKey,
				},
			),
		{
			body: t.Object({
				expectedBatchVersion: t.Number(),
				selectedRowIds: t.Array(t.String()),
				idempotencyKey: t.String(),
			}),
			detail: { tags: ["Quotation Imports"] },
		},
	)
	.get(
		"/:quotationId/import/:batchId/rejected",
		async ({ params, scope }) => {
			const sheet = await quotationImportService.exportRejectedSheet(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
			);
			return new Response(Buffer.from(sheet), {
				headers: {
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"Content-Disposition":
						'attachment; filename="linhas-rejeitadas.xlsx"',
				},
			});
		},
		{ detail: { tags: ["Quotation Imports"] } },
	)
	.post(
		"/",
		async ({ params, body, scope, user }) => {
			const parsed = parseInput(createQuotationSchema, body);
			return quotationService.create(
				scope.resourceOwnerId,
				params.workId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				serviceType: t.Optional(t.String()),
				title: t.String(),
				observation: t.Optional(t.Nullable(t.String())),
				startDate: t.Optional(t.Nullable(t.String())),
				endDate: t.Optional(t.Nullable(t.String())),
				maxSuppliers: t.Optional(t.Number()),
				items: t.Array(
					t.Object({
						budgetItemId: t.String(),
						quantity: t.Number(),
					}),
				),
			}),
			detail: { tags: ["Quotations"] },
		},
	)
	.post(
		"/:quotationId/proposals",
		async ({ params, body, scope }) =>
			quotationService.addProposal(
				scope.resourceOwnerId,
				params.quotationId,
				body,
			),
		{
			body: t.Object({
				supplierId: t.Optional(t.Nullable(t.String())),
				supplierDocument: t.Optional(t.Nullable(t.String())),
				supplierName: t.String(),
				value: t.Number({ minimum: 0 }),
				justification: t.Optional(t.Nullable(t.String())),
			}),
			detail: { tags: ["Quotations"] },
		},
	)
	.post(
		"/:quotationId/requote",
		async ({ params, scope }) =>
			quotationService.requote(scope.resourceOwnerId, params.quotationId),
		{ detail: { tags: ["Quotations"] } },
	)
	.post(
		"/:quotationId/revert-contract",
		async ({ params, scope, user }) => {
			assertRoleCan(user.role, "approve");
			return quotationService.revertContract(
				scope.resourceOwnerId,
				params.workId,
				params.quotationId,
				{ userId: user.id },
			);
		},
		{ detail: { tags: ["Quotations"] } },
	)
	.patch(
		"/:quotationId/proposals/:proposalId/negotiate",
		async ({ params, body, scope, user }) =>
			quotationService.negotiate(
				scope.resourceOwnerId,
				params.quotationId,
				params.proposalId,
				body,
				{ userId: user.id },
			),
		{
			body: t.Object({
				value: t.Number({ minimum: 0 }),
				justification: t.String(),
			}),
			detail: { tags: ["Quotations"] },
		},
	)
	.post(
		"/:quotationId/choose/:proposalId",
		async ({ params, scope, user }) => {
			assertRoleCan(user.role, "approve");
			return quotationService.chooseWinner(
				scope.resourceOwnerId,
				params.quotationId,
				params.proposalId,
				{ userId: user.id },
			);
		},
		{ detail: { tags: ["Quotations"] } },
	);
