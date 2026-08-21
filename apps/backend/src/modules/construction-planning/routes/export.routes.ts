import { Elysia, t } from "elysia";
import { parseAsOfDate } from "../../../lib/as-of-date";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { rateLimitApi } from "../../../lib/rate-limit";
import { resolveAuth } from "../../../lib/resolve-auth";
import type { ExportMode } from "../export.service";
import { exportService } from "../export.service";

const modeQuery = t.Optional(t.Union([t.Literal("raw"), t.Literal("report")]));

function parseMode(value: "raw" | "report" | undefined): ExportMode {
	return value ?? "report";
}

export const exportRoutes = new Elysia({ name: "export-routes" })
	.use(resolveAuth)
	.use(rateLimitApi({ windowMs: 60 * 1000, max: 60, key: "export" }))
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/works/:workId/export/orcamento",
		async ({ params, query, user, scope }) => {
			return exportService.exportOrcamento(
				scope.resourceOwnerId,
				params.workId,
				{
					asOfDate: parseAsOfDate(query.asOfDate),
					mode: parseMode(query.mode),
					actor: { id: user.id, name: user.name },
				},
			);
		},
		{
			query: t.Object({ asOfDate: t.Optional(t.String()), mode: modeQuery }),
			detail: { tags: ["Export"] },
		},
	)
	.get(
		"/works/:workId/export/medicoes",
		async ({ params, query, user, scope }) => {
			return exportService.exportMedicoes(
				scope.resourceOwnerId,
				params.workId,
				{
					asOfDate: parseAsOfDate(query.asOfDate),
					mode: parseMode(query.mode),
					actor: { id: user.id, name: user.name },
				},
			);
		},
		{
			query: t.Object({ asOfDate: t.Optional(t.String()), mode: modeQuery }),
			detail: { tags: ["Export"] },
		},
	)
	.get(
		"/works/:workId/export/custos",
		async ({ params, query, user, scope }) => {
			return exportService.exportCustos(scope.resourceOwnerId, params.workId, {
				asOfDate: parseAsOfDate(query.asOfDate),
				mode: parseMode(query.mode),
				actor: { id: user.id, name: user.name },
			});
		},
		{
			query: t.Object({ asOfDate: t.Optional(t.String()), mode: modeQuery }),
			detail: { tags: ["Export"] },
		},
	)
	.get(
		"/works/:workId/export/contratos",
		async ({ params, query, user, scope }) => {
			return exportService.exportContratos(
				scope.resourceOwnerId,
				params.workId,
				{
					asOfDate: parseAsOfDate(query.asOfDate),
					mode: parseMode(query.mode),
					actor: { id: user.id, name: user.name },
				},
			);
		},
		{
			query: t.Object({ asOfDate: t.Optional(t.String()), mode: modeQuery }),
			detail: { tags: ["Export"] },
		},
	)
	.get(
		"/works/:workId/export/completo",
		async ({ params, query, user, scope }) => {
			return exportService.exportCompleto(
				scope.resourceOwnerId,
				params.workId,
				{
					asOfDate: parseAsOfDate(query.asOfDate),
					mode: parseMode(query.mode),
					actor: { id: user.id, name: user.name },
				},
			);
		},
		{
			query: t.Object({ asOfDate: t.Optional(t.String()), mode: modeQuery }),
			detail: { tags: ["Export"] },
		},
	);

exportRoutes.get(
	"/works/:workId/export/estatisticas",
	async ({ params, query, scope }) =>
		exportService.exportWorkStatistics(
			scope.resourceOwnerId,
			params.workId,
			query.period,
		),
	{
		query: t.Object({
			period: t.Optional(
				t.Union([
					t.Literal("daily"),
					t.Literal("weekly"),
					t.Literal("monthly"),
				]),
			),
		}),
		detail: { tags: ["Export"] },
	},
);

export const generalExportRoutes = new Elysia({ name: "general-export-routes" })
	.use(resolveAuth)
	.use(rateLimitApi({ windowMs: 60 * 1000, max: 60, key: "general-export" }))
	.use(requireRole("read"))
	.get(
		"/export/fornecedores",
		({ user }) => exportService.exportSuppliers(user.id),
		{ detail: { tags: ["Export"] } },
	)
	.get(
		"/export/estatisticas-gerais",
		({ user }) => exportService.exportSystemStatistics(user.id),
		{ detail: { tags: ["Export"] } },
	);
