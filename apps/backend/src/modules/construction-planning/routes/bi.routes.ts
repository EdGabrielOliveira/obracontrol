import { Elysia, t } from "elysia";
import { z } from "zod";
import { parseAsOfDate } from "../../../lib/as-of-date";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { throwInvalidQuery } from "../../../lib/zod-validation";
import { ConstructionBIService } from "../bi/bi-service";
import { prismaExecutionViewRepository } from "../bi/execution-view.repository";
import { ExecutionViewService } from "../bi/execution-view.service";
import { metricSourceResolver } from "../bi/metric-source-resolver";
import { MonthlyFactService } from "../bi/monthly-fact.service";
import * as repository from "../repository";
import { ConstructionScheduleService } from "../schedule/schedule-service";
import { constructionBIWorksFilterSchema } from "../schema";
import { pdfReportService } from "../statistics/pdf-report.service";

const biService = new ConstructionBIService(repository);
const monthlyFactService = new MonthlyFactService();
const executionViewService = new ExecutionViewService(
	prismaExecutionViewRepository,
	metricSourceResolver,
	new ConstructionScheduleService(repository),
);

const compareQuerySchema = z.object({
	workIds: z
		.preprocess(
			(value) => {
				if (typeof value === "string")
					return value
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
				if (Array.isArray(value)) return value;
				return [];
			},
			z.array(z.string().min(1)),
		)
		.optional()
		.default([]),
});

export const biRoutes = new Elysia({ name: "bi-routes" })
	.use(resolveAuth)
	.get(
		"/bi/compare",
		async ({ query, user }) => {
			const parsed = compareQuerySchema.safeParse(query);
			if (!parsed.success) throwInvalidQuery(parsed.error);
			return biService.getCompareBI(user.id, parsed.data.workIds);
		},
		{ detail: { tags: ["BI"] } },
	)
	.get(
		"/bi/multiworks",
		async ({ query, user }) => {
			const parsed = constructionBIWorksFilterSchema.safeParse(query);
			if (!parsed.success) throwInvalidQuery(parsed.error);
			return biService.getMultiworksBI(
				user.id,
				parsed.data,
				parseAsOfDate(parsed.data.asOfDate),
			);
		},
		{ detail: { tags: ["BI"] } },
	)
	.use(requireWorkAccess("read"))
	.get(
		"/works/:workId/overview",
		async ({ params, query, scope }) => {
			return biService.getWorkBI(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: {
				tags: ["BI"],
				summary: "Indicadores EVM da obra com data de corte opcional",
			},
		},
	)
	.get(
		"/works/:workId/execution-view",
		async ({ params, query, scope }) => {
			return executionViewService.getExecutionView(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: {
				tags: ["BI"],
				summary:
					"Visao de execucao hierarquica (obra, contratos, cronograma e desvios)",
			},
		},
	)
	.get(
		"/works/:workId/execution-view/pdf",
		async ({ params, query, scope }) => {
			return pdfReportService.generateWorkExecutionPdf(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: {
				tags: ["BI"],
				summary:
					"PDF visual de obra com a mesma fonte/corte da visao de execucao",
			},
		},
	)
	.get(
		"/works/:workId/bi/monthly-facts",
		async ({ params, query, scope }) =>
			monthlyFactService.listByCompetencia({
				ownerId: scope.resourceOwnerId,
				workId: params.workId,
				competencia: query.competencia || undefined,
				origem: query.origem || undefined,
			}),
		{
			query: t.Object({
				competencia: t.Optional(t.String()),
				origem: t.Optional(t.String()),
			}),
			detail: {
				tags: ["BI"],
				summary: "Listar versões de fatos mensais da obra",
			},
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/works/:workId/bi/monthly-facts",
		async ({ body, params, user, scope }) =>
			monthlyFactService.persist({
				ownerId: scope.resourceOwnerId,
				userId: user.id,
				workId: params.workId,
				competencia: body.competencia,
				origem: body.origem,
				valores: body.valores,
				reason: body.reason,
			}),
		{
			body: t.Object({
				competencia: t.String(),
				origem: t.String(),
				valores: t.Record(
					t.String(),
					t.Union([t.Number(), t.String(), t.Null()]),
				),
				reason: t.Optional(t.String({ maxLength: 1000 })),
			}),
			detail: {
				tags: ["BI"],
				summary: "Persistir fato mensal versionado da obra",
			},
		},
	);
