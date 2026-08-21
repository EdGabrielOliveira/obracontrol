import { Elysia, t } from "elysia";
import { requireRole } from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { scheduleVersionService } from "./schedule-version.service";

export const scheduleVersionRoutes = new Elysia({
	prefix: "/works/:workId/schedule-versions",
	name: "schedule-version-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/",
		async ({ params, user }) =>
			scheduleVersionService.getScheduleVersions(user.id, params.workId),
		{ detail: { tags: ["Schedule"], summary: "Listar versões de cronograma" } },
	)
	.get(
		"/:versionId",
		async ({ params, user }) =>
			scheduleVersionService.getScheduleVersion(
				user.id,
				params.workId,
				params.versionId,
			),
		{
			detail: {
				tags: ["Schedule"],
				summary: "Detalhe de versão de cronograma",
			},
		},
	)
	.use(requireRole("write"))
	.post(
		"/revisions",
		async ({ params, body, user }) =>
			scheduleVersionService.createScheduleRevisionVersion(
				user.id,
				params.workId,
				body,
			),
		{
			body: t.Object({
				index: t.String(),
				replannedStart: t.String(),
				replannedEnd: t.String(),
				revisionDate: t.Optional(t.Union([t.String(), t.Null()])),
				reason: t.Optional(t.Union([t.String(), t.Null()])),
			}),
			detail: {
				tags: ["Schedule"],
				summary: "Registrar replanejamento como versão",
			},
		},
	);
