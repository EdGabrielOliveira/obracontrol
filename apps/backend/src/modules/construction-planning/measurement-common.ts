import type { Prisma } from "@prisma/client";

export type MeasurementWarning = {
	code: string;
	severity: "warning";
	message: string;
	measurementDate?: string;
	periodStart?: string | null;
	periodEnd?: string | null;
};

export type MeasurementPeriod = {
	start?: Date | string | null;
	end?: Date | string | null;
};

function toDayUtc(value: Date): number {
	return Date.UTC(
		value.getUTCFullYear(),
		value.getUTCMonth(),
		value.getUTCDate(),
	);
}

export function buildMeasurementDateWarning(
	period: MeasurementPeriod,
	date: string,
): MeasurementWarning | null {
	const start = period.start ? new Date(period.start) : null;
	const end = period.end ? new Date(period.end) : null;
	if (!start || !end) return null;
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return null;
	const measurementDay = toDayUtc(parsed);
	if (measurementDay < toDayUtc(start) || measurementDay > toDayUtc(end)) {
		return {
			code: "MEASUREMENT_DATE_OUT_OF_PERIOD",
			severity: "warning",
			message: "Data da medição fora do período planejado",
			measurementDate: date,
			periodStart: period.start ? new Date(period.start).toISOString() : null,
			periodEnd: period.end ? new Date(period.end).toISOString() : null,
		};
	}
	return null;
}

type MeasurementModel = "workMeasurement" | "contractMeasurement";

type MeasurementFindFirstArgs = {
	where: Record<string, unknown>;
	orderBy: { number: "desc" };
	select: { number: true };
};

export async function nextMeasurementNumber(
	tx: Prisma.TransactionClient,
	model: MeasurementModel,
	parentCondition: Record<string, unknown>,
): Promise<number> {
	const last = await findLastMeasurement(tx, model, parentCondition);
	return (last?.number ?? 0) + 1;
}

async function findLastMeasurement(
	tx: Prisma.TransactionClient,
	model: MeasurementModel,
	parentCondition: Record<string, unknown>,
): Promise<{ number: number } | null> {
	const args: MeasurementFindFirstArgs = {
		where: parentCondition,
		orderBy: { number: "desc" },
		select: { number: true },
	};

	if (model === "workMeasurement") {
		return tx.workMeasurement.findFirst(args);
	}
	return tx.contractMeasurement.findFirst(args);
}
