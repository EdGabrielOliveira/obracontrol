import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import {
	archiveBudgetVersion,
	createDraftBudgetVersion,
	getBudgetVersion,
	listBudgetVersions,
	resolveBudgetAnalysisVersion,
	resolveBudgetItemReference,
	submitBudgetVersion,
} from "../../../lib/budget-version-adapter";
import { resolveAuth } from "../../../lib/resolve-auth";
import {
	confirmBudgetVersionImport,
	createBudgetVersionImport,
	getBudgetVersionImportPreview,
} from "../budget-version-import.service";

export const budgetVersionRoutes = new Elysia({
	prefix: "/works/:workId/budget-versions",
	name: "budget-version-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/",
		({ params, user }) =>
			resolveBudgetAnalysisVersion(user.id, params.workId, {}),
		{
			detail: {
				tags: ["Budget"],
				summary: "Resolver versão de orçamento (baseline/efetiva)",
			},
		},
	)
	.post(
		"/imports",
		async ({ params, body, user }) =>
			createBudgetVersionImport(user.id, params.workId, {
				title: body.title,
				file: body.file,
			}),
		{
			body: t.Object({
				title: t.String({ minLength: 1, maxLength: 120 }),
				file: t.File(),
			}),
			detail: {
				tags: ["Budget"],
				summary:
					"Gerar preview de orçamento ou aditivo com alteração estrutural, financeira ou de cronograma",
			},
		},
	)
	.get(
		"/imports/:importId",
		async ({ params, query, user }) =>
			getBudgetVersionImportPreview(
				user.id,
				params.workId,
				params.importId,
				query,
			),
		{
			query: t.Object({
				page: t.Optional(t.Number({ minimum: 1 })),
				limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
				classification: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Budget"],
				summary:
					"Recuperar preview imutavel paginado e filtrado por classificacao",
			},
		},
	)
	.post(
		"/imports/:importId/confirm",
		async ({ params, body, headers, user }) =>
			confirmBudgetVersionImport(user.id, params.workId, params.importId, {
				expectedSourceVersionId: body.expectedSourceVersionId,
				idempotencyKey: headers["idempotency-key"],
			}),
		{
			body: t.Object({
				expectedSourceVersionId: t.Optional(t.Nullable(t.String())),
			}),
			headers: t.Object(
				{
					"idempotency-key": t.Optional(t.String()),
				},
				{ additionalProperties: true },
			),
			detail: {
				tags: ["Budget"],
				summary: "Confirmar preview alterado e criar rascunho",
			},
		},
	)
	.get(
		"/items/:index/reference",
		async ({ params, user }) =>
			resolveBudgetItemReference(user.id, params.workId, params.index),
		{
			detail: {
				tags: ["Budget"],
				summary: "Referência canônica de item de orçamento",
			},
		},
	)
	.get(
		"/history",
		async ({ params, user }) => listBudgetVersions(user.id, params.workId),
		{
			detail: {
				tags: ["Budget"],
				summary: "Histórico de versões de orçamento",
			},
		},
	)
	.get(
		"/:versionId",
		async ({ params, user }) =>
			getBudgetVersion(user.id, params.workId, params.versionId),
		{
			detail: {
				tags: ["Budget"],
				summary: "Detalhe de versão de orçamento com itens e totais",
			},
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/draft",
		async ({ params, body, user }) =>
			createDraftBudgetVersion(user.id, params.workId, body),
		{
			body: t.Object({
				label: t.String(),
				itemOverrides: t.Optional(
					t.Array(
						t.Object({
							index: t.String(),
							totalCost: t.Number(),
						}),
					),
				),
				newItems: t.Optional(
					t.Array(
						t.Object({
							index: t.String(),
							parentIndex: t.Optional(t.Nullable(t.String())),
							type: t.String(),
							description: t.String(),
							unit: t.Optional(t.Nullable(t.String())),
							quantity: t.Optional(t.Nullable(t.Number())),
							unitCost: t.Optional(t.Nullable(t.Number())),
							totalCost: t.Optional(t.Nullable(t.Number())),
							sortOrder: t.Optional(t.Number()),
						}),
					),
				),
			}),
			detail: {
				tags: ["Budget"],
				summary: "Criar aditivo como versão em rascunho",
			},
		},
	)
	.post(
		"/:versionId/submit",
		async ({ params, body, user }) =>
			submitBudgetVersion(user.id, params.workId, params.versionId, body),
		{
			body: t.Object({ reason: t.Optional(t.String()) }),
			detail: {
				tags: ["Budget"],
				summary: "Submeter versão em rascunho para aprovação",
			},
		},
	)
	.use(requireRole("approve"))
	.post(
		"/:versionId/archive",
		async ({ params, body, user }) =>
			archiveBudgetVersion(
				user.id,
				params.workId,
				params.versionId,
				body.reason,
			),
		{
			body: t.Object({ reason: t.Optional(t.String({ maxLength: 1000 })) }),
			detail: {
				tags: ["Budget"],
				summary: "Arquivar versão de orçamento fora do escopo operacional",
			},
		},
	);
