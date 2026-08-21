import { Elysia } from "elysia";
import { handleConstructionError } from "../../lib/construction-error-handler";
import { resolveAuth } from "../../lib/resolve-auth";
import { getDashboardSummary } from "./dashboard-summary.service";
import { biRoutes } from "./routes/bi.routes";
import { budgetRoutes } from "./routes/budget.routes";
import { budgetControlRoutes } from "./routes/budget-control.routes";
import { budgetReconciliationRoutes } from "./routes/budget-reconciliation.routes";
import { budgetVersionRoutes } from "./routes/budget-version.routes";
import { contractRoutes } from "./routes/contract.routes";
import { contractMeasurementRoutes } from "./routes/contract-measurement.routes";
import {
	contractRequestRoutes,
	contractRequestTemplateRoutes,
} from "./routes/contract-request.routes";
import { costBudgetItemsRoutes } from "./routes/cost-budget-items.routes";
import { exportRoutes, generalExportRoutes } from "./routes/export.routes";
import {
	importBatchCancelRoutes,
	importBatchRoutes,
	importRoutes,
} from "./routes/import.routes";
import { managementRoutes } from "./routes/management.routes";
import { measurementCoverageRoutes } from "./routes/measurement-coverage.routes";
import { quotationRoutes } from "./routes/quotation.routes";
import { reportsRoutes } from "./routes/reports.routes";
import { statisticsRoutes } from "./routes/statistics.routes";
import { supplierRoutes } from "./routes/supplier.routes";
import { supplierAnalyticsRoutes } from "./routes/supplier-analytics.routes";
import { templateRoutes } from "./routes/template.routes";
import { workRoutes } from "./routes/work.routes";
import { workMeasurementRoutes } from "./routes/work-measurement.routes";
import { workSupplierRoutes } from "./routes/work-supplier.routes";
import { scheduleVersionRoutes } from "./schedule/schedule-version.routes";

export const constructionPlanningController = new Elysia({
	prefix: "/construction",
	name: "construction-planning",
})
	.onError(handleConstructionError)
	.use(templateRoutes)
	.use(generalExportRoutes)
	.use(statisticsRoutes)
	.use(contractRequestTemplateRoutes)
	.use(resolveAuth)
	.get("/dashboard-summary", ({ user }) => getDashboardSummary(user.id), {
		detail: {
			tags: ["Construction Dashboard"],
			summary: "Resumo agregado do dashboard",
			description:
				"Retorna os contadores e a distribuicao de status no escopo acessivel ao ator autenticado.",
		},
	})
	.use(importRoutes)
	.use(importBatchRoutes)
	.use(importBatchCancelRoutes)
	.use(budgetRoutes)
	.use(budgetVersionRoutes)
	.use(costBudgetItemsRoutes)
	.use(budgetControlRoutes)
	.use(budgetReconciliationRoutes)
	.use(workRoutes)
	.use(workSupplierRoutes)
	.use(quotationRoutes)
	.use(contractRequestRoutes)
	.use(scheduleVersionRoutes)
	.use(workMeasurementRoutes)
	.use(measurementCoverageRoutes)
	.use(contractRoutes)
	.use(contractMeasurementRoutes)
	.use(managementRoutes)
	.use(reportsRoutes)
	.use(supplierAnalyticsRoutes)
	.use(supplierRoutes)
	.use(exportRoutes)
	.use(biRoutes);
