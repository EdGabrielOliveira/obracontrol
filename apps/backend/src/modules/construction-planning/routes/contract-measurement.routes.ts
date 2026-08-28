import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { resolveAuth } from "../../../lib/resolve-auth";
import { parseInput } from "../../../lib/zod-validation";
import {
	normalizeGovernanceRole,
	normalizeMeasurementRole,
} from "../../governance/governance.service";
import { contractFilesService } from "../contract-files.service";
import { contractMeasurementService } from "../contract-measurement.service";
import { constructionGovernanceGuard } from "../governance-guard";
import { rejectedRowCount } from "../imports/import-service";
import { parseWorkbookByKind } from "../imports/parser";
import { validateWorkbookByKind } from "../imports/validator";
import { nextMeasurementNumber } from "../measurement-common";
import {
	createContractMeasurementSchema,
	createContractPaymentSchema,
	updateContractMeasurementSchema,
	updateContractPaymentSchema,
} from "../schemas/contract.schema";
import { pdfReportService } from "../statistics/pdf-report.service";
import type { ImportValidationError } from "../types";
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
			const parsed = parseWorkbookByKind(
				bytes,
				body.file.name,
				"medicao-contrato",
			);
			const validation = validateWorkbookByKind(parsed, "medicao-contrato");
			const structural = validation.errors.filter(
				(error) => error.row === undefined,
			);
			if (structural.length > 0) {
				throw new ConstructionError(
					"VALIDATION_FAILED",
					"Planilha invalida",
					422,
					structural,
				);
			}

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

			const warnings: ImportValidationError[] = [...validation.warnings];

			const result = await prisma.$transaction(async (tx) => {
				let contractsImported = 0;
				const existingContractCodes = await tx.contract.findMany({
					where: {
						ownerId: scope.resourceOwnerId,
						workId: params.workId,
						code: { in: validation.contracts.map((c) => c.code) },
					},
					select: { code: true },
				});
				if (existingContractCodes.length > 0) {
					throw new ConstructionError(
						"CONFLICT",
						"Ja existe um contrato com este codigo nesta obra.",
						409,
					);
				}
				for (const contract of validation.contracts) {
					await tx.contract.create({
						data: {
							ownerId: scope.resourceOwnerId,
							workId: params.workId,
							code: contract.code,
							supplierName: contract.supplierName,
							contractValue: contract.contractValue,
							serviceType: contract.serviceType ?? null,
							title: contract.title ?? null,
							startDate: contract.startDate,
							endDate: contract.endDate,
							status: contract.status,
							notes: contract.notes ?? null,
						},
					});
					contractsImported += 1;
				}

				const serviceIds: string[] = [];
				const contract = await tx.contract.findFirst({
					where: {
						id: params.contractId,
						ownerId: scope.resourceOwnerId,
						workId: params.workId,
					},
					select: { workId: true },
				});
				if (!contract) {
					throw new ConstructionError(
						"NOT_FOUND",
						"Contrato nao encontrado",
						404,
					);
				}
				for (const service of validation.contractServices) {
					const budgetItem = await tx.constructionBudgetItem.findFirst({
						where: {
							ownerId: scope.resourceOwnerId,
							workId: contract.workId,
							index: service.index,
						},
						select: { id: true, type: true, description: true, unit: true },
					});
					if (!budgetItem) {
						throw new ConstructionError(
							"INVALID_BUDGET_ITEM",
							`Item de orcamento ${service.index} nao encontrado para o servico da linha ${service.rowNumber}`,
							422,
						);
					}
					const created = await tx.contractService.create({
						data: {
							contractId: params.contractId,
							type: budgetItem.type,
							description: budgetItem.description,
							unit: budgetItem.unit,
							quantity: service.quantity,
							unitCost: service.unitCost,
							totalCost:
								service.totalCost ??
								(service.quantity != null && service.unitCost != null
									? service.quantity * service.unitCost
									: null),
							budgetItemId: budgetItem.id,
							sortOrder: 0,
						},
					});
					serviceIds.push(created.id);
				}

				let imported = 0;
				for (const measurement of validation.contractMeasurements) {
					if (serviceIds.length === 0) {
						warnings.push({
							sheet: "Medicoes Contrato",
							row: measurement.rowNumber,
							field: "Servicos",
							code: "SKIPPED_NO_SERVICES",
							message: "Medicao sem servicos ignorada",
						});
						continue;
					}
					const number = await nextMeasurementNumber(
						tx,
						"contractMeasurement",
						{
							ownerId: scope.resourceOwnerId,
							contractId: params.contractId,
						},
					);
					const created = await tx.contractMeasurement.create({
						data: {
							ownerId: scope.resourceOwnerId,
							contractId: params.contractId,
							number,
							date: measurement.date,
							title: measurement.title ?? null,
							discountValue: measurement.discountValue,
							retentionValue: measurement.retentionValue,
							taxValue: measurement.taxValue,
							notes: measurement.notes ?? null,
							status: "ACEITO",
							statusReason: "Importado e validado",
							statusChangedAt: new Date(),
						},
					});
					await tx.contractMeasurementItem.createMany({
						data: serviceIds.map((serviceId) => ({
							measurementId: created.id,
							serviceId,
							measuredQuantity: null,
							measuredValue: null,
							measuredPercentage: null,
							accumulatedQuantity: null,
							accumulatedValue: null,
							accumulatedPercentage: null,
						})),
					});
					imported += 1;
				}

				let paymentsImported = 0;
				for (const payment of validation.contractPayments) {
					await tx.contractPayment.create({
						data: {
							ownerId: scope.resourceOwnerId,
							contractId: params.contractId,
							date: payment.date,
							value: payment.value,
							paidValue: payment.paidValue,
							description: payment.description ?? null,
							retentionValue: payment.retentionValue ?? null,
							discountValue: payment.discountValue ?? null,
							status: payment.status,
						},
					});
					paymentsImported += 1;
				}

				return { imported, paymentsImported, contractsImported };
			});

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
				warningCount: warnings.length,
				warnings,
				errors: validation.errors,
			};
		},
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Contract Measurements"] },
		},
	);
