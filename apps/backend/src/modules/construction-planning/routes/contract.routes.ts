import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { parseInput, parseQuery } from "../../../lib/zod-validation";
import { contractService } from "../contract.service";
import {
	downloadContractInstrumentArtifact,
	generateContractInstrumentArtifact,
	getContractInstrumentReadiness,
	listContractInstrumentArtifacts,
} from "../instrument/artifact.service";
import {
	contractFilterSchema,
	contractServicePreviewSchema,
	createContractAmendmentSchema,
	createContractSchema,
	createContractServiceSchema,
	createContractServicesSchema,
	linkBudgetSchema,
	updateContractAmendmentSchema,
	updateContractSchema,
	updateContractServiceSchema,
} from "../schemas/contract.schema";

export const contractRoutes = new Elysia({
	prefix: "/works/:workId/contracts",
	name: "contract-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/",
		async ({ params, query, scope }) => {
			const filters = parseQuery(contractFilterSchema, query);
			return contractService.listContracts(
				scope.resourceOwnerId,
				params.workId,
				filters,
			);
		},
		{ detail: { tags: ["Contracts"] } },
	)
	.get(
		"/summary",
		async ({ params, scope }) => {
			return contractService.getContractsSummary(
				scope.resourceOwnerId,
				params.workId,
			);
		},
		{ detail: { tags: ["Contracts"] } },
	)
	.get(
		"/measurements",
		async ({ params, scope }) => {
			return contractService.listCrossContractMeasurements(
				scope.resourceOwnerId,
				params.workId,
			);
		},
		{ detail: { tags: ["Contracts"] } },
	)
	.get(
		"/:contractId",
		async ({ params, scope }) => {
			return contractService.getContract(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contracts"] } },
	)
	.get(
		"/:contractId/services",
		async ({ params, scope }) => {
			return contractService.listServices(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contract Services"] } },
	)
	.get(
		"/:contractId/amendments",
		async ({ params, scope }) => {
			return contractService.listAmendments(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contract Amendments"] } },
	)
	.get(
		"/:contractId/services/:sId",
		async ({ params, scope }) => {
			return contractService.getService(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.sId,
			);
		},
		{ detail: { tags: ["Contract Services"] } },
	)
	.get(
		"/:contractId/instrument/readiness",
		async ({ params, scope }) =>
			getContractInstrumentReadiness(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
			),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Verificar pendências para gerar o PDF do contrato",
			},
		},
	)
	.get(
		"/:contractId/instrument/artifacts",
		async ({ params, scope }) =>
			listContractInstrumentArtifacts(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
			),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Listar PDFs versionados do instrumento contratual",
			},
		},
	)
	.get(
		"/:contractId/instrument/artifacts/:artifactId/download",
		async ({ params, scope, user }) => {
			const artifact = await downloadContractInstrumentArtifact(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.artifactId,
				{ userId: user.id },
			);
			if (!artifact.bytes) {
				throw new Error("Arquivo do instrumento contratual nao encontrado");
			}
			return new Response(new Blob([artifact.bytes.buffer as ArrayBuffer]), {
				headers: {
					"content-type": artifact.contentType,
					"content-disposition": `attachment; filename="${artifact.filename}"`,
				},
			});
		},
		{
			detail: {
				tags: ["Contracts"],
				summary: "Baixar PDF versionado do instrumento contratual",
				description:
					"Retorna application/pdf com Content-Disposition para download.",
			},
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/",
		async ({ params, body, user, scope }) => {
			const parsed = parseInput(createContractSchema, body);
			return contractService.createContract(
				scope.resourceOwnerId,
				params.workId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				code: t.String(),
				supplierName: t.Optional(t.String()),
				supplierId: t.Optional(t.Nullable(t.String())),
				contractValue: t.Number(),
				serviceType: t.Optional(t.String()),
				objectDescription: t.String({ minLength: 1 }),
				title: t.Optional(t.String()),
				startDate: t.Optional(t.String()),
				endDate: t.Optional(t.String()),
				status: t.Optional(t.String()),
				notes: t.Optional(t.String()),
				services: t.Optional(
					t.Array(
						t.Object({
							budgetItemId: t.String(),
							quantity: t.Optional(t.Number()),
							unitCost: t.Optional(t.Number()),
						}),
					),
				),
			}),
			detail: { tags: ["Contracts"] },
		},
	)
	.patch(
		"/:contractId",
		async ({ params, body, scope, user }) => {
			const parsed = parseInput(updateContractSchema, body);
			return contractService.updateContract(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				serviceType: t.Optional(t.String()),
				objectDescription: t.Optional(t.String({ minLength: 1 })),
				title: t.Optional(t.String()),
				startDate: t.Optional(t.String()),
				endDate: t.Optional(t.String()),
				status: t.Optional(t.String()),
			}),
			detail: { tags: ["Contracts"] },
		},
	)
	.post(
		"/:contractId/supplier",
		async ({ params, body, scope, user }) =>
			contractService.linkSupplier(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				body.supplierId,
				{ userId: user.id },
			),
		{
			body: t.Object({ supplierId: t.String() }),
			detail: { tags: ["Contracts"] },
		},
	)
	.delete(
		"/:contractId",
		async ({ params, scope, user }) => {
			const result = await contractService.deleteContract(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				{ userId: user.id },
			);
			if (result.status === "PENDING") return result;
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Contracts"] } },
	)
	.post(
		"/:contractId/services",
		async ({ params, body, scope, user }) => {
			const parsed = parseInput(createContractServiceSchema, body);
			return contractService.createService(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				budgetItemId: t.String(),
				quantity: t.Optional(t.Number()),
				unitCost: t.Optional(t.Number()),
				sortOrder: t.Optional(t.Number()),
			}),
			detail: { tags: ["Contract Services"] },
		},
	)
	.post(
		"/:contractId/services/preview",
		async ({ params, body, scope }) => {
			const parsed = parseInput(contractServicePreviewSchema, body);
			return contractService.previewService(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				parsed,
			);
		},
		{
			body: t.Object({
				budgetItemId: t.String(),
				quantity: t.Optional(t.Number()),
				unitCost: t.Optional(t.Number()),
			}),
			detail: { tags: ["Contract Services"] },
		},
	)
	.post(
		"/:contractId/services/batch",
		async ({ params, body, scope, user }) => {
			const parsed = parseInput(createContractServicesSchema, body);
			return contractService.createServices(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				parsed.items,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				items: t.Array(
					t.Object({
						budgetItemId: t.String(),
						quantity: t.Optional(t.Number()),
						unitCost: t.Optional(t.Number()),
						sortOrder: t.Optional(t.Number()),
					}),
				),
			}),
			detail: { tags: ["Contract Services"] },
		},
	)
	.patch(
		"/:contractId/services/:sId",
		async ({ params, body, scope, user }) => {
			const parsed = parseInput(updateContractServiceSchema, body);
			return contractService.updateService(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.sId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				budgetItemId: t.Optional(t.String()),
				quantity: t.Optional(t.Number()),
				unitCost: t.Optional(t.Number()),
				sortOrder: t.Optional(t.Number()),
			}),
			detail: { tags: ["Contract Services"] },
		},
	)
	.delete(
		"/:contractId/services/:sId",
		async ({ params, scope, user }) => {
			await contractService.deleteService(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.sId,
				{ userId: user.id },
			);
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Contract Services"] } },
	)
	.post(
		"/:contractId/services/link-budget",
		async ({ params, body, scope, user }) => {
			const parsed = parseInput(linkBudgetSchema, body);
			return contractService.linkServicesToBudget(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				links: t.Array(
					t.Object({
						serviceId: t.String(),
						budgetItemId: t.String(),
					}),
				),
			}),
			detail: { tags: ["Contract Services"] },
		},
	)
	.post(
		"/:contractId/amendments",
		async ({ params, body, user, scope }) => {
			const parsed = parseInput(createContractAmendmentSchema, body);
			return contractService.createAmendment(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				kind: t.String(),
				value: t.Number(),
				reason: t.String(),
				date: t.String(),
				measurementIds: t.Array(t.String()),
			}),
			detail: { tags: ["Contract Amendments"] },
		},
	)
	.patch(
		"/:contractId/amendments/:amendmentId",
		async ({ params, body, user, scope }) => {
			const parsed = parseInput(updateContractAmendmentSchema, body);
			return contractService.updateAmendment(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.amendmentId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				kind: t.Optional(t.String()),
				value: t.Optional(t.Number()),
				reason: t.Optional(t.String()),
				date: t.Optional(t.String()),
				measurementIds: t.Optional(t.Array(t.String())),
			}),
			detail: { tags: ["Contract Amendments"] },
		},
	)
	.post(
		"/:contractId/amendments/:amendmentId/decision",
		async ({ params, body, user, scope }) =>
			contractService.decideAmendment(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.amendmentId,
				body.decision,
				{ userId: user.id, role: user.role ?? "", reason: body.reason },
			),
		{
			body: t.Object({
				decision: t.Union([t.Literal("APPROVE"), t.Literal("REJECT")]),
				reason: t.Optional(t.String()),
			}),
			detail: {
				tags: ["Contract Amendments"],
				summary: "Revisar aditivo do contrato",
			},
		},
	)
	.delete(
		"/:contractId/amendments/:amendmentId",
		async ({ params, user, scope }) => {
			await contractService.removeAmendment(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.amendmentId,
				{ userId: user.id },
			);
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Contract Amendments"] } },
	)
	.post(
		"/:contractId/instrument",
		async ({ params, user, scope }) =>
			contractService.generateInstrument(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				{ userId: user.id },
			),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Gerar PDF versionado do instrumento contratual",
				description:
					"Exige escrita na obra, template DOCX da empresa, fornecedor vinculado com cadastro completo, objeto do contrato e endereço da obra.",
			},
		},
	)
	.post(
		"/:contractId/instrument/artifacts",
		async ({ params, user, scope }) =>
			generateContractInstrumentArtifact(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				{ userId: user.id },
			),
		{
			detail: {
				tags: ["Contracts"],
				summary: "Gerar PDF versionado do instrumento contratual",
				description:
					"Persiste somente o PDF convertido e registra hash, versão do template e auditoria.",
			},
		},
	);
