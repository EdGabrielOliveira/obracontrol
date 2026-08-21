export const organizationKeys = {
	all: ["organizations"] as const,
	list: (filters?: Record<string, unknown>) =>
		["organizations", "list", filters] as const,
	detail: (id: string) => ["organizations", id] as const,
	report: (orgId: string) => ["organization-report", orgId] as const,
};

export const dashboardKeys = {
	summary: ["dashboard-summary"] as const,
};

export const companyKeys = {
	all: ["companies"] as const,
	detail: (companyId: string) => ["companies", companyId] as const,
};

export const costCenterKeys = {
	all: (orgId: string) => ["cost-centers", orgId] as const,
	list: (orgId: string, filters?: Record<string, unknown>) =>
		["cost-centers", orgId, "list", filters] as const,
	allList: (filters?: Record<string, unknown>) =>
		["all-cost-centers", filters] as const,
	detail: (orgId: string, ccId: string) =>
		["cost-centers", orgId, ccId] as const,
	globalDetail: (ccId: string) => ["cost-center", ccId] as const,
	works: (orgId: string, ccId: string, filters?: Record<string, unknown>) =>
		["cost-centers", orgId, "works", ccId, filters] as const,
	orgScopedReport: (orgId: string, ccId: string) =>
		["org-cost-center-report", orgId, ccId] as const,
};

export const workKeys = {
	all: ["works"] as const,
	list: (filters?: Record<string, unknown>) =>
		["works", "list", filters] as const,
	allList: ["works", "list"] as const,
	dashboard: ["works-total"] as const,
	detail: (workId: string) => ["work", workId] as const,
	budgetVersion: (workId: string) => ["budget-version", workId] as const,
	budget: (workId: string) => ["budget", workId] as const,
	schedule: (workId: string) => ["schedule", workId] as const,
	scheduleVersions: (workId: string) => ["schedule-versions", workId] as const,
	physicalFinancialBase: (workId: string) =>
		["physical-financial", workId] as const,
	physicalFinancial: (workId: string, period: string) =>
		["physical-financial", workId, period] as const,
	measurementsBase: (workId: string) => ["work-measurements", workId] as const,
	measurementsList: (workId: string, filters?: Record<string, unknown>) =>
		["work-measurements", workId, "list", filters] as const,
	measurementDetail: (workId: string, measurementId: string) =>
		["work-measurement", workId, measurementId] as const,
	measurementDetailBase: (workId: string) =>
		["work-measurement", workId] as const,
	measurementReport: (workId: string, measurementId: string) =>
		["work-measurement-report", workId, measurementId] as const,
	measurementReportBase: (workId: string) =>
		["work-measurement-report", workId] as const,
	measurementMap: (workId: string) =>
		["work-measurements-map", workId] as const,
	measurementReports: (workId: string) =>
		["work-measurements-reports", workId] as const,
	measurementSummary: (workId: string) =>
		["work-measurements-summary", workId] as const,
	costs: (workId: string) => ["actual-costs", workId] as const,
	costsList: (workId: string, filters?: Record<string, unknown>) =>
		["actual-costs", workId, "list", filters] as const,
	costBudgetItems: (workId: string) =>
		["actual-costs", workId, "cost-budget-items"] as const,
	costDetailBase: (workId: string) => ["actual-cost", workId] as const,
	costDetail: (workId: string, costId: string) =>
		["actual-cost", workId, costId] as const,
	contracts: (workId: string) => ["contracts", workId] as const,
	contractsSummary: (workId: string) => ["contracts-summary", workId] as const,
	contractsList: (workId: string, filters?: Record<string, unknown>) =>
		["contracts", workId, "list", filters] as const,
	bi: (workId: string, asOfDate?: string) =>
		asOfDate ? (["bi", workId, asOfDate] as const) : (["bi", workId] as const),
	management: (workId: string, asOfDate?: string) =>
		asOfDate
			? (["management", workId, asOfDate] as const)
			: (["management", workId] as const),
	reports: (workId: string, asOfDate?: string) =>
		asOfDate
			? (["reports", workId, asOfDate] as const)
			: (["reports", workId] as const),
};

export const budgetVersionKeys = {
	all: (workId: string) => ["budget-versions", workId] as const,
	effective: (workId: string) => ["budget-version", workId] as const,
	history: (workId: string) => ["budget-versions", workId, "history"] as const,
	detail: (workId: string, versionId: string) =>
		["budget-versions", workId, versionId] as const,
	importPreview: (workId: string, importId: string) =>
		["budget-versions", workId, "imports", importId] as const,
};

export const contractRequestKeys = {
	all: (workId: string) => ["contract-requests", workId] as const,
	detail: (workId: string, requestId: string) =>
		["contract-requests", workId, requestId] as const,
	comparison: (workId: string, requestId: string) =>
		["contract-requests", workId, requestId, "comparison"] as const,
};

export const contractKeys = {
	artifacts: (workId: string, contractId: string) =>
		["contract-artifacts", workId, contractId] as const,
	instrumentReadiness: (workId: string, contractId: string) =>
		["contract-instrument-readiness", workId, contractId] as const,
	detailBase: (workId: string) => ["contract", workId] as const,
	detail: (workId: string, contractId: string) =>
		["contract", workId, contractId] as const,
	amendments: (workId: string, contractId: string) =>
		["contract-amendments", workId, contractId] as const,
	servicesBase: (workId: string) => ["contract-services", workId] as const,
	services: (workId: string, contractId: string) =>
		["contract-services", workId, contractId] as const,
	servicesPreview: (
		workId: string,
		contractId: string,
		input?: Record<string, unknown>,
	) => ["contract-services", workId, contractId, "preview", input] as const,
	measurementsBase: (workId: string) =>
		["contract-measurements", workId] as const,
	measurements: (workId: string, contractId: string) =>
		["contract-measurements", workId, contractId] as const,
	measurementsList: (
		workId: string,
		contractId: string,
		filters?: Record<string, unknown>,
	) => ["contract-measurements", workId, contractId, "list", filters] as const,
	measurementDetail: (
		workId: string,
		contractId: string,
		measurementId: string,
	) => ["contract-measurement", workId, contractId, measurementId] as const,
	measurementDetailBase: (workId: string) =>
		["contract-measurement", workId] as const,
	measurementMap: (workId: string, contractId: string) =>
		["contract-measurements-map", workId, contractId] as const,
	measurementMapBase: (workId: string) =>
		["contract-measurements-map", workId] as const,
	aggregate: (workId: string, contractId: string) =>
		["contract-aggregate", workId, contractId] as const,
	aggregateBase: (workId: string) => ["contract-aggregate", workId] as const,
	payments: (workId: string, contractId: string) =>
		["contract-payments", workId, contractId] as const,
	paymentsList: (
		workId: string,
		contractId: string,
		filters?: Record<string, unknown>,
	) => ["contract-payments", workId, contractId, "list", filters] as const,
	paymentsSummary: (workId: string, contractId: string) =>
		["contract-payments-summary", workId, contractId] as const,
	report: (workId: string, contractId: string) =>
		["contract-report", workId, contractId] as const,
	reportBase: (workId: string) => ["contract-report", workId] as const,
};

export const apiKeyKeys = {
	all: ["api-keys"] as const,
	list: (filters?: Record<string, unknown>) =>
		["api-keys", "list", filters] as const,
};

export const documentationKeys = {
	all: ["api-documentation"] as const,
};

export const supplierKeys = {
	all: ["suppliers"] as const,
	list: (filters?: Record<string, unknown>) =>
		["suppliers", "list", filters] as const,
	detail: (supplierId: string) => ["supplier", supplierId] as const,
	analytics: () => ["suppliers", "analytics"] as const,
};

export const workSupplierKeys = {
	all: (workId: string) => ["work-suppliers", workId] as const,
	list: (workId: string) => ["work-suppliers", workId, "list"] as const,
};

export const auditKeys = {
	all: ["audit-logs"] as const,
	list: (filters?: Record<string, unknown>) =>
		["audit-logs", "list", filters] as const,
	work: (workId: string, filters?: Record<string, unknown>) =>
		["audit-logs", "work", workId, filters] as const,
};

export const importKeys = {
	all: ["imports"] as const,
	listBase: (workId?: string) => ["imports", "list", workId ?? ""] as const,
	list: (workId?: string, filters?: Record<string, unknown>) =>
		["imports", "list", workId ?? "", filters] as const,
	detail: (importId: string) => ["imports", importId] as const,
};

export const importBatchKeys = {
	all: ["import-batches"] as const,
	listBase: (workId: string) => ["import-batches", "list", workId] as const,
	list: (workId: string, page = 1, pageSize = 20) =>
		["import-batches", "list", workId, page, pageSize] as const,
	preview: (workId: string, batchId: string, page = 1, pageSize = 500) =>
		["import-batches", "preview", workId, batchId, page, pageSize] as const,
};

export const measurementCoverageKeys = {
	list: (workId: string) => ["measurement-coverages", workId] as const,
};

export const governanceKeys = {
	all: ["governance"] as const,
	detail: (entityType: string, entityId: string) =>
		["governance", entityType, entityId] as const,
	pendingApprovals: (workId?: string) =>
		["governance", "approvals", "pending", workId ?? "global"] as const,
};

export const notificationKeys = {
	all: ["notifications"] as const,
	list: (status: string = "PENDING") => ["notifications", status] as const,
	count: ["notifications", "count"] as const,
};

export const adminUserKeys = {
	all: ["admin-users"] as const,
	list: (filters?: Record<string, unknown>) =>
		["admin-users", "list", filters] as const,
	detail: (id: string) => ["admin-user", id] as const,
	invitations: (filters?: Record<string, unknown>) =>
		["admin-users", "invitations", filters] as const,
};

export const biKeys = {
	all: ["bi"] as const,
	multiworksAll: ["bi-multiworks"] as const,
	overview: (orgId: string, filters?: Record<string, unknown>) =>
		["bi", orgId, filters] as const,
	costCenterOverview: (
		orgId: string,
		ccId: string,
		filters?: Record<string, unknown>,
	) => ["bi", orgId, ccId, filters] as const,
	multiworks: (filters?: Record<string, unknown>) =>
		["bi-multiworks", filters] as const,
	compare: (workIds: string[]) => ["bi-compare", ...workIds] as const,
	snapshot: (workId: string, kind?: string) =>
		["bi-snapshot", workId, kind] as const,
	snapshotVersions: (workId: string, kind?: string) =>
		["bi-snapshot-versions", workId, kind] as const,
	snapshotComparison: (
		workId: string,
		fromKind?: string,
		toKind?: string,
		fromVersion?: number,
		toVersion?: number,
	) =>
		[
			"bi-snapshot-comparison",
			workId,
			fromKind,
			toKind,
			fromVersion,
			toVersion,
		] as const,
	snapshotEvents: (workId: string) => ["bi-snapshot-events", workId] as const,
	snapshotScope: (workId: string) => ["bi-snapshot-scope", workId] as const,
	snapshotReconciliation: (workId: string, kind?: string) =>
		["bi-snapshot-reconciliation", workId, kind] as const,
	monthlyFacts: (workId: string, filters?: Record<string, unknown>) =>
		["bi-monthly-facts", workId, filters] as const,
};

export const quotationKeys = {
	all: ["quotations"] as const,
	list: (workId: string) => ["quotations", "list", workId] as const,
	detail: (workId: string, quotationId: string) =>
		["quotations", "detail", workId, quotationId] as const,
	comparison: (workId: string, quotationId: string) =>
		["quotations", "comparison", workId, quotationId] as const,
};
