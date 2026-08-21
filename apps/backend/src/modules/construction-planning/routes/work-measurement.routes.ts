import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { prisma } from "../../../lib/prisma";
import { resolveAuth } from "../../../lib/resolve-auth";
import { throwInvalidInput } from "../../../lib/zod-validation";
import { auditService } from "../../audit/audit.service";
import { normalizeGovernanceRole } from "../../governance/governance.service";
import {
	createWorkMeasurementSchema,
	updateWorkMeasurementSchema,
	workMeasurementFilterSchema,
} from "../schemas/work-measurement.schema";
import { pdfReportService } from "../statistics/pdf-report.service";
import { workMeasurementService } from "../work-measurement.service";

const ENTITY_TYPE = "WORK_MEASUREMENT" as const;

export const workMeasurementRoutes = new Elysia({
	prefix: "/works/:workId/work-measurements",
	name: "work-measurement-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/",
		async ({ params, query, scope }) => {
			const parsed = workMeasurementFilterSchema.safeParse(query);
			const filters = parsed.success ? parsed.data : {};
			return workMeasurementService.list(
				scope.resourceOwnerId,
				params.workId,
				filters,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.get(
		"/map",
		async ({ params, scope }) => {
			return workMeasurementService.getMap(
				scope.resourceOwnerId,
				params.workId,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.get(
		"/reports",
		async ({ params, scope }) => {
			return workMeasurementService.getReports(
				scope.resourceOwnerId,
				params.workId,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.get(
		"/summary",
		async ({ params, scope }) => {
			return workMeasurementService.getSummary(
				scope.resourceOwnerId,
				params.workId,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.get(
		"/:id",
		async ({ params, scope }) => {
			return workMeasurementService.get(
				scope.resourceOwnerId,
				params.workId,
				params.id,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.get(
		"/:id/report",
		async ({ params, scope }) => {
			return workMeasurementService.getReport(
				scope.resourceOwnerId,
				params.workId,
				params.id,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.get(
		"/:id/pdf",
		async ({ params, scope }) => {
			return pdfReportService.generateWorkMeasurementPdf(
				scope.resourceOwnerId,
				params.workId,
				params.id,
			);
		},
		{ detail: { tags: ["Work Measurements"] } },
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/",
		async ({ params, body, user, scope }) => {
			const parsed = createWorkMeasurementSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			const created = await workMeasurementService.create(
				scope.resourceOwnerId,
				params.workId,
				parsed.data,
				{ userId: user.id, role: normalizeGovernanceRole(user.role) },
			);
			return created;
		},
		{
			body: t.Object(
				{
					date: t.String(),
					title: t.String(),
					balanceOverride: t.Optional(t.Boolean()),
					evidenceNote: t.Optional(t.Union([t.String(), t.Null()])),
					items: t.Array(
						t.Object(
							{
								budgetItemId: t.String(),
								measuredQuantity: t.Number(),
								measuredValue: t.Optional(t.Never()),
								measuredPercentage: t.Optional(t.Never()),
								accumulatedQuantity: t.Optional(t.Never()),
								accumulatedValue: t.Optional(t.Never()),
								accumulatedPercentage: t.Optional(t.Never()),
							},
							{ additionalProperties: false },
						),
					),
				},
				{ additionalProperties: false },
			),
			detail: { tags: ["Work Measurements"] },
		},
	)
	.patch(
		"/:id",
		async ({ params, body, user, scope }) => {
			const parsed = updateWorkMeasurementSchema.safeParse(body);
			if (!parsed.success) throwInvalidInput(parsed.error);
			const updated = await workMeasurementService.update(
				scope.resourceOwnerId,
				params.workId,
				params.id,
				parsed.data,
				{ userId: user.id, role: normalizeGovernanceRole(user.role) },
			);
			return updated;
		},
		{
			body: t.Object(
				{
					title: t.Optional(t.String()),
					date: t.Optional(t.String()),
					balanceOverride: t.Optional(t.Boolean()),
					evidenceNote: t.Optional(t.Union([t.String(), t.Null()])),
					items: t.Optional(
						t.Array(
							t.Object(
								{
									budgetItemId: t.String(),
									measuredQuantity: t.Number(),
									measuredValue: t.Optional(t.Never()),
									measuredPercentage: t.Optional(t.Never()),
									accumulatedQuantity: t.Optional(t.Never()),
									accumulatedValue: t.Optional(t.Never()),
									accumulatedPercentage: t.Optional(t.Never()),
								},
								{ additionalProperties: false },
							),
						),
					),
				},
				{ additionalProperties: false },
			),
			detail: { tags: ["Work Measurements"] },
		},
	)
	.delete(
		"/:id",
		async ({ params, user, scope }) => {
			const old = await prisma.workMeasurement.findUnique({
				where: { id: params.id },
			});
			await workMeasurementService.delete(
				scope.resourceOwnerId,
				params.workId,
				params.id,
			);
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "DELETE",
					entityType: ENTITY_TYPE,
					entityId: params.id,
					entityDescription: `Medição #${old.number} - ${old.title}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Work Measurements"] } },
	);
