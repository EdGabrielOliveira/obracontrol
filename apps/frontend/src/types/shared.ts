import { z } from "zod";

export type PaginationMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

export type IndicatorStatus = "AVAILABLE" | "UNAVAILABLE";

export type Indicator<T> = {
	status: IndicatorStatus;
	value: T | null;
	formula: string;
	unavailableReason?: string;
};

export type DataCompleteness = {
	hasBudget: boolean;
	hasBaselineSchedule: boolean;
	hasMeasurements: boolean;
	hasActualCosts: boolean;
	hasFutureCosts: boolean;
	hasUnappropriatedActualCosts: boolean;
	hasUnappropriatedFutureCosts: boolean;
};

export const scheduleRiskSchema = z.enum([
	"AHEAD",
	"ON_TRACK",
	"BEHIND",
	"UNAVAILABLE",
]);

export const costRiskSchema = z.enum([
	"BELOW_COST",
	"ON_COST",
	"OVER_COST",
	"UNAVAILABLE",
]);

export const constructionItemStatusSchema = z.enum([
	"DRAFT",
	"NOT_STARTED",
	"IN_PROGRESS",
	"DONE",
	"SUSPENDED",
	"IGNORED",
]);

export type ScheduleRisk = z.infer<typeof scheduleRiskSchema>;
export type CostRisk = z.infer<typeof costRiskSchema>;
export type ConstructionItemStatus = z.infer<
	typeof constructionItemStatusSchema
>;

export type PaymentStatus = "PAID" | "OPEN";

export type MeasurementLifecycleStatus =
	| "RASCUNHO"
	| "ACEITO"
	| "RECUSADO"
	| "ARQUIVADO";

export type ApiErrorField = {
	field?: string;
	message: string;
};

export type ApiErrorResponse = {
	message: string;
	errors?: Record<string, string[] | string> | ApiErrorField[];
};
