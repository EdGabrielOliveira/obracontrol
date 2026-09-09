import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { resolveAuth } from "../../../lib/resolve-auth";
import { parseInput } from "../../../lib/zod-validation";
import { normalizeMeasurementRole } from "../../governance/governance.service";
import { contractFilesService } from "../contract-files.service";
import { contractMeasurementService } from "../contract-measurement.service";
import { importContractMeasurementWorkbook } from "../contract-measurement-import.service";
import { constructionGovernanceGuard } from "../governance-guard";
import {
	parseAndValidateWorkbook,
	rejectedRowCount,
} from "../imports/import-service";
import {
	createContractMeasurementSchema,
	createContractPaymentSchema,
	updateContractMeasurementSchema,
	updateContractPaymentSchema,
} from "../schemas/contract.schema";
import { pdfReportService } from "../statistics/pdf-report.service";
import { assertValidXlsxUpload } from "./upload-guards";

export const contractMeasurementRoutes = new Elysia({
	prefix: "/works/:workId/contracts/:contractId",
	name: "contract-measurement-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/measurements",
		async ({ params, query, scope }) => {
			const page = query.page ? Number(query.page) : undefined;
			const limit = query.limit ? Number(query.limit) : undefined;
			const q = query.q?.trim() || undefined;
			return contractMeasurementService.listMeasurements(
				scope.resourceOwnerId,
				params.contractId,
				{ q, page, limit },
			);
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: { tags: ["Contract Measurements"] },
		},
	)
	.get(
		"/measurements/aggregate",
		async ({ params, scope }) => {
			return contractMeasurementService.getContractAggregate(
				scope.resourceOwnerId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contract Measurements"] } },
	)
	.get(
		"/measurements/map",
		async ({ params, scope }) => {
			return contractMeasurementService.getMeasurementMap(
				scope.resourceOwnerId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contract Measurements"] } },
	)
	.get(
		"/measurements/:mId",
		async ({ params, scope }) => {
			return contractMeasurementService.getMeasurement(
				scope.resourceOwnerId,
				params.contractId,
				params.mId,
			);
		},
		{ detail: { tags: ["Contract Measurements"] } },
	)
	.get(
		"/measurements/:mId/pdf",
		async ({ params, scope }) => {
			return pdfReportService.generateContractMeasurementPdf(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				params.mId,
			);
		},
		{ detail: { tags: ["Contract Measurements"] } },
	)
	.get(
		"/payments",
		async ({ params, query, scope }) => {
			const page = query.page ? Number(query.page) : undefined;
			const limit = query.limit ? Number(query.limit) : undefined;
			const q = query.q?.trim() || undefined;
			return contractMeasurementService.listPayments(
				scope.resourceOwnerId,
				params.contractId,
				{ q, page, limit },
			);
		},
		{
			query: t.Object({
				q: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
			detail: { tags: ["Contract Payments"] },
		},
	)
	.get(
		"/payments/summary",
		async ({ params, scope }) => {
			return contractMeasurementService.getPaymentsSummary(
				scope.resourceOwnerId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contract Payments"] } },
	)
	.get(
		"/payments/:pId",
		async ({ params, scope }) => {
			return contractMeasurementService.getPayment(
				scope.resourceOwnerId,
				params.contractId,
				params.pId,
			);
		},
		{ detail: { tags: ["Contract Payments"] } },
	)
	.get(
		"/folders",
		async ({ params, scope }) => {
			return contractFilesService.listFolders(
				scope.resourceOwnerId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Contract Files"] } },
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/measurements",
		async ({ params, body, user, scope }) => {
			const parsed = parseInput(createContractMeasurementSchema, body);
			const created = await contractMeasurementService.createMeasurement(
				scope.resourceOwnerId,
				params.contractId,
				parsed,
				{ userId: user.id, role: normalizeMeasurementRole(user.role) },
			);
			return created;
		},
		{
			body: t.Object({
				number: t.Optional(t.Number()),
				date: t.String(),
				title: t.String(),
				notes: t.Optional(t.String()),
				items: t.Array(
					t.Object({
						serviceId: t.String(),
						measuredQuantity: t.Number(),
					}),
				),
			}),
			detail: { tags: ["Contract Measurements"] },
		},
	)
	.patch(
		"/measurements/:mId",
		async ({ params, body, user, scope }) => {
			const parsed = parseInput(updateContractMeasurementSchema, body);
			return contractMeasurementService.updateMeasurement(
				scope.resourceOwnerId,
				params.contractId,
				params.mId,
				parsed,
				{ userId: user.id, role: normalizeMeasurementRole(user.role) },
			);
		},
		{
			body: t.Object({
				title: t.Optional(t.String()),
				date: t.Optional(t.String()),
				notes: t.Optional(t.String()),
				items: t.Optional(
					t.Array(
						t.Object({
							id: t.Optional(t.String()),
							serviceId: t.String(),
							measuredQuantity: t.Number(),
						}),
					),
				),
			}),
			detail: { tags: ["Contract Measurements"] },
		},
	)
	.patch(
		"/measurements/:mId/status",
		async ({ params, body, user, scope }) => {
			return contractMeasurementService.setMeasurementStatus(
				scope.resourceOwnerId,
				params.contractId,
				params.mId,
				body.status,
				body.reason,
				normalizeMeasurementRole(user.role),
				user.id,
			);
		},
		{
			body: t.Object({
				status: t.Union([
					t.Literal("RASCUNHO"),
					t.Literal("ACEITO"),
					t.Literal("RECUSADO"),
					t.Literal("ARQUIVADO"),
				]),
				reason: t.Optional(t.Union([t.String(), t.Null()])),
			}),
			detail: { tags: ["Contract Measurements"] },
		},
	)
	.delete(
		"/measurements/:mId",
		async ({ params, scope }) => {
			await contractMeasurementService.deleteMeasurement(
				scope.resourceOwnerId,
				params.contractId,
				params.mId,
			);
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Contract Measurements"] } },
	)
	.post(
		"/payments",
		async ({ params, body, scope }) => {
			const parsed = parseInput(createContractPaymentSchema, body);
			return contractMeasurementService.createPayment(
				scope.resourceOwnerId,
				params.contractId,
				parsed,
			);
		},
		{
			body: t.Object({
				date: t.String(),
				value: t.Number(),
				paidValue: t.Number(),
				measurementId: t.Optional(t.Union([t.String(), t.Null()])),
				description: t.Optional(t.String()),
				retentionValue: t.Optional(t.Number()),
				discountValue: t.Optional(t.Number()),
				status: t.Optional(t.String()),
			}),
			detail: { tags: ["Contract Payments"] },
		},
	)
	.patch(
		"/payments/:pId",
		async ({ params, body, user, scope }) => {
			const parsed = parseInput(updateContractPaymentSchema, body);
			return contractMeasurementService.updatePayment(
				scope.resourceOwnerId,
				params.contractId,
				params.pId,
				parsed,
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				date: t.Optional(t.String()),
				value: t.Optional(t.Number()),
				paidValue: t.Optional(t.Number()),
				measurementId: t.Optional(t.Union([t.String(), t.Null()])),
				description: t.Optional(t.String()),
				retentionValue: t.Optional(t.Number()),
				discountValue: t.Optional(t.Number()),
				status: t.Optional(t.String()),
			}),
			detail: { tags: ["Contract Payments"] },
		},
	)
	.delete(
		"/payments/:pId",
		async ({ params, scope }) => {
			await contractMeasurementService.deletePayment(
				scope.resourceOwnerId,
				params.contractId,
				params.pId,
			);
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Contract Payments"] } },
	)
	.post(
		"/folders",
		async ({ params, body, scope }) => {
			return contractFilesService.createFolder(
				scope.resourceOwnerId,
				params.contractId,
				body.name,
			);
		},
		{
			body: t.Object({ name: t.String() }),
			detail: { tags: ["Contract Files"] },
		},
	)
	.post(
		"/folders/:fId/files",
		async ({ params, body, scope }) => {
			return contractFilesService.uploadFile(
				scope.resourceOwnerId,
				params.contractId,
				params.fId,
				{
					name: body.name,
					url: body.url,
					size: body.size,
					mimeType: body.mimeType,
				},
			);
		},
		{
			body: t.Object({
				name: t.String(),
				url: t.String(),
				size: t.Optional(t.Number()),
				mimeType: t.Optional(t.String()),
			}),
			detail: { tags: ["Contract Files"] },
		},
	)
	.patch(
		"/folders/:fId/files/:fileId",
		async ({ params, body, scope }) => {
			return contractFilesService.updateFile(
				scope.resourceOwnerId,
				params.contractId,
				params.fId,
				params.fileId,
				{
					name: body.name,
					url: body.url,
					size: body.size,
					mimeType: body.mimeType,
				},
			);
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				url: t.Optional(t.String()),
				size: t.Optional(t.Number()),
				mimeType: t.Optional(t.String()),
			}),
			detail: { tags: ["Contract Files"] },
		},
	)
	.delete(
		"/folders/:fId/files/:fileId",
		async ({ params, scope }) => {
			await contractFilesService.deleteFile(
				scope.resourceOwnerId,
				params.contractId,
				params.fId,
				params.fileId,
			);
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Contract Files"] } },
	)
	.post(
		"/measurements/import",
		async ({ params, body, scope }) => {
			await constructionGovernanceGuard.assertWritable(
				scope.resourceOwnerId,
				"CONTRACT",
				params.workId,
			);
			assertValidXlsxUpload(body.file);
			const bytes = new Uint8Array(await body.file.arrayBuffer());
			const { parsed, validation } = parseAndValidateWorkbook(
				bytes,
				body.file.name,
				"medicao-contrato",
			);

			const hasAnyData =
				parsed.contractRows.length > 0 ||
				parsed.serviceRows.length > 0 ||
				parsed.contractMeasurementRows.length > 0 ||
				parsed.paymentRows.length > 0;
			if (!hasAnyData) {
				throw new ConstructionError(
					"NO_DATA",
					"Nenhum dado encontrado na planilha",
					400,
				);
			}

			const result = await importContractMeasurementWorkbook(
				scope.resourceOwnerId,
				params.workId,
				params.contractId,
				validation,
			);

			return {
				workId: params.workId,
				imported: result.imported,
				paymentsImported: result.paymentsImported,
				contractsImported: result.contractsImported,
				importedCount:
					result.imported + result.paymentsImported + result.contractsImported,
				rejectedCount: rejectedRowCount(validation.errors),
				processedSheets: validation.processedSheets,
				importedSections: validation.work.importedSections,
				warningCount: result.warnings.length,
				warnings: result.warnings,
				errors: validation.errors,
			};
		},
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Contract Measurements"] },
		},
	);
