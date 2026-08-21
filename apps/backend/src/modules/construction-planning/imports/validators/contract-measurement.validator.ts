import {
	hasValue,
	isOpenKeyword,
	isPaidKeyword,
	normalizeText,
	parseNumber,
} from "../../../../lib/text-utils";
import type { ImportValidationError, ParsedWorkbook } from "../../types";
import type {
	ContractPaymentStatus,
	ContractServiceType,
	ContractStatus,
	NormalizedContract,
	NormalizedContractMeasurement,
	NormalizedContractPayment,
	NormalizedContractService,
} from "../normalized-types";
import {
	invalidField,
	missingField,
	normalizeDateField,
	normalizeRequiredDateField,
} from "../normalizers";

const CONTRACT_SERVICE_TYPES: ContractServiceType[] = [
	"ETAPA",
	"SUBETAPA",
	"COMPOSICAO",
	"INSUMO",
	"ITEM",
];

function parseStrictNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	if (!hasValue(value) || !/\d/.test(value)) return null;
	return parseNumber(value);
}

export function normalizeServiceType(
	value: string | null,
): ContractServiceType {
	if (!value) return "ITEM";
	const normalized = normalizeText(value);
	return (
		CONTRACT_SERVICE_TYPES.find((type) => normalizeText(type) === normalized) ??
		"ITEM"
	);
}

export function normalizeContractStatus(value: string | null): ContractStatus {
	if (!value) return "RASCUNHO";
	const normalized = normalizeText(value);
	if (
		normalized.includes("andamento") ||
		normalized.includes("ativo") ||
		normalized.includes("em execucao")
	) {
		return "EM_ANDAMENTO";
	}
	if (normalized.includes("iniciar")) return "A_INICIAR";
	if (
		normalized.includes("paralisado") ||
		normalized.includes("parado") ||
		normalized.includes("suspenso")
	) {
		return "PARALISADO";
	}
	if (
		normalized.includes("finalizado") ||
		normalized.includes("concluido") ||
		normalized.includes("encerrado")
	) {
		return "FINALIZADO";
	}
	return "RASCUNHO";
}

function normalizeRequiredNumber(
	errors: ImportValidationError[],
	sheet: string,
	row: number,
	field: string,
	value: unknown,
): number | null {
	const number = parseStrictNumber(value);
	if (number === null) {
		if (hasValue(value)) {
			invalidField(
				errors,
				sheet,
				row,
				field,
				"INVALID_NUMBER",
				`Numero invalido na linha ${row}`,
			);
		} else {
			missingField(errors, sheet, row, field, `${field} obrigatorio`);
		}
	}
	return number;
}

function normalizeOptionalNumber(
	errors: ImportValidationError[],
	sheet: string,
	row: number,
	field: string,
	value: unknown,
): number | null {
	if (!hasValue(value)) return null;
	const number = parseStrictNumber(value);
	if (number === null) {
		invalidField(
			errors,
			sheet,
			row,
			field,
			"INVALID_NUMBER",
			`Numero invalido na linha ${row}`,
		);
	}
	return number;
}

function normalizeContractPaymentStatus(
	errors: ImportValidationError[],
	sheet: string,
	row: number,
	field: string,
	value: unknown,
): ContractPaymentStatus {
	if (!hasValue(value)) return "EM_ABERTO";
	const normalized = normalizeText(String(value));
	if (isPaidKeyword(normalized)) return "PAGO";
	if (isOpenKeyword(normalized)) return "EM_ABERTO";
	invalidField(
		errors,
		sheet,
		row,
		field,
		"INVALID_PAYMENT_STATUS",
		`Situacao do pagamento invalida na linha ${row}`,
	);
	return "EM_ABERTO";
}

export function normalizeContractRows(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	warnings: ImportValidationError[],
): NormalizedContract[] {
	const seenCodes = new Set<string>();

	return (workbook.contractRows ?? []).flatMap((row) => {
		const code = row.code?.trim() ?? "";
		if (!code) {
			missingField(
				errors,
				"Contrato",
				row.rowNumber,
				"Codigo",
				"Codigo obrigatorio",
			);
		}
		if (!hasValue(row.supplierName)) {
			missingField(
				errors,
				"Contrato",
				row.rowNumber,
				"Fornecedor",
				"Fornecedor obrigatorio",
			);
		}
		if (!hasValue(row.contractValue)) {
			missingField(
				errors,
				"Contrato",
				row.rowNumber,
				"Valor do Contrato",
				"Valor do contrato obrigatorio",
			);
		}
		if (!code || !hasValue(row.supplierName) || !hasValue(row.contractValue)) {
			return [];
		}

		if (seenCodes.has(code)) {
			warnings.push({
				sheet: "Contrato",
				row: row.rowNumber,
				field: "Codigo",
				code: "DUPLICATE_CONTRACT",
				message: `Contrato duplicado na linha ${row.rowNumber} ignorado`,
			});
			return [];
		}
		seenCodes.add(code);

		const contractValue = normalizeRequiredNumber(
			errors,
			"Contrato",
			row.rowNumber,
			"Valor do Contrato",
			row.contractValue,
		);
		if (contractValue === null) return [];

		return [
			{
				rowNumber: row.rowNumber,
				code,
				supplierName: row.supplierName?.trim() ?? "",
				contractValue,
				serviceType: row.serviceType,
				title: row.title,
				startDate: normalizeDateField(
					errors,
					"Contrato",
					row.rowNumber,
					"Inicio",
					row.startDate,
				),
				endDate: normalizeDateField(
					errors,
					"Contrato",
					row.rowNumber,
					"Fim",
					row.endDate,
				),
				status: normalizeContractStatus(row.status),
				notes: row.notes,
			},
		];
	});
}

export function normalizeContractServiceRows(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	warnings: ImportValidationError[],
): NormalizedContractService[] {
	const seenIndexes = new Set<string>();

	return (workbook.serviceRows ?? []).flatMap((row) => {
		if (!row.index?.trim()) {
			missingField(
				errors,
				"Servicos",
				row.rowNumber,
				"Indice",
				"Indice do item de orcamento obrigatorio",
			);
			return [];
		}
		const index = row.index.trim();
		const description = row.description?.trim() ?? "";
		if (seenIndexes.has(index)) {
			warnings.push({
				sheet: "Servicos",
				row: row.rowNumber,
				field: "Indice",
				code: "DUPLICATE_SERVICE",
				message: `Servico duplicado na linha ${row.rowNumber} ignorado`,
			});
			return [];
		}
		seenIndexes.add(index);
		const quantity = normalizeOptionalNumber(
			errors,
			"Servicos",
			row.rowNumber,
			"Quantidade",
			row.quantity,
		);
		const unitCost = normalizeOptionalNumber(
			errors,
			"Servicos",
			row.rowNumber,
			"Custo Unitario",
			row.unitCost,
		);

		return [
			{
				rowNumber: row.rowNumber,
				index,
				type: normalizeServiceType(row.type),
				description,
				unit: row.unit,
				quantity,
				unitCost,
				totalCost: normalizeOptionalNumber(
					errors,
					"Servicos",
					row.rowNumber,
					"Custo Total",
					row.totalCost,
				),
			},
		];
	});
}

export function normalizeContractMeasurementRows(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
): NormalizedContractMeasurement[] {
	return (workbook.contractMeasurementRows ?? []).flatMap((row) => {
		const date = normalizeRequiredDateField(
			errors,
			"Medicoes Contrato",
			row.rowNumber,
			"Data",
			row.date,
			"Data obrigatoria",
		);
		if (date === null) return [];

		return [
			{
				rowNumber: row.rowNumber,
				number: row.number,
				date,
				title: row.title,
				discountValue: normalizeOptionalNumber(
					errors,
					"Medicoes Contrato",
					row.rowNumber,
					"Desconto",
					row.discountValue,
				),
				retentionValue: normalizeOptionalNumber(
					errors,
					"Medicoes Contrato",
					row.rowNumber,
					"Retencao",
					row.retentionValue,
				),
				taxValue: normalizeOptionalNumber(
					errors,
					"Medicoes Contrato",
					row.rowNumber,
					"Valor de impostos",
					row.taxValue,
				),
				notes: row.notes,
			},
		];
	});
}

export function normalizeContractPaymentRows(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
): NormalizedContractPayment[] {
	return (workbook.paymentRows ?? []).flatMap((row) => {
		const date = normalizeRequiredDateField(
			errors,
			"Pagamentos",
			row.rowNumber,
			"Data",
			row.date,
			"Data obrigatoria",
		);
		const value = normalizeRequiredNumber(
			errors,
			"Pagamentos",
			row.rowNumber,
			"Valor",
			row.value,
		);
		const paidValue = normalizeRequiredNumber(
			errors,
			"Pagamentos",
			row.rowNumber,
			"Valor Pago",
			row.paidValue,
		);
		if (date === null || value === null || paidValue === null) return [];

		return [
			{
				rowNumber: row.rowNumber,
				date,
				value,
				paidValue,
				description: row.description,
				retentionValue: normalizeOptionalNumber(
					errors,
					"Pagamentos",
					row.rowNumber,
					"Retencao",
					row.retentionValue,
				),
				discountValue: normalizeOptionalNumber(
					errors,
					"Pagamentos",
					row.rowNumber,
					"Desconto",
					row.discountValue,
				),
				status: normalizeContractPaymentStatus(
					errors,
					"Pagamentos",
					row.rowNumber,
					"Situacao do pagamento",
					row.status,
				),
			},
		];
	});
}

export function normalizeContractMeasurementData(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	warnings: ImportValidationError[],
) {
	return {
		contracts: normalizeContractRows(workbook, errors, warnings),
		contractServices: normalizeContractServiceRows(workbook, errors, warnings),
		contractMeasurements: normalizeContractMeasurementRows(workbook, errors),
		contractPayments: normalizeContractPaymentRows(workbook, errors),
	};
}
