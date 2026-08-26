import * as XLSX from "xlsx";
import {
	hasValue,
	isOpenKeyword,
	isPaidKeyword,
	normalizeText,
	parseNumber,
} from "../../../lib/text-utils";

export { hasValue, normalizeText, parseNumber };

import type { ImportValidationError } from "../types";
import type {
	BudgetStatus,
	BudgetType,
	CostCategory,
	NormalizedActualCost,
	NormalizedBaselineSchedule,
	NormalizedBudgetItem,
	NormalizedContract,
	NormalizedContractMeasurement,
	NormalizedContractPayment,
	NormalizedContractService,
	NormalizedMeasurement,
	NormalizedScheduleRevision,
	NormalizedWork,
	PaymentStatus,
	ValidationResult,
} from "./normalized-types";

export function normalizePercentage(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return 0;

	let num: number;
	if (typeof value === "number") {
		num = value;
	} else if (typeof value === "string") {
		const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
		num = Number(cleaned);
	} else {
		return null;
	}

	if (Number.isNaN(num)) return null;

	if (num >= 0 && num <= 100) return num / 100;

	return null;
}

export function normalizeDate(value: unknown): Date | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "object" && value !== null) {
		const serialized = value as { value?: unknown; $type?: unknown };
		if (serialized.$type === "DateTime" && serialized.value !== undefined) {
			return normalizeDate(serialized.value);
		}
	}
	if (value instanceof Date) {
		return new Date(
			Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
		);
	}
	if (typeof value === "number") {
		const date = XLSX.SSF.parse_date_code(value);
		if (date) return new Date(Date.UTC(date.y, date.m - 1, date.d));
		return null;
	}
	if (typeof value === "string") {
		const serial = value.trim();
		if (/^\d{4,6}(?:\.\d+)?$/.test(serial)) {
			const date = XLSX.SSF.parse_date_code(Number(serial));
			if (date) return new Date(Date.UTC(date.y, date.m - 1, date.d));
		}
		const dateOnly = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
		if (dateOnly) {
			return new Date(
				Date.UTC(
					Number(dateOnly[1]),
					Number(dateOnly[2]) - 1,
					Number(dateOnly[3]),
				),
			);
		}
		const brazilianDate = serial.match(/^(\d{1,2})[/.](\d{1,2})[/.]?(\d{4})$/);
		const compactBrazilianDate = serial.match(/^(\d{2})(\d{2})(\d{4})$/);
		const parts = brazilianDate ?? compactBrazilianDate;
		if (parts) {
			const day = Number(parts[1]);
			const month = Number(parts[2]);
			const year = Number(parts[3]);
			const date = new Date(Date.UTC(year, month - 1, day));
			if (
				date.getUTCFullYear() === year &&
				date.getUTCMonth() === month - 1 &&
				date.getUTCDate() === day
			) {
				return date;
			}
			return null;
		}
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return new Date(
				Date.UTC(
					parsed.getUTCFullYear(),
					parsed.getUTCMonth(),
					parsed.getUTCDate(),
				),
			);
		}
	}
	return null;
}

export function normalizeStatus(value: string): string {
	return normalizeText(value);
}

export function isoDateString(date: Date): string;
export function isoDateString(date: Date | null): string | null;
export function isoDateString(date: Date | null): string | null {
	if (!date) return null;
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function missingField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	message: string,
) {
	errors.push({ row, sheet, field, code: "MISSING_REQUIRED_FIELD", message });
}

export function invalidField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	code: string,
	message: string,
) {
	errors.push({ row, sheet, field, code, message });
}

export function normalizeDateField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	value: unknown,
): Date | null {
	const date = normalizeDate(value);
	if (date === null && hasValue(value)) {
		invalidField(errors, sheet, row, field, "INVALID_DATE", "Data invalida");
	}
	return date;
}

export function normalizeRequiredDateField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	value: unknown,
	message: string,
): Date | null {
	if (!hasValue(value)) {
		missingField(errors, sheet, row, field, message);
		return null;
	}
	return normalizeDateField(errors, sheet, row, field, value);
}

export function normalizeNumberField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	value: unknown,
): number | null {
	if (
		typeof value === "string" &&
		["#N/A", "#DIV/0!", "#VALUE!", "#REF!"].includes(value.trim().toUpperCase())
	) {
		invalidField(
			errors,
			sheet,
			row,
			field,
			"SOURCE_FORMULA_ERROR",
			"Valor de erro da fonte não pode ser convertido em número",
		);
		return null;
	}

	const number = parseNumber(value);
	if (number === null && hasValue(value)) {
		invalidField(
			errors,
			sheet,
			row,
			field,
			"INVALID_NUMBER",
			"Numero invalido",
		);
	}
	return number;
}

export function normalizeOptionalPercentageField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	value: unknown,
): number | null {
	if (!hasValue(value)) return null;
	const percentage = normalizePercentage(value);
	if (percentage === null) {
		invalidField(
			errors,
			sheet,
			row,
			field,
			"INVALID_PERCENTAGE",
			"Percentual invalido",
		);
	}
	return percentage;
}

export function normalizeRequiredPercentageField(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	value: unknown,
	message: string,
): number | null {
	if (!hasValue(value)) {
		missingField(errors, sheet, row, field, message);
		return null;
	}
	const percentage = normalizePercentage(value);
	if (percentage === null) {
		invalidField(
			errors,
			sheet,
			row,
			field,
			"INVALID_PERCENTAGE",
			"Percentual invalido",
		);
	}
	return percentage;
}

export function validateDateRange(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	start: Date | null,
	end: Date | null,
	endField: string,
) {
	if (start && end && end < start) {
		invalidField(
			errors,
			sheet,
			row,
			endField,
			"INVALID_DATE_RANGE",
			"Fim anterior ao inicio",
		);
	}
}

export function parentIndexFor(
	index: string,
	knownIndexes: Set<string>,
): string | null {
	const parts = index.split(".");
	for (let i = parts.length - 1; i > 0; i--) {
		const candidate = parts.slice(0, i).join(".");
		if (candidate !== index && knownIndexes.has(candidate)) return candidate;
	}
	return null;
}

export function normalizeBudgetType(value: string): BudgetType | null {
	const normalized = normalizeText(value);
	if (normalized.includes("item")) return "ITEM";
	if (
		normalized.includes("etapa") ||
		normalized.includes("subetapa") ||
		normalized.includes("stage") ||
		normalized.includes("substage")
	) {
		return "STAGE";
	}
	return null;
}

export function normalizeBudgetStatus(
	value: string | null,
	completionPercentage: number,
): BudgetStatus {
	let computedStatus: BudgetStatus = "NOT_STARTED";
	if (completionPercentage >= 1) computedStatus = "DONE";
	else if (completionPercentage > 0) computedStatus = "IN_PROGRESS";

	if (value) {
		const normalized = normalizeStatus(value);
		if (
			normalized.includes("nao executar") ||
			normalized.includes("ignorar") ||
			normalized.includes("ignorado") ||
			normalized.includes("skip") ||
			normalized.includes("non execute")
		) {
			return "IGNORED";
		}
		if (
			normalized.includes("suspenso") ||
			normalized.includes("suspensa") ||
			normalized.includes("pausado")
		) {
			return "SUSPENDED";
		}
	}

	return computedStatus;
}

export function normalizeCategory(value: string | null): CostCategory | null {
	if (!value) return null;
	const normalized = normalizeText(value);
	if (
		normalized.includes("mao") ||
		normalized.includes("labor") ||
		normalized.includes("obra")
	)
		return "LABOR";
	if (normalized.includes("material")) return "MATERIAL";
	if (normalized.includes("equip")) return "EQUIPMENT";
	if (normalized.includes("outro") || normalized.includes("other"))
		return "OTHER";
	return null;
}

export function normalizeCostType(
	value: string | null | undefined,
	defaultValue?: "CURRENT" | "FUTURE",
): "CURRENT" | "FUTURE" | null {
	if (!value) return defaultValue ?? null;
	const normalized = normalizeText(value);
	if (normalized.includes("atual") || normalized.includes("current"))
		return "CURRENT";
	if (normalized.includes("futuro") || normalized.includes("future"))
		return "FUTURE";
	return defaultValue ?? null;
}

export function normalizePaymentStatusWithValidation(
	errors: ImportValidationError[],
	sheet: string,
	row: number | undefined,
	field: string,
	value: unknown,
): PaymentStatus {
	if (!hasValue(value)) return "OPEN";
	const normalized = normalizeText(String(value));
	if (isPaidKeyword(normalized)) return "PAID";
	if (isOpenKeyword(normalized)) return "OPEN";
	invalidField(
		errors,
		sheet,
		row,
		field,
		"INVALID_PAYMENT_STATUS",
		"Situacao do pagamento invalida",
	);
	return "OPEN";
}

export function hasRequiredSheet(
	sheetNames: string[] | undefined,
	aliases: readonly string[],
): boolean {
	if (!sheetNames) return false;
	const normalizedSheetNames = new Set(
		sheetNames.map((sheetName) => normalizeText(sheetName)),
	);
	return aliases.some((alias) =>
		normalizedSheetNames.has(normalizeText(alias)),
	);
}

export function emptyResult(
	errors: ImportValidationError[],
	warnings: ImportValidationError[],
	work: NormalizedWork,
	normalizedRows: NormalizedBudgetItem[] = [],
	normalizedItens: NormalizedBudgetItem[] = [],
	baselineSchedules: NormalizedBaselineSchedule[] = [],
	scheduleRevisions: NormalizedScheduleRevision[] = [],
	measurements: NormalizedMeasurement[] = [],
	actualCosts: NormalizedActualCost[] = [],
	contracts: NormalizedContract[] = [],
	contractServices: NormalizedContractService[] = [],
	contractMeasurements: NormalizedContractMeasurement[] = [],
	contractPayments: NormalizedContractPayment[] = [],
	processedSheets: string[] = [],
): ValidationResult {
	return {
		valid: errors.length === 0,
		errors,
		warnings,
		work,
		normalizedRows,
		normalizedItens,
		baselineSchedules,
		scheduleRevisions,
		measurements,
		actualCosts,
		contracts,
		contractServices,
		contractMeasurements,
		contractPayments,
		processedSheets,
	};
}
