import { Elysia, t } from "elysia";
import {
	requireRole,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { measurementCoverageService } from "../measurement-coverage.service";

export const measurementCoverageRoutes = new Elysia({
	prefix: "/works",
	name: "measurement-coverage-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/:workId/measurement-coverages",
		({ params, scope }) =>
			measurementCoverageService.list(scope.resourceOwnerId, params.workId),
		{
			params: t.Object({ workId: t.String() }),
			detail: { tags: ["Measurements"] },
		},
	)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/:workId/measurement-coverages",
		async ({ params, body, user, scope }) =>
			measurementCoverageService.link(
				scope.resourceOwnerId,
				params.workId,
				{
					workMeasurementItemId: body.workMeasurementItemId,
					contractMeasurementItemId: body.contractMeasurementItemId,
					quantity: body.quantity,
				},
				{ userId: user.id },
			),
		{
			params: t.Object({ workId: t.String() }),
			body: t.Object({
				workMeasurementItemId: t.String({ minLength: 1 }),
				contractMeasurementItemId: t.String({ minLength: 1 }),
				quantity: t.Number({ minimum: 0, exclusiveMinimum: 0 }),
			}),
			detail: { tags: ["Measurements"] },
		},
	)
	.delete(
		"/:workId/measurement-coverages/:coverageId",
		async ({ params, user, scope }) => {
			await measurementCoverageService.unlink(
				scope.resourceOwnerId,
				params.workId,
				params.coverageId,
				{ userId: user.id },
			);
			return new Response(null, { status: 204 });
		},
		{
			params: t.Object({ workId: t.String(), coverageId: t.String() }),
			detail: { tags: ["Measurements"] },
		},
	);
