import { roundCurrency } from "../../lib/math-utils";
import { toFiniteNumber } from "../../lib/number-utils";
import type { SchedulePeriod } from "../../lib/period-utils";
import { prisma } from "../../lib/prisma";
import {
	projectManagementDashboard,
	projectPhysicalFinancialSchedule,
	projectWorkReport,
	type WorkReportIdentity,
} from "./bi/management-projections";
import type { ResolvedMetricSource } from "./bi/metric-source";
import { resolveMetricSource } from "./bi/metric-source-resolver";
import {
	buildWorkMetricsSnapshot,
	type WorkMetricsSnapshot,
} from "./bi/work-metrics-snapshot";
import { getContractAggregate } from "./contract-measurement.repository";
import { getWorkMeasurementsForBI } from "./repository";
import { getWorkWithItems } from "./works/works.repository";

export async function getWorkMetricsSnapshot(
	ownerId: string,
	workId: string,
	asOf?: Date,
) {
	const [work, manualMeasurements] = await Promise.all([
		getWorkWithItems(ownerId, workId),
		getWorkMeasurementsForBI(ownerId, workId),
	]);

	if (!work) return null;

	return {
		work,
		...buildWorkMetricsSnapshot({ work, manualMeasurements, asOf }),
	};
}

function snapshotFromResolved(
	resolved: ResolvedMetricSource,
): WorkMetricsSnapshot {
	return {
		input: resolved.input,
		metrics: resolved.metrics,
		manualMeasurements: resolved.manualMeasurements,
	};
}

function resolvedEnvelopeFields(resolved: ResolvedMetricSource) {
	return {
		sourceMode: resolved.mode,
		snapshot: resolved.snapshot,
	} as const;
}

type WorkReportContext = {
	resolved: ResolvedMetricSource;
	report: ReturnType<typeof projectWorkReport> & {
		sourceMode: "LIVE";
		snapshot: ResolvedMetricSource["snapshot"];
	};
	dashboard: ReturnType<typeof projectManagementDashboard> & {
		sourceMode: "LIVE";
		snapshot: ResolvedMetricSource["snapshot"];
	};
	schedule: ReturnType<typeof projectPhysicalFinancialSchedule>;
};

async function resolveWorkReportContext(
	ownerId: string,
	workId: string,
	asOf?: Date,
): Promise<WorkReportContext | null> {
	const identity = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: {
			id: true,
			name: true,
			code: true,
			costCenter: { select: { id: true, name: true } },
		},
	});
	if (!identity) return null;

	const reportIdentity: WorkReportIdentity = {
		work: { id: identity.id, name: identity.name, code: identity.code },
		costCenter: identity.costCenter
			? { id: identity.costCenter.id, name: identity.costCenter.name }
			: null,
	};

	const resolved = await resolveMetricSource({
		ownerId,
		workId,
		asOfDate: asOf,
	});
	const snapshot = snapshotFromResolved(resolved);
	const envelope = resolvedEnvelopeFields(resolved);

	return {
		resolved,
		report: { ...projectWorkReport(snapshot, reportIdentity), ...envelope },
		dashboard: { ...projectManagementDashboard(snapshot), ...envelope },
		schedule: projectPhysicalFinancialSchedule(snapshot, "monthly"),
	};
}

export async function getWorkManagementDashboard(
	ownerId: string,
	workId: string,
	asOf?: Date,
) {
	const context = await resolveWorkReportContext(ownerId, workId, asOf);
	return context?.dashboard ?? null;
}

export async function getWorkReport(
	ownerId: string,
	workId: string,
	asOf?: Date,
) {
	const context = await resolveWorkReportContext(ownerId, workId, asOf);
	return context?.report ?? null;
}

export async function getWorkManagementReportContext(
	ownerId: string,
	workId: string,
	asOf?: Date,
) {
	return resolveWorkReportContext(ownerId, workId, asOf);
}

type PhysicalFinancialScheduleResponse = ReturnType<
	typeof projectPhysicalFinancialSchedule
> & {
	sourceMode: "LIVE";
	snapshot: ResolvedMetricSource["snapshot"];
};

const EMPTY_SCHEDULE: PhysicalFinancialScheduleResponse = {
	stages: [],
	totals: {
		months: [],
		plannedByMonth: [],
		measuredByMonth: [],
		actualByMonth: [],
		plannedAccumulated: [],
		measuredAccumulated: [],
		actualAccumulated: [],
	},
	sourceMode: "LIVE",
	snapshot: null,
};

export async function getPhysicalFinancialSchedule(
	ownerId: string,
	workId: string,
	period: SchedulePeriod = "monthly",
	asOf?: Date,
): Promise<PhysicalFinancialScheduleResponse> {
	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true },
	});
	if (!work) return EMPTY_SCHEDULE;

	const resolved = await resolveMetricSource({
		ownerId,
		workId,
		asOfDate: asOf,
	});

	return {
		...projectPhysicalFinancialSchedule(snapshotFromResolved(resolved), period),
		sourceMode: resolved.mode,
		snapshot: resolved.snapshot,
	};
}

export async function getContractReport(ownerId: string, contractId: string) {
	const aggregate = await getContractAggregate(ownerId, contractId);
	if (!aggregate) return null;

	const contract = aggregate.contract as {
		contractValue?: unknown;
		penaltyPercent?: unknown;
	};
	const contractValue = toFiniteNumber(contract.contractValue);
	const penaltyPercent = toFiniteNumber(contract.penaltyPercent, 20);

	return {
		contract: aggregate.contract,
		value: {
			contract: aggregate.totals.totalContracted,
			services: aggregate.totals.totalServicesValue,
			measured: aggregate.totals.totalMeasured,
			percentage: aggregate.totals.measuredPercentage,
			paid: aggregate.totals.totalPaid,
			balance: aggregate.totals.balance,
		},

		penalty: {
			percent: penaltyPercent,
			value: roundCurrency((contractValue * penaltyPercent) / 100),
		},
		measurementsCount: aggregate.measurementsCount,
		paymentsCount: aggregate.paymentsCount,
	};
}

export async function getCostCenterReport(ownerId: string, ccId: string) {
	const cc = await prisma.costCenter.findFirst({
		where: { id: ccId, ownerId },
		select: { id: true, name: true },
	});
	if (!cc) return null;

	const works = await prisma.constructionWork.findMany({
		where: { ownerId, costCenterId: ccId },
		select: {
			id: true,
			name: true,
			code: true,
			operationalStatus: true,
			activeImportId: true,
		},
	});

	if (works.length === 0) {
		return {
			costCenter: { id: cc.id, name: cc.name },
			works: [],
			summary: { totalWorks: 0, totalBudgeted: 0, totalSpent: 0, balance: 0 },
		};
	}

	const workIds = works.map((w) => w.id);

	const [budgetItems, activeItems] = await Promise.all([
		prisma.constructionBudgetItem.findMany({
			where: {
				OR: works.map((work) => ({
					ownerId,
					workId: work.id,
					importId: work.activeImportId ?? "__NO_ACTIVE_IMPORT__",
				})),
			},
			select: { workId: true, totalCost: true },
		}),
		prisma.constructionBudgetItem.findMany({
			where: {
				OR: works.map((work) => ({
					ownerId,
					workId: work.id,
					importId: work.activeImportId ?? "__NO_ACTIVE_IMPORT__",
				})),
			},
			select: { id: true, workId: true },
		}),
	]);
	const activeItemIds = activeItems.map((item) => item.id);
	const actualCosts = await prisma.constructionActualCost.findMany({
		where: {
			OR: [
				{ ownerId, workId: { in: workIds }, importId: null },
				...(activeItemIds.length > 0
					? [{ budgetItemId: { in: activeItemIds } }]
					: []),
			],
		},
		select: { workId: true, amount: true },
	});

	const budgetByWork = new Map<string, number>();
	for (const bi of budgetItems) {
		budgetByWork.set(
			bi.workId,
			(budgetByWork.get(bi.workId) ?? 0) + toFiniteNumber(bi.totalCost),
		);
	}

	const spentByWork = new Map<string, number>();
	for (const ac of actualCosts) {
		spentByWork.set(
			ac.workId,
			(spentByWork.get(ac.workId) ?? 0) + toFiniteNumber(ac.amount),
		);
	}

	const worksWithData = works.map((work) => {
		const budgeted = budgetByWork.get(work.id) ?? 0;
		const spent = spentByWork.get(work.id) ?? 0;
		return {
			id: work.id,
			name: work.name,
			code: work.code,
			status: work.operationalStatus,
			budgeted,
			spent,
		};
	});

	const totalBudgeted = worksWithData.reduce((sum, w) => sum + w.budgeted, 0);
	const totalSpent = worksWithData.reduce((sum, w) => sum + w.spent, 0);

	return {
		costCenter: { id: cc.id, name: cc.name },
		works: worksWithData,
		summary: {
			totalWorks: works.length,
			totalBudgeted: roundCurrency(totalBudgeted),
			totalSpent: roundCurrency(totalSpent),
			balance: roundCurrency(totalBudgeted - totalSpent),
		},
	};
}
