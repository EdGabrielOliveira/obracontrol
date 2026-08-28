import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import {
	addManualContractRequestProposal,
	cancelContractRequest,
	createContractRequest,
	getContractRequest,
	getContractRequestComparison,
	listContractRequests,
	negotiateContractRequestProposal,
	revertContractRequestAcceptance,
	selectContractRequestWinner,
} from "../contract-request.service";
import {
	confirmQuotationMapBatch,
	createQuotationMapPreview,
	getQuotationMapPreview,
} from "../contract-request-import.service";
import { buildWorkbookTemplate } from "../templates/template-generator";

export const contractRequestTemplateRoutes = new Elysia({
	prefix: "/quotation-templates",
	name: "contract-request-template-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/contract-request",
		() =>
			new Response(buildWorkbookTemplate("quotation-map") as unknown as Blob, {
				headers: {
					"content-type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"content-disposition":
						'attachment; filename="modelo-mapa-cotacao.xlsx"',
				},
			}),
		{ detail: { tags: ["Templates"] } },
	);

export const contractRequestRoutes = new Elysia({
	prefix: "/works/:workId/contract-requests",
	name: "contract-request-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/",
		({ params, user }) => listContractRequests(user.id, params.workId),
		{ detail: { tags: ["Contracts"], summary: "Listar contratos em cotação" } },
	)
	.post(
		"/",
		({ params, body, user }) =>
			createContractRequest(user.id, params.workId, body),
		{
			body: t.Object({
				title: t.String({ minLength: 1, maxLength: 120 }),
				serviceType: t.String({ minLength: 1, maxLength: 120 }),
				description: t.String({ minLength: 1, maxLength: 2_000 }),
				startDate: t.String({ minLength: 1 }),
				endDate: t.String({ minLength: 1 }),
				items: t.Array(
					t.Object({
						budgetItemId: t.String(),
						quantity: t.Number({ exclusiveMinimum: 0 }),
					}),
					{ minItems: 1 },
				),
			}),
			detail: {
				tags: ["Contracts"],
				summary: "Criar solicitação de contratação vinculada ao orçamento",
			},
		},
	)
	.get(
		"/:requestId",
		({ params, user }) =>
			getContractRequest(user.id, params.workId, params.requestId),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Detalhe da solicitação de contratação",
			},
		},
	)
	.get(
		"/:requestId/comparison",
		({ params, user }) =>
			getContractRequestComparison(
				user.id,
				params.workId,
				params.requestId,
				user.role,
			),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Comparativo de propostas com totais calculados pelo back-end",
			},
		},
	)
	.post(
		"/:requestId/quotation-imports",
		({ params, body, user }) =>
			createQuotationMapPreview(user.id, params.workId, params.requestId, {
				name: body.file.name,
				stream: () => body.file.stream(),
			}),
		{
			body: t.Object({ file: t.File() }),
			detail: {
				tags: ["Contracts"],
				summary: "Enviar mapa de cotação para staging e preview",
			},
		},
	)
	.get(
		"/:requestId/quotation-imports/:batchId",
		({ params, query, user }) =>
			getQuotationMapPreview(
				user.id,
				params.workId,
				params.requestId,
				params.batchId,
				query.page,
				query.limit,
			),
		{
			query: t.Object({
				page: t.Optional(t.Number({ minimum: 1 })),
				limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
			}),
			detail: {
				tags: ["Contracts"],
				summary: "Prévia paginada do mapa de cotação",
			},
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/:requestId/cancel",
		({ params, user }) =>
			cancelContractRequest(user.id, params.workId, params.requestId),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Cancelar cotação",
			},
		},
	)
	.post(
		"/:requestId/proposals/manual",
		({ params, body, user }) =>
			addManualContractRequestProposal(
				user.id,
				params.workId,
				params.requestId,
				body,
			),
		{
			body: t.Object({
				supplierName: t.String({ minLength: 1, maxLength: 200 }),
				cnpj: t.String({
					minLength: 14,
					maxLength: 14,
					pattern: "^[0-9]{14}$",
				}),
				proposalValue: t.Number({ exclusiveMinimum: 0 }),
				notes: t.Optional(t.String({ maxLength: 2_000 })),
			}),
			detail: {
				tags: ["Contracts"],
				summary: "Adicionar fornecedor manualmente ao comparativo",
			},
		},
	)
	.post(
		"/:requestId/proposals/:proposalId/negotiate",
		({ params, body, user }) =>
			negotiateContractRequestProposal(
				user.id,
				params.workId,
				params.requestId,
				params.proposalId,
				body.proposalValue,
				body.reason,
			),
		{
			body: t.Object({
				proposalValue: t.Number({ exclusiveMinimum: 0 }),
				reason: t.String({ minLength: 1, maxLength: 2_000 }),
			}),
			detail: {
				tags: ["Contracts"],
				summary: "Negociar redução do valor da proposta",
			},
		},
	)
	.post(
		"/:requestId/quotation-imports/:batchId/confirm",
		({ params, headers, user, body }) =>
			confirmQuotationMapBatch(
				user.id,
				params.workId,
				params.requestId,
				params.batchId,
				headers["idempotency-key"],
				body.selectedRowIds,
			),
		{
			body: t.Object({
				selectedRowIds: t.Optional(t.Array(t.String())),
			}),
			headers: t.Object(
				{
					"idempotency-key": t.Optional(t.String()),
				},
				{ additionalProperties: true },
			),
			detail: {
				tags: ["Contracts"],
				summary: "Confirmar mapa de cotação e gerar propostas imutáveis",
			},
		},
	)
	.post(
		"/:requestId/select/:proposalId",
		({ params, headers, user }) =>
			selectContractRequestWinner(
				user.id,
				params.workId,
				params.requestId,
				params.proposalId,
				headers["idempotency-key"] ??
					`contract-request:${params.requestId}:${params.proposalId}`,
				user.role,
			),
		{
			headers: t.Object(
				{ "idempotency-key": t.Optional(t.String()) },
				{ additionalProperties: true },
			),
			detail: {
				tags: ["Contracts"],
				summary: "Selecionar proposta e solicitar aprovação final",
			},
		},
	)
	.post(
		"/:requestId/accept/:proposalId",
		({ params, headers, user }) =>
			selectContractRequestWinner(
				user.id,
				params.workId,
				params.requestId,
				params.proposalId,
				headers["idempotency-key"] ??
					`contract-request:${params.requestId}:${params.proposalId}`,
				user.role,
			),
		{
			headers: t.Object(
				{
					"idempotency-key": t.Optional(t.String()),
				},
				{ additionalProperties: true },
			),
			detail: {
				tags: ["Contracts"],
				summary:
					"Compatibilidade: selecionar proposta e solicitar aprovação final",
			},
		},
	)
	.post(
		"/:requestId/revert-acceptance",
		({ params, user }) =>
			revertContractRequestAcceptance(
				user.id,
				params.workId,
				params.requestId,
				user.role,
			),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Reverter aceite e retornar a solicitação para cotação",
			},
		},
	);
