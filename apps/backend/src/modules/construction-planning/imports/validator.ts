import { ConstructionError } from "../../../lib/errors";
import { normalizeText, parseNumber } from "../../../lib/text-utils";
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
import { SHEET_NAME_ALIASES } from "./sheet-aliases";
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

function getAliases(sheetName: string): string[] {
	return SHEET_NAME_ALIASES[sheetName] ?? [sheetName];
}

const COLUMN_ALIASES: Record<string, string[]> = {
	Índice: ["Índice", "Indice"],
	"Data da medição": ["Data da medição", "Data da medicao"],
	"Percentual medido acumulado": [
		"Percentual medido acumulado",
		"Percentual medido",
		"% medido",
	],
	"Quantidade medida acumulada": [
		"Quantidade medida acumulada",
		"Quantidade medida",
	],
};

function hasColumn(
	normalizedHeaders: Set<string>,
	columnHeader: string,
): boolean {
	const aliases = COLUMN_ALIASES[columnHeader] ?? [columnHeader];
	return aliases.some((alias) => normalizedHeaders.has(normalizeText(alias)));
}

function actualSheetName(
	workbook: ParsedWorkbook,
	expectedName: string,
): string | null {
	const aliases = getAliases(expectedName).map(normalizeText);
	return (
		workbook.sheetNames.find((name) => aliases.includes(normalizeText(name))) ??
		null
	);
}

const GUIDE_TITLE = normalizeText("Modelo de Importação - ObraControl");

/**
 * Real uploads carry the first row of every sheet in `sheetHeaders`. The
 * in-memory fixtures intentionally do not, so structural checks are limited
 * to uploaded workbooks and cannot weaken the domain validators.
 */
function validateWorkbookStructure(
	workbook: ParsedWorkbook,
	kind: WorkbookKind,
	errors: ImportValidationError[],
) {
	// `obra-completa` is also the compatibility parser for historical files
	// that intentionally contain only a subset of the unified sheets. The
	// dedicated import models, however, must match their downloaded template.
	if (!workbook.sheetHeaders || kind === "obra-completa") return;

	const definition = WORKBOOK_DEFINITIONS[kind];
	const expectedSheets = new Map(
		definition.sheets.map((sheet) => [normalizeText(sheet.name), sheet]),
	);
	const matchedSheets = new Set<string>();

	for (const sheet of definition.sheets) {
		const actualName = actualSheetName(workbook, sheet.name);
		if (!actualName) {
			errors.push({
				sheet: sheet.name,
				field: sheet.name,
				code: "MISSING_REQUIRED_SHEET",
				message: `Aba obrigatoria "${sheet.name}" nao encontrada no modelo ${kind}`,
			});
			continue;
		}
		matchedSheets.add(normalizeText(actualName));

		if (sheet.name === "Guia") {
			const title = workbook.sheetHeaders[actualName]?.[0];
			if (normalizeText(title ?? "") !== GUIDE_TITLE) {
				errors.push({
					sheet: actualName,
					field: "Guia",
					code: "INVALID_GUIDE_SHEET",
					message: 'A aba "Guia" nao pertence ao modelo oficial da plataforma',
				});
			}
		}

		if (!sheet.isDataSheet) continue;
		const headers = workbook.sheetHeaders[actualName] ?? [];
		if (headers.length === 0) continue;
		const actualHeaders = headers.map(normalizeText);
		const expectedHeaders = sheet.headers.map(normalizeText);
		const actualHeaderSet = new Set(actualHeaders);
		const expectedHeaderSet = new Set(expectedHeaders);

		for (const column of sheet.columns) {
			if (actualHeaderSet.has(normalizeText(column.header))) continue;
			if (column.required) continue;
			errors.push({
				sheet: actualName,
				field: column.header,
				code: "MISSING_MODEL_COLUMN",
				message: `Coluna do modelo "${column.header}" nao encontrada na aba "${actualName}"`,
			});
		}

		for (const header of headers) {
			if (expectedHeaderSet.has(normalizeText(header))) continue;
			errors.push({
				sheet: actualName,
				field: header,
				code: "UNEXPECTED_COLUMN",
				message: `Coluna "${header}" nao pertence ao modelo da aba "${actualName}"`,
			});
		}

		if (
			actualHeaders.length === expectedHeaders.length &&
			actualHeaders.some((header, index) => header !== expectedHeaders[index])
		) {
			errors.push({
				sheet: actualName,
				field: sheet.name,
				code: "COLUMN_ORDER_MISMATCH",
				message: `A ordem das colunas da aba "${actualName}" nao corresponde ao modelo oficial`,
			});
		}
	}

	for (const actualName of workbook.sheetNames) {
		if (matchedSheets.has(normalizeText(actualName))) continue;
		if (expectedSheets.has(normalizeText(actualName))) continue;
		errors.push({
			sheet: actualName,
			field: actualName,
			code: "UNEXPECTED_SHEET",
			message: `Aba "${actualName}" nao pertence ao modelo "${kind}"`,
		});
	}
}

function validateSheetHeaders(
	workbook: ParsedWorkbook,
	kind: WorkbookKind,
	errors: ImportValidationError[],
) {
	// ParsedWorkbook fixtures created directly in unit tests do not have header
	// metadata. Real uploads always come from parseWorkbookByKind, which fills it.
	if (!workbook.sheetHeaders) return;

	for (const sheet of WORKBOOK_DEFINITIONS[kind].sheets) {
		if (!sheet.isDataSheet) continue;
		const actualName = actualSheetName(workbook, sheet.name);
		if (!actualName) continue;

		const headers = workbook.sheetHeaders[actualName] ?? [];
		const normalizedHeaders = new Set(headers.map(normalizeText));
		if (headers.length === 0) {
			errors.push({
				sheet: sheet.name,
				field: sheet.name,
				code: "MISSING_HEADER_ROW",
				message: `Aba "${sheet.name}" nao possui uma linha de cabecalho valida`,
			});
			continue;
		}

		for (const column of sheet.columns) {
			if (!column.required || hasColumn(normalizedHeaders, column.header)) {
				continue;
			}
			errors.push({
				sheet: sheet.name,
				field: column.header,
				code: "MISSING_REQUIRED_COLUMN",
				message: `Coluna obrigatoria "${column.header}" nao encontrada na aba "${sheet.name}"`,
			});
		}
	}
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
	options: { measurementBudgetIndexes?: ReadonlySet<string> } = {},
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
	validateWorkbookStructure(workbook, kind, errors);
	validateSheetHeaders(workbook, kind, errors);

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
	const medicoesObraInFile =
		hasMedicoesObra &&
		hasRequiredSheet(workbook.sheetNames, getAliases("Medicoes Obra"));
	if (kind === "medicao-obra" && !medicoesObraInFile) {
		errors.push({
			sheet: "Medicoes Obra",
			field: "Medicoes Obra",
			code: "MISSING_REQUIRED_SHEET",
			message: 'Aba obrigatoria "Medicoes Obra" nao encontrada',
		});
	}
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

	const measurementBudgetIndexes: ReadonlySet<string> =
		options.measurementBudgetIndexes ??
		(budgetIndexes && budgetIndexes.size > 0
			? budgetIndexes
			: measurementIndexes);
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
	if (
		kind === "medicao-obra" &&
		medicoesObraInFile &&
		(workbook.measurementRows ?? []).length === 0
	) {
		errors.push({
			sheet: "Medicoes Obra",
			field: "Medicoes Obra",
			code: "NO_DATA",
			message:
				'A aba "Medicoes Obra" nao possui nenhuma linha de medicao para importar',
		});
	}
	const actualCosts = hasCustosRealizados
		? normalizeActualCosts(workbook, errors, costBudgetIndexes)
		: [];
	if (
		kind === "custos" &&
		hasCustosRealizados &&
		hasRequiredSheet(workbook.sheetNames, getAliases("Custos Realizados")) &&
		(workbook.actualCostRows ?? []).length === 0
	) {
		errors.push({
			sheet: "Custos Realizados",
			field: "Custos Realizados",
			code: "NO_DATA",
			message:
				'A aba "Custos Realizados" nao possui nenhuma linha de custo para importar',
		});
	}
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
