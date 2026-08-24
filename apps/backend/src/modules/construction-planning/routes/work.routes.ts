import { Elysia, t } from "elysia";
import { env } from "../../../env";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { resolveAuth } from "../../../lib/resolve-auth";
import { resolveResourceScope } from "../../../lib/resource-scope";
import { throwInvalidInput } from "../../../lib/zod-validation";
import { auditService } from "../../audit/audit.service";
import { budgetService } from "../budget.service";
import { constructionManualEntryService } from "../entries/manual-entry-service";
import {
	existingEntityLookup,
	resolveActualCostDependencies,
	resolveBaselineDependencies,
	resolveMeasurementDependencies,
	resolveReplanningDependencies,
} from "../imports/dependency-resolver";
import { rejectedRowCount } from "../imports/import-service";
import { isoDateString } from "../imports/normalizers";
import { parseWorkbookByKind } from "../imports/parser";
import { validateWorkbookByKind } from "../imports/validator";
import * as repository from "../repository";
import { ConstructionScheduleService } from "../schedule/schedule-service";
import {
	constructionWorksFilterSchema,
	createActualCostSchema,
	updateActualCostSchema,
} from "../schema";
import {
	constructionWorkService,
	type StructuredAddressInput,
} from "../works/work-service";
import { assertValidXlsxUpload } from "./upload-guards";

function parseStructuredAddress(
	value: unknown,
): StructuredAddressInput | null | undefined {
	if (typeof value !== "string")
		return value as StructuredAddressInput | null | undefined;
	try {
		return JSON.parse(value) as StructuredAddressInput;
	} catch {
		throw new ConstructionError(
			"INVALID_ADDRESS",
			"Endereco estruturado invalido",
			400,
		);
	}
}

const scheduleService = new ConstructionScheduleService(repository);

export const workRoutes = new Elysia({ prefix: "/works", name: "work-routes" })
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/",
		async ({ query, user }) => {
			const parsed = constructionWorksFilterSchema.safeParse(query);
			if (!parsed.success)
				throw new ConstructionError(
					"INVALID_QUERY",
					"Parametros invalidos",
					400,
				);
			return constructionWorkService.list(user.id, parsed.data);
		},
		{
			detail: {
				tags: ["Works"],
				summary: "Listar obras",
				description:
					"Lista as obras acessíveis ao ator, com filtros operacionais, indicadores resumidos e paginação.",
			},
		},
	)
	.get(
		"/gestores",
		async ({ user }) => {
			const where =
				user.role === "ADMIN"
					? { role: "GESTOR" }
					: {
							role: "GESTOR",
							costCenterMemberships: {
								some: { costCenter: { ownerId: user.id } },
							},
						};
			return prisma.user.findMany({
				where,
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			});
		},
		{
			detail: {
				tags: ["Works"],
				summary: "Listar gestores disponíveis",
				description:
					"Lista os gestores que podem ser associados a ações no escopo do ator autenticado.",
			},
		},
	)
	.use(requireWorkAccess("read"))
	.get(
		"/:workId",
		async ({ params, scope }) => {
			return constructionWorkService.get(scope.resourceOwnerId, params.workId);
		},
		{
			detail: {
				tags: ["Works"],
				summary: "Detalhar obra",
				description:
					"Retorna os dados da obra, sua hierarquia operacional, importações e indicadores calculados pelo backend.",
			},
		},
	)
	.get(
		"/:workId/actual-costs",
		async ({ params, query, scope }) => {
			const { actualCostFilterSchema } = await import("../schema");
			const parsed = actualCostFilterSchema.safeParse(query);
			const filters = parsed.success ? parsed.data : {};
			return constructionManualEntryService.listActualCosts(
				scope.resourceOwnerId,
				params.workId,
				filters,
			);
		},
		{
			detail: {
				tags: ["Works"],
				summary: "Listar custos realizados da obra",
				description:
					"Lista os custos realizados da obra aplicando os filtros informados e o escopo do recurso.",
			},
		},
	)
	.get(
		"/:workId/actual-costs/:id",
		async ({ params, scope }) => {
			return constructionManualEntryService.getActualCost(
				scope.resourceOwnerId,
				params.workId,
				params.id,
			);
		},
		{
			detail: {
				tags: ["Works"],
				summary: "Detalhar custo realizado",
				description:
					"Retorna um custo realizado específico da obra, incluindo sua apropriação e situação financeira.",
			},
		},
	)
	.get(
		"/:workId/schedule",
		async ({ params, scope }) => {
			return scheduleService.getWorkSchedule(
				scope.resourceOwnerId,
				params.workId,
			);
		},
		{
			detail: {
				tags: ["Schedule"],
				summary: "Consultar cronograma da obra",
				description:
					"Retorna o cronograma original, replanejamentos, itens e dados de apoio à visão física da obra.",
			},
		},
	)
	.use(requireRole("write"))
	.post(
		"/",
		async ({ body, user }) => {
			if (!body.name?.trim() || !body.costCenterId?.trim()) {
				throw new ConstructionError(
					"MISSING_FIELDS",
					"Nome e centro de custo sao obrigatorios",
					400,
				);
			}
			const scope = await resolveResourceScope(user.id, {
				costCenterId: body.costCenterId.trim(),
			});
			if (!scope.canWrite) {
				throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
			}
			const result = (await constructionWorkService.create(
				scope.resourceOwnerId,
				{
					code: body.code?.trim(),
					name: body.name.trim(),
					costCenterId: body.costCenterId.trim(),
					address: body.address?.trim() || undefined,
					structuredAddress: body.structuredAddress,
					clientName: body.clientName?.trim() || undefined,
					baseDate: body.baseDate,
					plannedStart: body.plannedStart,
					plannedEnd: body.plannedEnd,
					areaM2: body.areaM2,
					responsibleName: body.responsibleName?.trim() || undefined,
				},
			)) as {
				id: string;
				code?: string;
				name?: string;
				[key: string]: unknown;
			};
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "CREATE",
				entityType: "WORK",
				entityId: result.id,
				entityDescription: `Obra ${result.code} - ${result.name}`,
				newState: result as unknown as Record<string, unknown>,
			});
			return result;
		},
		{
			body: t.Object({
				code: t.Optional(t.String()),
				name: t.String(),
				costCenterId: t.String(),
				address: t.Optional(t.String()),
				structuredAddress: t.Optional(
					t.Nullable(
						t.Object({
							zipCode: t.String(),
							street: t.Optional(t.String()),
							district: t.Optional(t.String()),
							number: t.Optional(t.String()),
							city: t.String(),
							state: t.String({ minLength: 2, maxLength: 2 }),
							complement: t.Optional(t.Nullable(t.String())),
							latitude: t.Optional(t.Nullable(t.Number())),
							longitude: t.Optional(t.Nullable(t.Number())),
						}),
					),
				),
				clientName: t.Optional(t.String()),
				baseDate: t.Optional(t.String()),
				plannedStart: t.Optional(t.String()),
				plannedEnd: t.Optional(t.String()),
				areaM2: t.Optional(t.Number()),
				responsibleName: t.Optional(t.String()),
			}),
			detail: { tags: ["Works"] },
		},
	)
	.post(
		"/with-budget",
		async ({ body, headers, user, set }) => {
			if (!body.name?.trim() || !body.costCenterId?.trim()) {
				throw new ConstructionError(
					"MISSING_FIELDS",
					"Nome e centro de custo sao obrigatorios",
					400,
				);
			}
			const idempotencyKey = headers["idempotency-key"]?.trim();
			const work = (await constructionWorkService.create(user.id, {
				code: body.code?.trim(),
				name: body.name.trim(),
				costCenterId: body.costCenterId.trim(),
				address: body.address?.trim() || undefined,
				structuredAddress: parseStructuredAddress(body.structuredAddress),
				clientName: body.clientName?.trim() || undefined,
				baseDate: body.baseDate,
				plannedStart: body.plannedStart,
				plannedEnd: body.plannedEnd,
				areaM2: body.areaM2,
				responsibleName: body.responsibleName?.trim() || undefined,
				creationIdempotencyKey: idempotencyKey,
			})) as {
				id: string;
				code?: string;
				name?: string;
				[key: string]: unknown;
			};
			if (!body.file) {
				set.status = 201;
				return { status: "NO_UPLOAD", work } as const;
			}
			assertValidXlsxUpload(body.file);
			try {
				const imported = await budgetService.importBudget(user.id, work.id, {
					file: body.file,
				});
				set.status = imported.errors.length > 0 ? 200 : 201;
				return { status: "IMPORTED", work, import: imported } as const;
			} catch (error) {
				if (error instanceof ConstructionError && error.status === 422) {
					set.status = 422;
					return {
						status: "IMPORT_REJECTED",
						work,
						error: {
							code: error.code,
							message: error.message,
							details: error.details,
						},
					} as const;
				}
				throw error;
			}
		},
		{
			headers: t.Object(
				{
					"idempotency-key": t.Optional(t.String({ minLength: 1 })),
				},
				{ additionalProperties: true },
			),
			body: t.Object({
				code: t.Optional(t.String()),
				name: t.String(),
				costCenterId: t.String(),
				address: t.Optional(t.String()),
				structuredAddress: t.Optional(
					t.Union([
						t.String(),
						t.Nullable(
							t.Object({
								zipCode: t.String(),
								street: t.Optional(t.String()),
								district: t.Optional(t.String()),
								number: t.Optional(t.String()),
								city: t.String(),
								state: t.String({ minLength: 2, maxLength: 2 }),
								complement: t.Optional(t.Nullable(t.String())),
								latitude: t.Optional(t.Nullable(t.Number())),
								longitude: t.Optional(t.Nullable(t.Number())),
							}),
						),
					]),
				),
				clientName: t.Optional(t.String()),
				baseDate: t.Optional(t.String()),
				plannedStart: t.Optional(t.String()),
				plannedEnd: t.Optional(t.String()),
				areaM2: t.Optional(t.Number()),
				responsibleName: t.Optional(t.String()),
				file: t.Optional(t.MaybeEmpty(t.File())),
			}),
			detail: {
				tags: ["Works"],
				summary: "Criar obra com orçamento inicial opcional",
			},
		},
	)
	.use(requireWorkAccess("write"))
	.patch(
		"/:workId",
		async ({ params, body, user, scope }) => {
			if (
				!body.code &&
				!body.name &&
				body.costCenterId === undefined &&
				body.address === undefined &&
				body.structuredAddress === undefined &&
				body.clientName === undefined &&
				body.areaM2 === undefined &&
				body.responsibleName === undefined &&
				body.plannedStart === undefined &&
				body.plannedEnd === undefined
			) {
				throw new ConstructionError(
					"NO_FIELDS",
					"Nenhum campo para atualizar",
					400,
				);
			}
			const old = await prisma.constructionWork.findUnique({
				where: { id: params.workId },
			});
			const result = await constructionWorkService.update(
				scope.resourceOwnerId,
				params.workId,
				body,
			);
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "UPDATE",
				entityType: "WORK",
				entityId: params.workId,
				entityDescription: `Obra ${result.code} - ${result.name}`,
				previousState: old as unknown as Record<string, unknown>,
				newState: result as unknown as Record<string, unknown>,
			});
			return result;
		},
		{
			body: t.Object({
				code: t.Optional(t.String()),
				name: t.Optional(t.String()),
				costCenterId: t.Optional(t.String()),
				address: t.Optional(t.String()),
				structuredAddress: t.Optional(
					t.Nullable(
						t.Object({
							zipCode: t.String(),
							street: t.Optional(t.String()),
							district: t.Optional(t.String()),
							number: t.Optional(t.String()),
							city: t.String(),
							state: t.String({ minLength: 2, maxLength: 2 }),
							complement: t.Optional(t.Nullable(t.String())),
							latitude: t.Optional(t.Nullable(t.Number())),
							longitude: t.Optional(t.Nullable(t.Number())),
						}),
					),
				),
				clientName: t.Optional(t.String()),
				areaM2: t.Optional(t.Number()),
				responsibleName: t.Optional(t.String()),
				plannedStart: t.Optional(t.String()),
				plannedEnd: t.Optional(t.String()),
			}),
			detail: { tags: ["Works"] },
		},
	)
	.delete(
		"/:workId",
		async ({ params, user, scope }) => {
			const old = await prisma.constructionWork.findUnique({
				where: { id: params.workId },
			});
			const result = await constructionWorkService.delete(
				scope.resourceOwnerId,
				params.workId,
				{ userId: user.id },
			);
			if ("status" in result && result.status === "PENDING") {
				return result;
			}
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "DELETE",
					entityType: "WORK",
					entityId: params.workId,
					entityDescription: `Obra ${old.code} - ${old.name}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Works"] } },
	)
	.post(
		"/:workId/actual-costs",
		async ({ params, body, user, scope }) => {
			const parsed = createActualCostSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			if (
				env.AUDIT_RELEASE_B &&
				(!parsed.data.budgetVersionItemId || parsed.data.allocations)
			) {
				throw new ConstructionError(
					"LEGACY_COST_CONTRACT_REMOVED",
					"Release B exige um budgetVersionItemId e remove allocations",
					422,
				);
			}
			const result = await constructionManualEntryService.createActualCost(
				scope.resourceOwnerId,
				params.workId,
				parsed.data,
				{ userId: user.id },
			);
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "CREATE",
				entityType: "ACTUAL_COST",
				entityId: result.id,
				entityDescription: `Custo ${result.category} - ${result.description ?? ""}`,
				newState: result as unknown as Record<string, unknown>,
			});
			return result;
		},
		{
			body: t.Object({
				costDate: t.String(),
				budgetVersionItemId: t.Optional(t.String({ minLength: 1 })),
				budgetIndex: t.Optional(t.String()),
				category: t.String(),
				categoryDetail: t.Optional(t.String()),
				description: t.String({ minLength: 1 }),
				amount: t.Number(),
				costType: t.String(),
				sourceDocument: t.Optional(t.String()),
				supplierId: t.Optional(t.Nullable(t.String())),
				supplierName: t.Optional(t.String()),
				costGroup: t.Optional(t.String()),
				paymentStatus: t.Optional(t.String()),
				allocations: t.Optional(
					t.Array(
						t.Object({
							budgetItemId: t.String({ minLength: 1 }),
							percentage: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
							value: t.Optional(t.Number({ minimum: 0 })),
						}),
						{ minItems: 1 },
					),
				),
			}),
			detail: { tags: ["Works"] },
		},
	)
	.patch(
		"/:workId/actual-costs/:id",
		async ({ params, body, user, scope }) => {
			const parsed = updateActualCostSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			if (
				env.AUDIT_RELEASE_B &&
				("allocations" in parsed.data ||
					("budgetVersionItemId" in parsed.data &&
						!parsed.data.budgetVersionItemId))
			) {
				throw new ConstructionError(
					"LEGACY_COST_CONTRACT_REMOVED",
					"Release B remove allocations e referencias legadas",
					422,
				);
			}
			const old = await prisma.constructionActualCost.findUnique({
				where: { id: params.id },
			});
			const result = await constructionManualEntryService.updateActualCost(
				scope.resourceOwnerId,
				params.workId,
				params.id,
				parsed.data,
			);
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "UPDATE",
				entityType: "ACTUAL_COST",
				entityId: params.id,
				entityDescription: `Custo ${result.category} - ${result.description ?? ""}`,
				previousState: old as unknown as Record<string, unknown>,
				newState: result as unknown as Record<string, unknown>,
			});
			return result;
		},
		{
			body: t.Object({
				costDate: t.Optional(t.String()),
				budgetVersionItemId: t.Optional(t.String({ minLength: 1 })),
				budgetIndex: t.Optional(t.String()),
				category: t.Optional(t.String()),
				categoryDetail: t.Optional(t.String()),
				description: t.Optional(t.String()),
				amount: t.Optional(t.Number()),
				costType: t.Optional(t.String()),
				sourceDocument: t.Optional(t.String()),
				supplierId: t.Optional(t.Nullable(t.String())),
				supplierName: t.Optional(t.String()),
				costGroup: t.Optional(t.String()),
				paymentStatus: t.Optional(t.String()),
				allocations: t.Optional(
					t.Array(
						t.Object({
							budgetItemId: t.String({ minLength: 1 }),
							percentage: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
							value: t.Optional(t.Number({ exclusiveMinimum: 0 })),
						}),
					),
				),
			}),
			detail: { tags: ["Works"] },
		},
	)
	.delete(
		"/:workId/actual-costs/:id",
		async ({ params, user, scope }) => {
			const old = await prisma.constructionActualCost.findUnique({
				where: { id: params.id },
			});
			await constructionManualEntryService.deleteActualCost(
				scope.resourceOwnerId,
				params.workId,
				params.id,
			);
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "DELETE",
					entityType: "ACTUAL_COST",
					entityId: params.id,
					entityDescription: `Custo ${old.category} - ${old.description ?? ""}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Works"] } },
	)
	.post(
		"/:workId/schedule",
		async ({ params, body, scope }) => {
			if (
				!body.items ||
				!Array.isArray(body.items) ||
				body.items.length === 0
			) {
				throw new ConstructionError(
					"INVALID_INPUT",
					"Lista de itens obrigatoria",
					400,
				);
			}
			return scheduleService.createSchedule(
				scope.resourceOwnerId,
				params.workId,
				body.items,
			);
		},
		{
			body: t.Object({
				items: t.Array(
					t.Object({
						index: t.String(),
						plannedStart: t.String(),
						plannedEnd: t.String(),
						plannedWeight: t.Number(),
					}),
				),
			}),
			detail: { tags: ["Schedule"] },
		},
	)
	.post(
		"/:workId/schedule/items",
		async ({ params, body, scope, user }) => {
			const result = await scheduleService.upsertManualScheduleItem(
				scope.resourceOwnerId,
				params.workId,
				body,
			);
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: result.created ? "CREATE" : "UPDATE",
				entityType: "SCHEDULE_BASELINE",
				entityId: result.id,
				entityDescription: `${result.created ? "Cronograma" : "Datas do cronograma"} - item ${result.index}`,
				newState: result as unknown as Record<string, unknown>,
			});
			return result;
		},
		{
			body: t.Object({
				budgetItemId: t.String({ minLength: 1 }),
				plannedStart: t.String({ minLength: 1 }),
				plannedEnd: t.String({ minLength: 1 }),
			}),
			detail: {
				tags: ["Schedule"],
				summary: "Criar ou editar datas do cronograma de um item",
			},
		},
	)
	.post(
		"/:workId/schedule/revisions",
		async ({ params, body, user, scope }) => {
			const revision = await scheduleService.addScheduleRevision(
				scope.resourceOwnerId,
				params.workId,
				body,
				user.id,
			);
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "CREATE",
				entityType: "SCHEDULE_REVISION",
				entityId: revision.id,
				entityDescription: `Replanejamento ${revision.version ?? "sem versao"} - item ${revision.index}`,
				newState: revision as unknown as Record<string, unknown>,
			});
			return revision;
		},
		{
			body: t.Object({
				index: t.String(),
				version: t.Optional(t.String()),
				replannedStart: t.String(),
				replannedEnd: t.String(),
				revisionDate: t.Optional(t.String()),
				reason: t.Optional(t.String()),
			}),
			detail: { tags: ["Schedule"], summary: "Registrar replanejamento" },
		},
	)
	.post(
		"/:workId/schedule/import",
		async ({ params, body, user, scope }) => {
			assertValidXlsxUpload(body.file);
			const bytes = new Uint8Array(await body.file.arrayBuffer());
			const parsed = parseWorkbookByKind(bytes, body.file.name, "cronograma");
			const validation = validateWorkbookByKind(parsed, "cronograma");
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

			const context = { ownerId: scope.resourceOwnerId, workId: params.workId };
			const acceptedBaselines = await resolveBaselineDependencies(
				validation.baselineSchedules,
				null,
				context,
				existingEntityLookup,
				validation.errors,
			);
			const baselineSheetPresent = validation.processedSheets.includes(
				"Cronograma Original",
			);
			const baselineIndexes: Set<string> | null = baselineSheetPresent
				? new Set(acceptedBaselines.map((row) => row.index))
				: null;
			const acceptedRevisions = await resolveReplanningDependencies(
				validation.scheduleRevisions,
				baselineIndexes,
				context,
				existingEntityLookup,
				validation.errors,
			);

			if (
				acceptedBaselines.length === 0 &&
				acceptedRevisions.length === 0 &&
				validation.errors.length === 0
			) {
				throw new ConstructionError(
					"NO_DATA",
					"Nenhum item de cronograma encontrado",
					400,
				);
			}

			const items = acceptedBaselines.map((row) => ({
				index: row.index,
				plannedStart: isoDateString(row.plannedStart) ?? "",
				plannedEnd: isoDateString(row.plannedEnd) ?? "",
				plannedWeight: row.plannedWeight ?? 0,
			}));

			await scheduleService.importSchedule(
				scope.resourceOwnerId,
				params.workId,
				items,
				acceptedRevisions,
				user.id,
			);

			const imported = items.length + acceptedRevisions.length;
			return {
				workId: params.workId,
				imported,
				importedCount: imported,
				rejectedCount: rejectedRowCount(validation.errors),
				processedSheets: validation.processedSheets,
				importedSections: validation.work.importedSections,
				warningCount: validation.warnings.length,
				warnings: validation.warnings,
				errors: validation.errors,
			};
		},
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Schedule"] },
		},
	)
	.post(
		"/:workId/measurements/import",
		async ({ params, body, scope }) => {
			assertValidXlsxUpload(body.file);
			const bytes = new Uint8Array(await body.file.arrayBuffer());
			const parsed = parseWorkbookByKind(bytes, body.file.name, "medicao-obra");
			const validation = validateWorkbookByKind(parsed, "medicao-obra");
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

			const accepted = await resolveMeasurementDependencies(
				validation.measurements,
				null,
				{ ownerId: scope.resourceOwnerId, workId: params.workId },
				existingEntityLookup,
				validation.errors,
			);
			if (accepted.length === 0 && validation.errors.length === 0) {
				throw new ConstructionError(
					"NO_DATA",
					"Nenhuma medicao encontrada",
					400,
				);
			}

			let imported = 0;
			if (accepted.length > 0) {
				const results = await constructionManualEntryService.importMeasurements(
					scope.resourceOwnerId,
					params.workId,
					accepted.map((row) => ({
						index: row.index,
						measurementDate: isoDateString(row.measurementDate),
						measuredPercentageAccumulated:
							row.measuredPercentageAccumulated * 100,
						measuredQuantityAccumulated:
							row.measuredQuantityAccumulated ?? undefined,
						notes: row.notes ?? undefined,
					})),
				);
				imported = results.length;
			}

			return {
				workId: params.workId,
				imported,
				importedCount: imported,
				rejectedCount: rejectedRowCount(validation.errors),
				processedSheets: validation.processedSheets,
				importedSections: validation.work.importedSections,
				warningCount: validation.warnings.length,
				warnings: validation.warnings,
				errors: validation.errors,
			};
		},
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Works"] },
		},
	)
	.post(
		"/:workId/actual-costs/import",
		async ({ params, body, scope }) => {
			assertValidXlsxUpload(body.file);
			const bytes = new Uint8Array(await body.file.arrayBuffer());
			const parsed = parseWorkbookByKind(bytes, body.file.name, "custos");
			const validation = validateWorkbookByKind(parsed, "custos");
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

			const accepted = await resolveActualCostDependencies(
				validation.actualCosts,
				null,
				{ ownerId: scope.resourceOwnerId, workId: params.workId },
				existingEntityLookup,
				validation.errors,
			);
			if (accepted.length === 0 && validation.errors.length === 0) {
				throw new ConstructionError(
					"NO_DATA",
					"Nenhum custo realizado encontrado",
					400,
				);
			}

			let imported = 0;
			if (accepted.length > 0) {
				const results = await constructionManualEntryService.importActualCosts(
					scope.resourceOwnerId,
					params.workId,
					accepted.map((row) => ({
						costDate: isoDateString(row.costDate) ?? "",
						budgetIndex: row.budgetIndex ?? undefined,
						category: row.category,
						description: row.description ?? undefined,
						amount: row.amount,
						costType: row.costType,
						sourceDocument: row.sourceDocument ?? undefined,
						supplierName: row.supplierName ?? undefined,
						costGroup: row.costGroup ?? undefined,
						paymentStatus: row.paymentStatus,
					})),
				);
				imported = results.length;
			}

			return {
				workId: params.workId,
				imported,
				importedCount: imported,
				rejectedCount: rejectedRowCount(validation.errors),
				processedSheets: validation.processedSheets,
				importedSections: validation.work.importedSections,
				warningCount: validation.warnings.length,
				warnings: validation.warnings,
				errors: validation.errors,
			};
		},
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Works"] },
		},
	);
