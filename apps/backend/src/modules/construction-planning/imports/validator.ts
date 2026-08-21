import { ConstructionError } from "../../../lib/errors";
import { parseNumber } from "../../../lib/text-utils";
import {
	WORKBOOK_DEFINITIONS,
	type WorkbookKind,
} from "../templates/workbook-contracts";
import type { ImportValidationError, ParsedWorkbook } from "../types";
import { normalizeHierarchyIndex } from "./index-helpers";
import type { ValidationResult } from "./normalized-types";
import {
	emptyResult,
	hasRequiredSheet,
	missingField,
	normalizeDate,
	normalizeRequiredDateField,
	validateDateRange,
} from "./normalizers";
import { REQUIRED_SHEETS } from "./parser";
import { normalizeActualCosts } from "./validators/actual-cost.validator";
import { normalizeBaselineSchedules } from "./validators/baseline.validator";
import { validateBudgetRows } from "./validators/budget.validator";
import { normalizeContractMeasurementData } from "./validators/contract-measurement.validator";
import { normalizeItensRows } from "./validators/itens.validator";
import { normalizeMeasurements } from "./validators/measurement.validator";
import { normalizeScheduleRevisions } from "./validators/replanning.validator";

const CNPJ_WEIGHT_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHT_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function isValidCnpj(value: string): boolean {
	const cnpj = value.replace(/\D/g, "");
	if (cnpj.length !== 14 || new Set(cnpj).size === 1) return false;
	const checkDigit = (base: string, weights: number[]) => {
		const sum = weights.reduce(
			(total, weight, index) => total + Number(base[index]) * weight,
			0,
		);
		const remainder = sum % 11;
		return remainder < 2 ? 0 : 11 - remainder;
	};
	return (
		checkDigit(cnpj.slice(0, 12), CNPJ_WEIGHT_1) === Number(cnpj[12]) &&
		checkDigit(cnpj.slice(0, 13), CNPJ_WEIGHT_2) === Number(cnpj[13])
	);
}

function warnNegativeActualCosts(
	actualCosts: ValidationResult["actualCosts"],
	warnings: ImportValidationError[],
) {
	for (const row of actualCosts) {
		if (row.amount >= 0) continue;
		warnings.push({
			sheet: "Custos Realizados",
			row: row.rowNumber,
			field: "Valor realizado",
			code: "NEGATIVE_AMOUNT_REVIEW",
			message:
				"Valor realizado negativo preservado para revisão da convenção de sinal",
		});
	}
}

function validateUnifiedWorkbook(workbook: ParsedWorkbook): ValidationResult {
	const errors: ImportValidationError[] = [];
	const warnings: ImportValidationError[] = [];

	for (const required of REQUIRED_SHEETS) {
		if (!hasRequiredSheet(workbook.sheetNames, required.aliases)) {
			errors.push({
				sheet: required.displayName,
				field: required.displayName,
				code: "MISSING_REQUIRED_SHEET",
				message: `Aba obrigatoria "${required.displayName}" nao encontrada`,
			});
		}
	}

	const work = {
		code: workbook.work?.code ?? workbook.header?.workCode ?? "",
		name: workbook.work?.name ?? workbook.header?.workName ?? "",
		clientName: workbook.work?.clientName ?? null,
		baseDate: normalizeRequiredDateField(
			errors,
			"Obra",
			undefined,
			"Data-base",
			workbook.work?.baseDate,
			"Data-base obrigatoria",
		),
		plannedStart: normalizeRequiredDateField(
			errors,
			"Obra",
			undefined,
			"Inicio planejado original",
			workbook.work?.plannedStart,
			"Inicio planejado original obrigatorio",
		),
		plannedEnd: normalizeRequiredDateField(
			errors,
			"Obra",
			undefined,
			"Fim planejado original",
			workbook.work?.plannedEnd,
			"Fim planejado original obrigatorio",
		),
		areaM2: workbook.work?.areaM2 ?? null,
		operationalStatus: workbook.work?.operationalStatus ?? null,
		responsibleName: workbook.work?.responsibleName ?? null,
		fileName: workbook.fileName,
		sheetName: workbook.sheetName,
		importedSections: workbook.sheetNames,
	};

	if (!work.name)
		missingField(
			errors,
			"Obra",
			undefined,
			"Nome da obra",
			"Nome da obra obrigatorio",
		);
	validateDateRange(
		errors,
		"Obra",
		undefined,
		work.plannedStart,
		work.plannedEnd,
		"Fim planejado original",
	);

	const normalizedRows = validateBudgetRows(workbook, errors);
	const budgetIndexes = new Set(normalizedRows.map((row) => row.index));
	const normalizedItens = normalizeItensRows(workbook, errors);
	const baselineIndexes = new Set<string>(
		(workbook.baselineRows ?? [])
			.map((r) => (r.index ? normalizeHierarchyIndex(r.index) : null))
			.filter((i): i is string => i !== null),
	);
	const baselineBudgetIndexes =
		budgetIndexes.size > 0 ? budgetIndexes : baselineIndexes;

	const baselineSchedules = normalizeBaselineSchedules(
		workbook,
		errors,
		baselineBudgetIndexes,
	);
	const scheduleRevisions = normalizeScheduleRevisions(
		workbook,
		errors,
		baselineIndexes,
	);
	const measurements = normalizeMeasurements(workbook, errors, budgetIndexes);
	const actualCosts = normalizeActualCosts(workbook, errors, budgetIndexes);
	warnNegativeActualCosts(actualCosts, warnings);

	return emptyResult(
		errors,
		warnings,
		work,
		normalizedRows,
		normalizedItens,
		baselineSchedules,
		scheduleRevisions,
		measurements,
		actualCosts,
	);
}

const SHEET_NAME_ALIASES: Record<string, string[]> = {
	"Medicoes Obra": ["Medicoes Obra", "Medicoes", "Medições"],
	Orcamento: ["Orcamento", "Orçamento"],
	"Cronograma Original": ["Cronograma Original", "Cronograma"],
	"Itens do Orcamento": ["Itens do Orcamento", "Itens do Orçamento"],
};

function getAliases(sheetName: string): string[] {
	return SHEET_NAME_ALIASES[sheetName] ?? [sheetName];
}

function validateQuotationRows(
	rows: ParsedWorkbook["quotationRows"],
	errors: ImportValidationError[],
) {
	if (rows.length === 0) {
		errors.push({
			sheet: "Mapa de Cotacao",
			field: "Mapa de Cotacao",
			code: "NO_DATA",
			message: "Nenhuma proposta encontrada no mapa de cotacao",
		});
		return;
	}

	const supplierDocuments = new Set<string>();
	for (const row of rows) {
		if (!row.supplierName?.trim()) {
			errors.push({
				sheet: "Mapa de Cotacao",
				row: row.rowNumber,
				field: "Razão Social",
				code: "REQUIRED_FIELD",
				message: "Razão social do fornecedor obrigatoria",
			});
		}

		const supplierDocument = row.supplierDocument?.replace(/\D/g, "") ?? "";
		if (!supplierDocument) {
			errors.push({
				sheet: "Mapa de Cotacao",
				row: row.rowNumber,
				field: "CNPJ",
				code: "SUPPLIER_DOCUMENT_REQUIRED",
				message: "CNPJ do fornecedor obrigatorio",
			});
		} else if (supplierDocument.length !== 14) {
			errors.push({
				sheet: "Mapa de Cotacao",
				row: row.rowNumber,
				field: "CNPJ",
				code: "INVALID_CNPJ",
				message: "CNPJ deve conter 14 digitos",
			});
		} else if (!isValidCnpj(supplierDocument)) {
			errors.push({
				sheet: "Mapa de Cotacao",
				row: row.rowNumber,
				field: "CNPJ",
				code: "INVALID_CNPJ",
				message: "CNPJ inválido: confira os dígitos verificadores",
			});
		} else if (supplierDocuments.has(supplierDocument)) {
			errors.push({
				sheet: "Mapa de Cotacao",
				row: row.rowNumber,
				field: "CNPJ",
				code: "DUPLICATE_SUPPLIER_DOCUMENT",
				message: "CNPJ do fornecedor duplicado",
			});
		} else {
			supplierDocuments.add(supplierDocument);
		}

		const value = parseNumber(row.value);
		if (value == null || value <= 0) {
			errors.push({
				sheet: "Mapa de Cotacao",
				row: row.rowNumber,
				field: "Valor do Serviço",
				code: "INVALID_AMOUNT",
				message: "Valor do serviço deve ser maior que zero",
			});
		}

		if (row.executionTermDays != null && row.executionTermDays !== "") {
			const term = parseNumber(row.executionTermDays);
			if (term == null || term <= 0 || !Number.isInteger(term)) {
				errors.push({
					sheet: "Mapa de Cotacao",
					row: row.rowNumber,
					field: "Prazo de Execução",
					code: "INVALID_EXECUTION_TERM",
					message: "Prazo de execução deve ser um inteiro positivo em dias",
				});
			}
		}

		if (row.serviceStartDate != null && row.serviceStartDate !== "") {
			if (normalizeDate(row.serviceStartDate) == null) {
				errors.push({
					sheet: "Mapa de Cotacao",
					row: row.rowNumber,
					field: "Data de Início",
					code: "INVALID_DATE",
					message: "Data de início inválida",
				});
			}
		}
	}
}

export function validateWorkbookByKind(
	workbook: ParsedWorkbook,
	kind: WorkbookKind,
): ValidationResult {
	const definition = WORKBOOK_DEFINITIONS[kind];
	if (!definition) {
		throw new ConstructionError(
			"INVALID_KIND",
			"Tipo de workbook invalido",
			400,
		);
	}

	const errors: ImportValidationError[] = [];
	const warnings: ImportValidationError[] = [];

	const dataSheetNames = definition.sheets
		.filter((s) => s.isDataSheet)
		.map((s) => s.name);

	const contractDataSheets = new Set(
		WORKBOOK_DEFINITIONS["medicao-contrato"].sheets
			.filter((s) => s.isDataSheet)
			.map((s) => s.name),
	);
	const processedSheets = dataSheetNames.filter(
		(name) =>
			(kind === "medicao-contrato" || !contractDataSheets.has(name)) &&
			hasRequiredSheet(workbook.sheetNames, getAliases(name)),
	);
	const obraSheetInFile =
		dataSheetNames.includes("Obra") &&
		hasRequiredSheet(workbook.sheetNames, getAliases("Obra"));

	const work = {
		code: workbook.work?.code ?? workbook.header?.workCode ?? "",
		name: workbook.work?.name ?? workbook.header?.workName ?? "",
		clientName: workbook.work?.clientName ?? null,
		baseDate: obraSheetInFile
			? normalizeRequiredDateField(
					errors,
					"Obra",
					undefined,
					"Data-base",
					workbook.work?.baseDate,
					"Data-base obrigatoria",
				)
			: normalizeDate(workbook.work?.baseDate),
		plannedStart: obraSheetInFile
			? normalizeRequiredDateField(
					errors,
					"Obra",
					undefined,
					"Inicio planejado original",
					workbook.work?.plannedStart,
					"Inicio planejado original obrigatorio",
				)
			: normalizeDate(workbook.work?.plannedStart),
		plannedEnd: obraSheetInFile
			? normalizeRequiredDateField(
					errors,
					"Obra",
					undefined,
					"Fim planejado original",
					workbook.work?.plannedEnd,
					"Fim planejado original obrigatorio",
				)
			: normalizeDate(workbook.work?.plannedEnd),
		areaM2: workbook.work?.areaM2 ?? null,
		operationalStatus: workbook.work?.operationalStatus ?? null,
		responsibleName: workbook.work?.responsibleName ?? null,
		fileName: workbook.fileName,
		sheetName: workbook.sheetName,
		importedSections: workbook.sheetNames,
	};

	if (obraSheetInFile) {
		if (!work.name)
			missingField(
				errors,
				"Obra",
				undefined,
				"Nome da obra",
				"Nome da obra obrigatorio",
			);
		validateDateRange(
			errors,
			"Obra",
			undefined,
			work.plannedStart,
			work.plannedEnd,
			"Fim planejado original",
		);
	}

	const hasBudgetData = dataSheetNames.includes("Orcamento");
	const budgetSheetInFile =
		hasBudgetData &&
		hasRequiredSheet(workbook.sheetNames, getAliases("Orcamento"));
	const normalizedRows = budgetSheetInFile
		? validateBudgetRows(workbook, errors)
		: [];
	const budgetIndexes: Set<string> | null = budgetSheetInFile
		? new Set(normalizedRows.map((row) => row.index))
		: null;

	const hasItensData = dataSheetNames.includes("Itens do Orcamento");
	const itensSheetInFile =
		hasItensData &&
		hasRequiredSheet(workbook.sheetNames, getAliases("Itens do Orcamento"));
	const normalizedItens = itensSheetInFile
		? normalizeItensRows(workbook, errors)
		: [];

	const hasCronogramaOriginal = dataSheetNames.includes("Cronograma Original");
	const hasReplanejamento = dataSheetNames.includes("Replanejamento");
	const hasMedicoesObra = dataSheetNames.includes("Medicoes Obra");
	const hasCustosRealizados = dataSheetNames.includes("Custos Realizados");

	const measurementIndexes = new Set<string>(
		(workbook.measurementRows ?? [])
			.map((r) => (r.index ? normalizeHierarchyIndex(r.index) : null))
			.filter((i): i is string => i !== null),
	);
	const costIndexes = new Set<string>(
		(workbook.actualCostRows ?? [])
			.map((r) =>
				r.budgetIndex ? normalizeHierarchyIndex(r.budgetIndex) : null,
			)
			.filter((i): i is string => i !== null),
	);

	const measurementBudgetIndexes: Set<string> =
		budgetIndexes && budgetIndexes.size > 0
			? budgetIndexes
			: measurementIndexes;
	const costBudgetIndexes: Set<string> =
		budgetIndexes && budgetIndexes.size > 0 ? budgetIndexes : costIndexes;

	const baselineSchedules = hasCronogramaOriginal
		? normalizeBaselineSchedules(workbook, errors, null)
		: [];
	const scheduleRevisions = hasReplanejamento
		? normalizeScheduleRevisions(workbook, errors, null)
		: [];
	const measurements = hasMedicoesObra
		? normalizeMeasurements(workbook, errors, measurementBudgetIndexes)
		: [];
	const actualCosts = hasCustosRealizados
		? normalizeActualCosts(workbook, errors, costBudgetIndexes)
		: [];
	warnNegativeActualCosts(actualCosts, warnings);

	const hasContractSheets = kind === "medicao-contrato";
	const contractData = hasContractSheets
		? normalizeContractMeasurementData(workbook, errors, warnings)
		: {
				contracts: [],
				contractServices: [],
				contractMeasurements: [],
				contractPayments: [],
			};
	if (kind === "cotacao" || kind === "quotation-map") {
		validateQuotationRows(workbook.quotationRows, errors);
	}

	return emptyResult(
		errors,
		warnings,
		work,
		normalizedRows,
		normalizedItens,
		baselineSchedules,
		scheduleRevisions,
		measurements,
		actualCosts,
		contractData.contracts,
		contractData.contractServices,
		contractData.contractMeasurements,
		contractData.contractPayments,
		processedSheets,
	);
}

export const validateWorkbook = validateUnifiedWorkbook;
