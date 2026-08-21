import { Elysia } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { exportService } from "../export.service";
import { buildWorkbookTemplate } from "../templates/template-generator";
import type { WorkbookKind } from "../templates/workbook-contracts";

const KINDS: { kind: WorkbookKind; filename: string }[] = [
	{ kind: "orcamento", filename: "modelo-orcamento.xlsx" },
	{ kind: "orcamento-aditivo", filename: "modelo-orcamento-aditivo.xlsx" },
	{ kind: "cronograma", filename: "modelo-cronograma.xlsx" },
	{ kind: "medicao-obra", filename: "modelo-medicao-obra.xlsx" },
	{ kind: "medicao-contrato", filename: "modelo-medicao-contrato.xlsx" },
	{ kind: "custos", filename: "modelo-custos.xlsx" },
	{ kind: "cotacao", filename: "modelo-cotacao.xlsx" },
];

function xlsxResponse(buffer: Uint8Array, filename: string): Response {
	return new Response(buffer as unknown as Blob, {
		headers: {
			"content-type":
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"content-disposition": `attachment; filename="${filename}"`,
		},
	});
}

export const templateRoutes = new Elysia({ name: "template-routes" });

for (const { kind, filename } of KINDS) {
	templateRoutes.get(
		`/templates/${kind}`,
		() => xlsxResponse(buildWorkbookTemplate(kind), filename),
		{ detail: { tags: ["Templates"] } },
	);
}

templateRoutes
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/templates/orcamento-aditivo/:workId",
		({ params, scope }) =>
			exportService.exportOrcamentoAditivoTemplate(
				scope.resourceOwnerId,
				params.workId,
			),
		{ detail: { tags: ["Templates"] } },
	)
	.get(
		"/templates/cronograma/:workId",
		({ params, scope }) =>
			exportService.exportCronogramaTemplate(
				scope.resourceOwnerId,
				params.workId,
			),
		{
			detail: {
				tags: ["Templates"],
				summary: "Baixar modelo de cronograma vinculado ao orçamento",
			},
		},
	);
