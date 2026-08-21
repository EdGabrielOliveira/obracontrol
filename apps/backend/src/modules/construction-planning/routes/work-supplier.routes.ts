import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { resolveAuth } from "../../../lib/resolve-auth";
import { supplierService } from "../suppliers/supplier.service";
import { importSupplierWorkbook } from "../suppliers/supplier-import.service";
import { assertValidXlsxUpload } from "./upload-guards";

export const workSupplierRoutes = new Elysia({
	prefix: "/works",
	name: "work-supplier-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/:workId/suppliers",
		({ params, scope }) =>
			supplierService.listForWork(scope.resourceOwnerId, params.workId),
		{
			params: t.Object({ workId: t.String() }),
			detail: { tags: ["Suppliers"] },
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/:workId/suppliers/import",
		async ({ params, body, scope }) => {
			assertValidXlsxUpload(body.file);
			return importSupplierWorkbook(
				scope.resourceOwnerId,
				params.workId,
				new Uint8Array(await body.file.arrayBuffer()),
			);
		},
		{
			params: t.Object({ workId: t.String() }),
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Suppliers"] },
		},
	)
	.post(
		"/:workId/suppliers/:supplierId",
		({ params, scope }) =>
			supplierService.linkToWork(
				scope.resourceOwnerId,
				params.workId,
				params.supplierId,
			),
		{
			params: t.Object({ workId: t.String(), supplierId: t.String() }),
			detail: { tags: ["Suppliers"] },
		},
	)
	.delete(
		"/:workId/suppliers/:supplierId",
		async ({ params, scope }) => {
			const result = await supplierService.unlinkFromWork(
				scope.resourceOwnerId,
				params.workId,
				params.supplierId,
			);
			if (!result) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Vinculo fornecedor-obra nao encontrado",
					404,
				);
			}
			return new Response(null, { status: 204 });
		},
		{
			params: t.Object({ workId: t.String(), supplierId: t.String() }),
			detail: { tags: ["Suppliers"] },
		},
	);
