import type { Decimal } from "@prisma/client/runtime/library";
import { deriveWorkIdentity } from "../identity";
import { normalizeWorkOperationalStatus } from "../works/work-operational-status";
import type {
	DbActualCostInput,
	DbBaselineScheduleInput,
	DbItemCalculationInput,
	DbMeasurementInput,
} from "./calculations";
import { buildWorkSummary, toMetricItem } from "./calculations";
import {
	composeMeasurementInputs,
	type ManualWorkMeasurementInput,
} from "./measurement-adapter";
import { calculateWorkMetrics } from "./metrics";

type ActiveChildren = {
	items: DbItemCalculationInput[];
	baselineSchedules: DbBaselineScheduleInput[];
	measurements: DbMeasurementInput[];
	actualCosts: DbActualCostInput[];
	manualMeasurements?: ManualWorkMeasurementInput[];
};

function emptyWorkSummary(overrides: {
	id: string;
	name: string;
	costCenterId?: string | null;
	lastImportAt: string;
	plannedStart: string | null;
	plannedEnd: string | null;
	baseDate: string | null;
	code?: string;
	clientName?: string | null;
	operationalStatus?: string | null;
	bdiPercentage?: number | Decimal | null;
}) {
	return {
		id: overrides.id,
		code: overrides.code ?? overrides.id,
		name: overrides.name,
		costCenterId: overrides.costCenterId ?? null,
		clientName: overrides.clientName ?? null,
		plannedStart: overrides.plannedStart,
		plannedEnd: overrides.plannedEnd,
		baseDate: overrides.baseDate,
		totalBudget: 0,
		activeBudget: 0,
		directBudget: 0,
		bdiPercentage: Number(overrides.bdiPercentage ?? 0),
		bdiValue: 0,
		ignoredBudget: 0,
		suspendedBudget: 0,
		plannedValue: 0,
		earnedValue: 0,
		actualCost: 0,
		futureCost: 0,
		measuredPercentage: 0,
		plannedPercentage: null,
		scheduleVariance: null,
		schedulePerformanceIndex: null,
		costVariance: null,
		costPerformanceIndex: null,
		currentBudgetBalance: 0,
		projectedBudgetBalance: 0,
		balance: 0,
		dataCompleteness: {
			hasBudget: false,
			hasBaselineSchedule: false,
			hasMeasurements: false,
			hasActualCosts: false,
			hasFutureCosts: false,
			hasUnappropriatedActualCosts: false,
			hasUnappropriatedFutureCosts: false,
		},
		computedStatus: normalizeWorkOperationalStatus(overrides.operationalStatus),
		operationalStatus: normalizeWorkOperationalStatus(
			overrides.operationalStatus,
		),
		scheduleRisk: "UNAVAILABLE" as const,
		costRisk: "UNAVAILABLE" as const,
		lastImportAt: overrides.lastImportAt,
	};
}

export function computeWorkSummary(w: {
	id: string;
	code: string;
	name: string;
	costCenterId?: string | null;
	clientName: string | null;
	operationalStatus?: string | null;
	bdiPercentage?: number | Decimal | null;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	baseDate: Date | null;
	createdAt: Date;
	lastImportAt: Date;
	activeChildren: ActiveChildren | null;
}) {
	const identity = deriveWorkIdentity({
		code: w.code,
		name: w.name,
		baseDate: w.baseDate,
	});

	if (!w.activeChildren?.items.length) {
		return emptyWorkSummary({
			id: w.id,
			code: identity.code,
			name: identity.name,
			costCenterId: w.costCenterId,
			clientName: w.clientName,
			operationalStatus: w.operationalStatus,
			plannedStart: w.plannedStart?.toISOString() ?? null,
			plannedEnd: w.plannedEnd?.toISOString() ?? null,
			baseDate: identity.baseDate?.toISOString() ?? null,
			bdiPercentage: w.bdiPercentage,
			lastImportAt: w.lastImportAt.toISOString(),
		});
	}

	const measurements = composeMeasurementInputs(
		w.activeChildren.measurements,
		w.activeChildren.manualMeasurements,
	);

	const metrics = calculateWorkMetrics(
		{
			id: w.id,
			name: identity.name,
			plannedStart: w.plannedStart,
			plannedEnd: w.plannedEnd,
			baseDate: identity.baseDate,
			createdAt: w.createdAt,
			lastImportAt: w.lastImportAt,
			bdiPercentage: w.bdiPercentage,
		},
		w.activeChildren.items.map(toMetricItem),
		w.activeChildren.baselineSchedules.length > 0
			? w.activeChildren.baselineSchedules
			: undefined,
		measurements.length > 0 ? measurements : undefined,
		w.activeChildren.actualCosts.length > 0
			? w.activeChildren.actualCosts
			: undefined,
	);

	const summary = buildWorkSummary(
		{
			id: w.id,
			code: identity.code,
			name: identity.name,
			costCenterId: w.costCenterId,
			clientName: w.clientName,
			plannedStart: w.plannedStart,
			plannedEnd: w.plannedEnd,
			baseDate: identity.baseDate,
			createdAt: w.createdAt,
			lastImportAt: w.lastImportAt,
		},
		metrics,
	);
	const operationalStatus = normalizeWorkOperationalStatus(w.operationalStatus);
	return {
		...summary,
		operationalStatus,
		computedStatus: operationalStatus,
	};
}
