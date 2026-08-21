import { Elysia, t } from "elysia";
import { parseAsOfDate } from "../../../lib/as-of-date";
import {
	requireRole,
	requireScopedAccess,
	requireWorkAccess,
} from "../../../lib/authorization-middleware";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { resolveAuth } from "../../../lib/resolve-auth";
import { managementService } from "../management.service";
import { pdfReportService } from "../statistics/pdf-report.service";

async function resolveContractResource(
	params: Record<string, string | undefined>,
) {
	if (!params.contractId) return null;
	const contract = await prisma.contract.findUnique({
		where: { id: params.contractId },
		select: { workId: true },
	});
	return contract ? { workId: contract.workId } : null;
}

const workReportRoutes = new Elysia({ name: "reports-work-read-routes" })
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(requireWorkAccess("read"))
	.get(
		"/reports/work/:workId",
		async ({ params, query, scope }) => {
			return managementService.getWorkReport(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: { tags: ["Reports"] },
		},
	)
	.get(
		"/reports/work/:workId/pdf",
		async ({ params, query, scope }) => {
			return pdfReportService.generateWorkPdf(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: { tags: ["Reports"] },
		},
	)
	.get(
		"/reports/work/:workId/management/pdf",
		async ({ params, query, scope }) => {
			return pdfReportService.generateWorkManagementPdf(
				scope.resourceOwnerId,
				params.workId,
				parseAsOfDate(query.asOfDate),
			);
		},
		{
			query: t.Object({
				asOfDate: t.Optional(t.String()),
			}),
			detail: { tags: ["Reports"] },
		},
	);

const contractReportRoutes = new Elysia({
	name: "reports-contract-read-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(
		requireScopedAccess(
			"read",
			resolveContractResource,
			"Contrato nao encontrado",
			"require-contract-access-read",
		),
	)
	.get(
		"/reports/contract/:contractId",
		async ({ params, scope }) => {
			return managementService.getContractReport(
				scope.resourceOwnerId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Reports"] } },
	)
	.get(
		"/reports/contract/:contractId/pdf",
		async ({ params, scope }) => {
			return pdfReportService.generateContractReportPdf(
				scope.resourceOwnerId,
				params.contractId,
			);
		},
		{ detail: { tags: ["Reports"] } },
	);

const costCenterReportRoutes = new Elysia({
	name: "reports-cost-center-read-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.use(
		requireScopedAccess(
			"read",
			(params) => ({ costCenterId: params?.ccId }),
			"Centro de custo nao encontrado",
			"require-cost-center-access-read",
		),
	)
	.get(
		"/reports/cost-center/:ccId",
		async ({ params, scope }) => {
			return managementService.getCostCenterReport(
				scope.resourceOwnerId,
				params.ccId,
			);
		},
		{ detail: { tags: ["Reports"] } },
	)
	.get(
		"/reports/cost-center/:ccId/pdf",
		async ({ params, scope }) => {
			return pdfReportService.generateCostCenterPdf(
				scope.resourceOwnerId,
				params.ccId,
			);
		},
		{ detail: { tags: ["Reports"] } },
	);

const writeReportRoutes = new Elysia({ name: "reports-write-routes" })
	.use(resolveAuth)
	.use(requireRole("write"))
	.use(requireWorkAccess("write"))
	.post(
		"/reports/photo-pdf/:workId",
		async ({ body, params, scope }) => {
			if (!body.file) {
				throw new ConstructionError("MISSING_FILE", "Arquivo obrigatorio", 400);
			}
			const result = await managementService.receiveWorkPhotoPdf(
				scope.resourceOwnerId,
				params.workId,
				body.file,
			);
			return new Response(JSON.stringify(result), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		},
		{
			body: t.Object({ file: t.File() }),
			detail: { tags: ["Reports"] },
		},
	);

export const reportsRoutes = new Elysia({ name: "reports-routes" })
	.use(resolveAuth)
	.use(workReportRoutes)
	.use(contractReportRoutes)
	.use(costCenterReportRoutes)
	.use(writeReportRoutes);
