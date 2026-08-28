export type AuditAction =
	| "CREATE"
	| "UPDATE"
	| "STATUS_CHANGED"
	| "DELETE"
	| "APPROVE"
	| "REJECT"
	| "REPROCESS"
	| "EXPORT"
	| "SUBMIT"
	| "RESTORE";

export type DomainAuditAction =
	| "QUOTATION_NEGOTIATED"
	| "QUOTATION_REQUOTED"
	| "CONTRACT_REQUEST_SELECTED"
	| "CONTRACT_REQUEST_FINALIZED"
	| "APPROVAL_REVERSED"
	| "CONTRACT_AMENDMENT_CREATED"
	| "INSTRUMENT_GENERATED"
	| "INSTRUMENT_DOWNLOADED"
	| "COMMENT_CREATED";

export type AuditEntityType =
	| "WORK"
	| "BUDGET_ITEM"
	| "ACTUAL_COST"
	| "CONSTRUCTION_MEASUREMENT"
	| "SCHEDULE_REVISION"
	| "WORK_MEASUREMENT"
	| "CONSTRUCTION_IMPORT"
	| "CONTRACT"
	| "CONTRACT_AMENDMENT"
	| "CONTRACT_MEASUREMENT"
	| "CONTRACT_PAYMENT"
	| "BI_SNAPSHOT"
	| "BI_SNAPSHOT_SCOPE"
	| "EXPORT"
	| "APPROVAL_REQUEST"
	| "GOVERNANCE_RECORD"
	| "ORGANIZATION"
	| "COST_CENTER"
	| "WORK_MEMBERSHIP"
	| "CONTRACT_REQUEST_PROPOSAL"
	| "CONTRACT_SERVICE"
	| "QUOTATION_PROPOSAL"
	| "QUOTATION"
	| "SUPPLIER"
	| "SCHEDULE_BASELINE"
	| "USER_SCOPE"
	| "USER";

export type AuditLogEntry = {
	id: string;
	userId: string;
	action: AuditAction | DomainAuditAction;
	entityType: AuditEntityType;
	entityId: string;
	entityDescription: string | null;
	previousState: Record<string, unknown> | null;
	newState: Record<string, unknown> | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	navigationTarget?: {
		path: string;
		label: string;
	} | null;
	user: {
		id: string;
		name: string;
		email: string;
	};
};

export type AuditLogFilter = {
	entityType?: string;
	entityTypes?: string;
	entityId?: string;
	userId?: string;
	userSearch?: string;
	action?: string;
	actions?: string;
	fromDate?: string;
	toDate?: string;
	companyId?: string;
	organizationId?: string;
	costCenterId?: string;
	workId?: string;
	page?: number;
	limit?: number;
};
