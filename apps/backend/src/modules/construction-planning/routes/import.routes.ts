import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { rateLimitApi } from "../../../lib/rate-limit";
import { resolveAuth } from "../../../lib/resolve-auth";
import { xlsxResponse } from "../export.service";
import { constructionImportBatchService } from "../imports/import-batch.service";
import { getImportById, listImports } from "../imports/import-repository";
import {
	WORKBOOK_KINDS,
	type WorkbookKind,
} from "../templates/workbook-contracts";
import { assertValidXlsxUpload } from "./upload-guards";

function resolveKind(value: string | undefined): WorkbookKind {
	const kind = value as WorkbookKind | undefined;
	if (!kind || kind === "obra-completa" || !WORKBOOK_KINDS.includes(kind)) {
		throw new ConstructionError(
			"INVALID_KIND",
			"Tipo de workbook invalido",
			400,
		);
	}
	return kind;
}

export const importRoutes = new Elysia({
	prefix: "/imports",
	name: "import-routes",
})
	.use(resolveAuth)
	.use(rateLimitApi({ windowMs: 60 * 1000, max: 30, key: "import" }))
	.use(requireRole("read"))
	.get(
		"/",
		async ({ query, user }) => {
			const page = query.page ? Number(query.page) : undefined;
			const pageSize = query.pageSize ? Number(query.pageSize) : undefined;
			if (
				(page !== undefined && !Number.isInteger(page)) ||
				(pageSize !== undefined && !Number.isInteger(pageSize))
			) {
				throw new ConstructionError(
					"INVALID_QUERY",
					"Parametros invalidos",
					400,
				);
			}
			return listImports(user.id, {
				workId: query.workId ?? null,
				page,
				pageSize,
			});
		},
		{
			query: t.Object({
				workId: t.Optional(t.String()),
				page: t.Optional(t.String()),
				pageSize: t.Optional(t.String()),
			}),
			detail: { tags: ["Import"] },
		},
	)
	.get(
		"/:importId",
		async ({ params, user }) => {
			const imp = await getImportById(user.id, params.importId);
			if (!imp) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Importacao nao encontrada",
					404,
				);
			}
			return imp;
		},
		{
			params: t.Object({ importId: t.String() }),
			detail: { tags: ["Import"] },
		},
	);

// Fluxo transacional do Plano 5: upload -> staging (ImportBatch/ImportRow)
// -> preview paginado -> confirmacao atomica. Nenhum dado operacional e
// criado antes da confirmacao.
export const importBatchRoutes = new Elysia({
	prefix: "/works",
	name: "import-batch-routes",
})
	.use(resolveAuth)
	.use(rateLimitApi({ windowMs: 60 * 1000, max: 30, key: "import" }))
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/:workId/import-batches/:batchId",
		async ({ params, query, scope }) => {
			const page = query.page ? Number(query.page) : 1;
			const pageSize = query.pageSize ? Number(query.pageSize) : 500;
			return constructionImportBatchService.getPreviewPage(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
				page,
				pageSize,
			);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				pageSize: t.Optional(t.String()),
			}),
			detail: { tags: ["Import"] },
		},
	)
	.get(
		"/:workId/import-batches/:batchId/selectable-row-ids",
		async ({ params, scope }) =>
			constructionImportBatchService.listSelectableRowIds(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
			),
		{ detail: { tags: ["Import"] } },
	)
	.get(
		"/:workId/import-batches",
		async ({ params, query, scope }) => {
			const page = query.page ? Number(query.page) : 1;
			const pageSize = query.pageSize ? Number(query.pageSize) : 20;
			return constructionImportBatchService.listBatches(
				scope.resourceOwnerId,
				params.workId,
				page,
				pageSize,
			);
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				pageSize: t.Optional(t.String()),
			}),
			detail: { tags: ["Import"] },
		},
	)
	.get(
		"/:workId/import-batches/:batchId/rejected",
		async ({ params, scope }) => {
			const sheet = await constructionImportBatchService.exportRejectedSheet(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
			);
			return xlsxResponse(
				Buffer.from(sheet),
				`rejeitadas-${params.batchId}.xlsx`,
			);
		},
		{ detail: { tags: ["Import"] } },
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/:workId/import-batches",
		async ({ params, body, scope }) => {
			assertValidXlsxUpload(body.file);
			const model = resolveKind(body.model);
			const page = await constructionImportBatchService.createBatch(
				scope.resourceOwnerId,
				params.workId,
				{
					fileName: body.file.name,
					model,
					file: body.file.stream(),
					reprocessOfId: body.reprocessOfId ?? null,
					reason: body.reason ?? null,
				},
			);
			return new Response(JSON.stringify(page), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		},
		{
			body: t.Object({
				file: t.File(),
				model: t.String(),
				reprocessOfId: t.Optional(t.String()),
				reason: t.Optional(t.String()),
			}),
			detail: { tags: ["Import"] },
		},
	)
	.post(
		"/:workId/import-batches/:batchId/confirm",
		async ({ params, body, user, scope }) => {
			return constructionImportBatchService.confirmImport({
				ownerId: scope.resourceOwnerId,
				actorId: user.id,
				workId: params.workId,
				batchId: params.batchId,
				expectedBatchVersion: body.expectedBatchVersion,
				selectedRowIds: body.selectedRowIds,
				idempotencyKey: body.idempotencyKey,
			});
		},
		{
			body: t.Object({
				expectedBatchVersion: t.Number(),
				selectedRowIds: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
				idempotencyKey: t.String({ minLength: 1 }),
			}),
			detail: { tags: ["Import"] },
		},
	);

export const importBatchCancelRoutes = new Elysia({
	prefix: "/works",
	name: "import-batch-cancel-routes",
})
	.use(resolveAuth)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.delete(
		"/:workId/import-batches/:batchId",
		({ params, scope }) =>
			constructionImportBatchService.cancelBatch(
				scope.resourceOwnerId,
				params.workId,
				params.batchId,
			),
		{ detail: { tags: ["Import"] } },
	);
