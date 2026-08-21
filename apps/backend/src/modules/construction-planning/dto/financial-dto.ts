import { toFiniteNumber, toNullableNumber } from "../../../lib/number-utils";

export type ParentlessBudgetDto = {
	id: string;
	parentId: string | null;
	index: string;
	type: string;
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number;
	plannedStart: unknown;
	plannedEnd: unknown;
	completionPercentage: number | null;
	sortOrder: number;
};

export function toBudgetItemDto(
	row: Record<string, unknown>,
): ParentlessBudgetDto {
	return {
		id: String(row.id),
		parentId: (row.parentId as string | null) ?? null,
		index: String(row.index),
		type: String(row.type),
		description: String(row.description),
		unit: (row.unit as string | null) ?? null,
		quantity: toNullableNumber(row.quantity),
		unitCost: toNullableNumber(row.unitCost),
		totalCost: toFiniteNumber(row.totalCost),
		plannedStart: row.plannedStart ?? null,
		plannedEnd: row.plannedEnd ?? null,
		completionPercentage: toNullableNumber(row.completionPercentage),
		sortOrder: toFiniteNumber(row.sortOrder),
	};
}

export type WorkMeasurementDto = {
	id: string;
	workId: string;
	measurementType: "OBRA";
	number: number;
	date: string;
	title: string;
	discountValue: number | null;
	retentionValue: number | null;
	totalMeasuredValue: number;
	notes: string | null;
	createdBy: string | null;
	createdAt: string;
	items: WorkMeasurementItemDto[];
};

export function toWorkMeasurementDto(
	row: Record<string, unknown>,
	items?: Array<Record<string, unknown>>,
): WorkMeasurementDto {
	const totalMeasuredValue = (items ?? []).reduce(
		(sum: number, item: Record<string, unknown>) =>
			sum + toFiniteNumber(item.accumulatedValue ?? item.measuredValue),
		0,
	);
	return {
		id: String(row.id),
		workId: String(row.workId),
		measurementType: "OBRA",
		number: toFiniteNumber(row.number, 0),
		date: String(row.date ?? ""),
		title: String(row.title ?? ""),
		discountValue: toNullableNumber(row.discountValue),
		retentionValue: toNullableNumber(row.retentionValue),
		totalMeasuredValue,
		notes: (row.notes as string | null) ?? null,
		createdBy: (row.createdBy as string | null) ?? null,
		createdAt: String(row.createdAt ?? ""),
		items: (items ?? []).map((item) => toWorkMeasurementItemDto(item)),
	};
}

export type WorkMeasurementItemDto = {
	id: string;
	measurementId: string;
	budgetItemId: string;
	measuredQuantity: number | null;
	measuredValue: number | null;
	measuredPercentage: number | null;
	accumulatedQuantity: number | null;
	accumulatedValue: number | null;
	accumulatedPercentage: number | null;
};

export function toWorkMeasurementItemDto(
	row: Record<string, unknown>,
): WorkMeasurementItemDto {
	return {
		id: String(row.id),
		measurementId: String(row.measurementId),
		budgetItemId: String(row.budgetItemId),
		measuredQuantity: toNullableNumber(row.measuredQuantity),
		measuredValue: toNullableNumber(row.measuredValue),
		measuredPercentage: toNullableNumber(row.measuredPercentage),
		accumulatedQuantity: toNullableNumber(row.accumulatedQuantity),
		accumulatedValue: toNullableNumber(row.accumulatedValue),
		accumulatedPercentage: toNullableNumber(row.accumulatedPercentage),
	};
}

export type ContractDto = {
	id: string;
	workId: string;
	code: string;
	supplierName: string;
	contractValue: number;
	serviceType: string | null;
	title: string | null;
	startDate: unknown;
	endDate: unknown;
	status: string;
	notes: string | null;
	createdAt: string;
};

export function toContractDto(row: Record<string, unknown>): ContractDto {
	return {
		id: String(row.id),
		workId: String(row.workId),
		code: String(row.code),
		supplierName: String(row.supplierName),
		contractValue: toFiniteNumber(row.contractValue),
		serviceType: (row.serviceType as string | null) ?? null,
		title: (row.title as string | null) ?? null,
		startDate: row.startDate ?? null,
		endDate: row.endDate ?? null,
		status: String(row.status),
		notes: (row.notes as string | null) ?? null,
		createdAt: String(row.createdAt ?? ""),
	};
}

export type ContractServiceDto = {
	id: string;
	contractId: string;
	parentId: string | null;
	description: string;
	type: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	totalCost: number | null;
	budgetItemId: string | null;
	sortOrder: number;
};

export function toContractServiceDto(
	row: Record<string, unknown>,
): ContractServiceDto {
	const quantity = toNullableNumber(row.quantity);
	const unitCost = toNullableNumber(row.unitCost);
	const explicitTotal = toNullableNumber(row.totalCost);
	return {
		id: String(row.id),
		contractId: String(row.contractId),
		parentId: (row.parentId as string | null) ?? null,
		description: String(row.description),
		type: String(row.type ?? "ITEM"),
		unit: (row.unit as string | null) ?? null,
		quantity,
		unitCost,
		totalCost:
			explicitTotal ??
			(quantity !== null && unitCost !== null ? quantity * unitCost : null),
		budgetItemId: (row.budgetItemId as string | null) ?? null,
		sortOrder: toFiniteNumber(row.sortOrder),
	};
}

export type ContractMeasurementDto = {
	id: string;
	contractId: string;
	measurementType: "CONTRATO";
	number: number;
	date: string;
	title: string | null;
	discountValue: number | null;
	retentionValue: number | null;
	notes: string | null;
	createdBy: string | null;
	createdAt: string;
};

export function toContractMeasurementDto(
	row: Record<string, unknown>,
): ContractMeasurementDto {
	return {
		id: String(row.id),
		contractId: String(row.contractId),
		measurementType: "CONTRATO",
		number: toFiniteNumber(row.number, 0),
		date: String(row.date ?? ""),
		title: (row.title as string | null) ?? null,
		discountValue: toNullableNumber(row.discountValue),
		retentionValue: toNullableNumber(row.retentionValue),
		notes: (row.notes as string | null) ?? null,
		createdBy: (row.createdBy as string | null) ?? null,
		createdAt: String(row.createdAt ?? ""),
	};
}

export type ContractPaymentDto = {
	id: string;
	contractId: string;
	date: string;
	value: number;
	paidValue: number;
	description: string | null;
	measurementId: string | null;
	retentionValue: number | null;
	discountValue: number | null;
	status: string;
};

export function toContractPaymentDto(
	row: Record<string, unknown>,
): ContractPaymentDto {
	return {
		id: String(row.id),
		contractId: String(row.contractId),
		date: String(row.date ?? ""),
		value: toFiniteNumber(row.value),
		paidValue: toFiniteNumber(row.paidValue),
		description: (row.description as string | null) ?? null,
		measurementId: (row.measurementId as string | null) ?? null,
		retentionValue: toNullableNumber(row.retentionValue),
		discountValue: toNullableNumber(row.discountValue),
		status: String(row.status),
	};
}
