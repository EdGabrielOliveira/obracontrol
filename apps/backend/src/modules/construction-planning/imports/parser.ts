import * as XLSX from "xlsx";
import { ConstructionError } from "../../../lib/errors";
import { normalizeText, parseNumber } from "../../../lib/text-utils";
import {
	WORKBOOK_DEFINITIONS,
	type WorkbookKind,
} from "../templates/workbook-contracts";
import type {
	ParsedActualCostRow,
	ParsedBaselineRow,
	ParsedBudgetRow,
	ParsedContractMeasurementRow,
	ParsedContractRow,
	ParsedMeasurementRow,
	ParsedPaymentRow,
	ParsedQuotationRow,
	ParsedReplanningRow,
	ParsedServiceRow,
	ParsedWorkbookUnified,
	ParsedWorkSheet,
} from "../types";

type HeaderMap = Map<string, number>;

export const REQUIRED_SHEETS = [
	{ displayName: "Obra", aliases: ["Obra"] },
	{ displayName: "Orcamento", aliases: ["Orcamento", "Orçamento"] },
	{
		displayName: "Cronograma Original",
		aliases: ["Cronograma Original", "Cronograma"],
	},
	{ displayName: "Replanejamento", aliases: ["Replanejamento"] },
	{
		displayName: "Medicoes",
		aliases: ["Medições de Obra", "Medicoes Obra", "Medicoes", "Medições"],
	},
	{ displayName: "Custos Realizados", aliases: ["Custos Realizados"] },
] as const;

function parseDate(value: unknown): Date | null {
	if (value === null || value === undefined || value === "") return null;

	if (value instanceof Date) return value;

	if (typeof value === "number") {
		const date = XLSX.SSF.parse_date_code(value);
		if (date) return new Date(date.y, date.m - 1, date.d);
		return null;
	}

	if (typeof value === "string") {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}

	return null;
}

function textValue(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	return String(value).trim();
}

function dateOnly(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
	}

	const parsed = parseDate(value);
	if (!parsed) return null;

	const year = parsed.getFullYear();
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const day = String(parsed.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
	return XLSX.utils.sheet_to_json(sheet, {
		header: 1,
		raw: true,
		defval: null,
		blankrows: false,
	});
}

function headerMap(headerRow: unknown[] | undefined): HeaderMap {
	const headers: HeaderMap = new Map();
	for (const [index, value] of (headerRow ?? []).entries()) {
		const header = textValue(value);
		if (header) headers.set(normalizeText(header), index);
	}
	return headers;
}

function cell(
	row: unknown[],
	headers: HeaderMap,
	aliases: readonly string[],
): unknown {
	for (const alias of aliases) {
		const index = headers.get(normalizeText(alias));
		if (index !== undefined) return row[index] ?? null;
	}
	return null;
}

function hasAnyValue(values: unknown[]): boolean {
	return values.some(
		(value) => value !== null && value !== undefined && value !== "",
	);
}

function extractSheetHeaders(
	workbook: XLSX.WorkBook,
): Record<string, string[]> {
	return Object.fromEntries(
		workbook.SheetNames.map((sheetName) => {
			const rows = sheetRows(workbook.Sheets[sheetName]);
			const headers = (rows[0] ?? [])
				.map(textValue)
				.filter((header): header is string => header !== null);
			return [sheetName, headers];
		}),
	);
}

function numericCell(value: unknown): number | null {
	return parseNumber(value);
}

function parseWorkSheet(sheet: XLSX.WorkSheet): ParsedWorkSheet {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);
	const campoIndex = headers.get(normalizeText("Campo"));
	const valorIndex = headers.get(normalizeText("Valor"));
	const hasCampoValorHeaders =
		campoIndex !== undefined && valorIndex !== undefined;
	const values = new Map<string, unknown>();

	for (const row of rows.slice(1)) {
		const key = textValue(row[hasCampoValorHeaders ? campoIndex : 0]);
		if (key)
			values.set(
				normalizeText(key),
				row[hasCampoValorHeaders ? valorIndex : 1] ?? null,
			);
	}

	return {
		code: textValue(values.get("codigo da obra")) ?? "",
		name: textValue(values.get("nome da obra")) ?? "",
		clientName: textValue(values.get("cliente empreendimento")),
		baseDate: dateOnly(values.get("data base")),
		plannedStart: dateOnly(values.get("inicio planejado original")),
		plannedEnd: dateOnly(values.get("fim planejado original")),
		areaM2: numericCell(values.get("area m2") ?? values.get("area da obra")),
		operationalStatus: textValue(
			values.get("situacao operacional") ?? values.get("status operacional"),
		),
		responsibleName: textValue(
			values.get("responsavel") ?? values.get("responsavel pela obra"),
		),
	};
}

function parseBudgetRows(sheet: XLSX.WorkSheet): ParsedBudgetRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			index: textValue(cell(row, headers, ["Indice"])),
			type: textValue(cell(row, headers, ["Tipo"])),
			description: textValue(cell(row, headers, ["Descricao"])),
			unit: textValue(cell(row, headers, ["Unidade", "Unid"])),
			quantity: cell(row, headers, ["Quantidade", "QTDE"]),
			laborUnitCost: cell(row, headers, ["Mao de obra unitaria"]),
			materialUnitCost: cell(row, headers, ["Material unitario"]),
			equipmentUnitCost: cell(row, headers, ["Equipamento unitario"]),
			otherUnitCost: cell(row, headers, ["Outros unitario"]),
			unitCost: cell(row, headers, ["Custo Unitario", "Custo Unitário"]),
			totalCost: cell(row, headers, ["Valor Total", "Valor total"]),
			providedStatus: textValue(cell(row, headers, ["Situacao"])),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parseBaselineRows(sheet: XLSX.WorkSheet): ParsedBaselineRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			index: textValue(cell(row, headers, ["Indice"])),
			plannedStart: cell(row, headers, ["Inicio previsto"]),
			plannedEnd: cell(row, headers, ["Fim previsto"]),
			plannedWeight: cell(row, headers, ["Peso planejado opcional"]),
		};

		// Contextual schedule templates list every budget index. An index-only
		// row is a reference and must not become an invalid schedule record.
		if (
			!hasAnyValue([
				values.plannedStart,
				values.plannedEnd,
				values.plannedWeight,
			])
		)
			return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parseReplanningRows(sheet: XLSX.WorkSheet): ParsedReplanningRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			index: textValue(cell(row, headers, ["Indice"])),
			version: textValue(cell(row, headers, ["Versao do replanejamento"])),
			replannedStart: cell(row, headers, ["Inicio replanejado"]),
			replannedEnd: cell(row, headers, ["Fim replanejado"]),
			revisionDate: cell(row, headers, ["Data da revisao"]),
			reason: textValue(cell(row, headers, ["Motivo"])),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parseMeasurementRows(sheet: XLSX.WorkSheet): ParsedMeasurementRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			index: textValue(cell(row, headers, ["Indice"])),
			itemName: textValue(cell(row, headers, ["Nome do item", "Descricao"])),
			measurementDate: cell(row, headers, ["Data da medicao"]),
			measuredPercentageAccumulated: cell(row, headers, [
				"Percentual medido acumulado",
				"Percentual medido",
				"% medido",
			]),
			measuredQuantityAccumulated: cell(row, headers, [
				"Quantidade medida acumulada",
			]),
			notes: textValue(cell(row, headers, ["Observacao"])),
		};

		if (
			!hasAnyValue([
				values.measurementDate,
				values.measuredPercentageAccumulated,
				values.measuredQuantityAccumulated,
				values.notes,
			])
		)
			return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parseActualCostRows(sheet: XLSX.WorkSheet): ParsedActualCostRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			costDate: cell(row, headers, ["Data do lancamento"]),
			budgetIndex: textValue(cell(row, headers, ["Indice apropriado"])),
			category: textValue(cell(row, headers, ["Categoria"])),
			description: textValue(cell(row, headers, ["Descricao"])),
			amount: cell(row, headers, ["Valor realizado"]),
			costType: textValue(cell(row, headers, ["Tipo"])),
			sourceDocument: textValue(
				cell(row, headers, ["Documento origem", "Documento/origem"]),
			),
			supplierName: textValue(
				cell(row, headers, [
					"Fornecedor/Favorecido",
					"Fornecedor",
					"Favorecido",
				]),
			),
			costGroup: textValue(cell(row, headers, ["Grupo de custo", "Grupo"])),
			paymentStatus: textValue(
				cell(row, headers, ["Situacao do pagamento", "Situacao pagamento"]),
			),
			competenceDate: dateOnly(
				textValue(
					cell(row, headers, [
						"Data de competencia",
						"Data de competência",
						"Competencia",
					]),
				),
			),
			dueDate: dateOnly(
				textValue(cell(row, headers, ["Data de vencimento", "Vencimento"])),
			),
			paymentDate: dateOnly(
				textValue(cell(row, headers, ["Data de pagamento", "Pagamento em"])),
			),
			documentNumber: textValue(
				cell(row, headers, [
					"Numero do documento",
					"Numero documento",
					"Numero",
				]),
			),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

export const SHEET_NAME_ALIASES: Record<string, string[]> = {
	"Medicoes Obra": [
		"Medições de Obra",
		"Medicoes Obra",
		"Medicoes",
		"Medições",
	],
	Orcamento: ["Orcamento", "Orçamento"],
	"Cronograma Original": ["Cronograma Original", "Cronograma"],
	"Itens do Orcamento": ["Itens do Orcamento", "Itens do Orçamento"],
};

export function findSheetMap(
	workbook: XLSX.WorkBook,
	kind: WorkbookKind,
): Map<string, string> {
	const definition = WORKBOOK_DEFINITIONS[kind];
	if (!definition) {
		throw new ConstructionError(
			"INVALID_KIND",
			"Tipo de workbook invalido",
			400,
		);
	}

	const normalizedNames = new Map(
		workbook.SheetNames.map(
			(sheetName) => [normalizeText(sheetName), sheetName] as const,
		),
	);

	const dataSheets = definition.sheets.filter(
		(s) =>
			s.isDataSheet &&
			!(kind === "orcamento" && s.name === "Cronograma Original"),
	);
	const sheetMap = new Map<string, string>();

	for (const sheet of dataSheets) {
		const canonicalAliases = SHEET_NAME_ALIASES[sheet.name] ?? [sheet.name];
		let actualName: string | undefined;

		for (const alias of canonicalAliases) {
			actualName = normalizedNames.get(normalizeText(alias));
			if (actualName) break;
		}

		if (!actualName) continue;

		sheetMap.set(sheet.name, actualName);
	}

	return sheetMap;
}

function parseContractRows(sheet: XLSX.WorkSheet): ParsedContractRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			code: textValue(cell(row, headers, ["Codigo", "Código"])),
			supplierName: textValue(
				cell(row, headers, ["Fornecedor", "Fornecedor/Favorecido"]),
			),
			contractValue: cell(row, headers, ["Valor do Contrato"]),
			serviceType: textValue(
				cell(row, headers, ["Tipo de Servico", "Tipo de Serviço"]),
			),
			title: textValue(cell(row, headers, ["Titulo", "Título"])),
			startDate: cell(row, headers, ["Inicio", "Início"]),
			endDate: cell(row, headers, ["Fim"]),
			status: textValue(cell(row, headers, ["Situacao", "Situação"])),
			notes: textValue(cell(row, headers, ["Observacoes", "Observações"])),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parseServiceRows(sheet: XLSX.WorkSheet): ParsedServiceRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			index: textValue(cell(row, headers, ["Indice", "Índice"])),
			type: textValue(cell(row, headers, ["Tipo"])),
			description: textValue(cell(row, headers, ["Descricao", "Descrição"])),
			unit: textValue(cell(row, headers, ["Unidade", "Unid"])),
			quantity: cell(row, headers, ["Quantidade", "QTDE"]),
			unitCost: cell(row, headers, ["Custo Unitario", "Custo Unitário"]),
			totalCost: cell(row, headers, ["Custo Total"]),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parseContractMeasurementRows(
	sheet: XLSX.WorkSheet,
): ParsedContractMeasurementRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			number: textValue(cell(row, headers, ["Nº", "N.", "Numero", "Número"])),
			date: cell(row, headers, ["Data"]),
			title: textValue(cell(row, headers, ["Titulo", "Título"])),
			discountValue: cell(row, headers, ["Desconto"]),
			retentionValue: cell(row, headers, ["Retencao", "Retenção"]),
			taxValue: cell(row, headers, ["Valor de impostos", "Impostos"]),
			notes: textValue(cell(row, headers, ["Observacoes", "Observações"])),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

function parsePaymentRows(sheet: XLSX.WorkSheet): ParsedPaymentRow[] {
	const rows = sheetRows(sheet);
	const headers = headerMap(rows[0]);

	return rows.slice(1).flatMap((row, index) => {
		const values = {
			date: cell(row, headers, ["Data"]),
			value: cell(row, headers, ["Valor"]),
			paidValue: cell(row, headers, ["Valor Pago"]),
			description: textValue(cell(row, headers, ["Descricao", "Descrição"])),
			retentionValue: cell(row, headers, ["Retencao", "Retenção"]),
			discountValue: cell(row, headers, ["Desconto"]),
			status: textValue(cell(row, headers, ["Situacao", "Situação"])),
		};

		if (!hasAnyValue(Object.values(values))) return [];

		return [{ rowNumber: index + 2, ...values }];
	});
}

const QUOTATION_HEADER_ALIASES = {
	supplierDocument: ["CNPJ", "Documento"],
	supplierName: [
		"Razão Social",
		"Razão Social / Nome da Empresa",
		"Fornecedor",
	],
	serviceDescription: [
		"Descrição do Serviço",
		"Descrição do Serviço / Empreitada",
		"Descricao do Servico",
	],
	value: [
		"Valor do Serviço",
		"Valor da Empreitada (R$)",
		"Valor da proposta",
		"Valor Total da Proposta",
	],
	serviceStartDate: ["Data de Início", "Data de inicio"],
	executionTermDays: ["Prazo de Execução", "Prazo de Execução (dias)"],
	paymentTerms: ["Condição de Pagamento", "Condições de Pagamento"],
	notes: ["Observações", "Observacoes"],
	quotationCode: ["Código da Cotação", "Codigo da Cotacao", "Codigo Cotacao"],
	suggestedWinner: [
		"Indicado Vencedor",
		"Indicação de Vencedor",
		"Indicacao de Vencedor",
	],
} as const;

function findQuotationHeaderIndex(rows: unknown[][]): number {
	return rows.findIndex((row) => {
		const headers = headerMap(row);
		return (
			headers.has(normalizeText("CNPJ")) &&
			QUOTATION_HEADER_ALIASES.supplierName.some((alias) =>
				headers.has(normalizeText(alias)),
			)
		);
	});
}

function parseQuotationRows(sheet: XLSX.WorkSheet): ParsedQuotationRow[] {
	const rows = sheetRows(sheet);
	const headerIndex = findQuotationHeaderIndex(rows);
	if (headerIndex === -1) return [];

	const headers = headerMap(rows[headerIndex]);

	return rows.slice(headerIndex + 1).flatMap((row, index) => {
		const supplierDocument = textValue(
			cell(row, headers, QUOTATION_HEADER_ALIASES.supplierDocument),
		);
		// Linhas de metadados/resumo nao possuem CNPJ e nao sao propostas.
		if (!supplierDocument) return [];

		const values = {
			supplierDocument,
			supplierName: textValue(
				cell(row, headers, QUOTATION_HEADER_ALIASES.supplierName),
			),
			supplierAddress: textValue(
				cell(row, headers, ["Endereço Completo", "Endereco Completo"]),
			),
			supplierPhone: textValue(cell(row, headers, ["Telefone"])),
			supplierEmail: textValue(cell(row, headers, ["E-mail", "Email"])),
			supplierResponsible: textValue(
				cell(row, headers, ["Responsável", "Contato / Responsável"]),
			),
			serviceDescription: textValue(
				cell(row, headers, QUOTATION_HEADER_ALIASES.serviceDescription),
			),
			value: cell(row, headers, QUOTATION_HEADER_ALIASES.value),
			serviceStartDate: cell(
				row,
				headers,
				QUOTATION_HEADER_ALIASES.serviceStartDate,
			),
			executionTermDays: cell(
				row,
				headers,
				QUOTATION_HEADER_ALIASES.executionTermDays,
			),
			paymentTerms: textValue(
				cell(row, headers, QUOTATION_HEADER_ALIASES.paymentTerms),
			),
			notes: textValue(cell(row, headers, QUOTATION_HEADER_ALIASES.notes)),
			quotationCode: textValue(
				cell(row, headers, QUOTATION_HEADER_ALIASES.quotationCode),
			),
			suggestedWinner: textValue(
				cell(row, headers, QUOTATION_HEADER_ALIASES.suggestedWinner),
			),
		};

		return [{ rowNumber: headerIndex + index + 2, ...values }];
	});
}

export function parseWorkbookByKind(
	bytes: Uint8Array,
	fileName: string,
	kind: WorkbookKind,
): ParsedWorkbookUnified {
	if (bytes.length === 0) {
		throw new ConstructionError(
			"INVALID_WORKBOOK",
			"Workbook has no sheets",
			400,
		);
	}

	const workbook = XLSX.read(bytes, { type: "buffer" });
	const sheetMap = findSheetMap(workbook, kind);

	const emptyWork: ParsedWorkSheet = {
		code: "",
		name: "",
		clientName: null,
		baseDate: null,
		plannedStart: null,
		plannedEnd: null,
		areaM2: null,
		operationalStatus: null,
		responsibleName: null,
	};

	const result: ParsedWorkbookUnified = {
		fileName,
		sheetName: fileName,
		header: {
			workName: "",
			workCode: "",
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
		},
		work: emptyWork,
		budgetRows: [],
		itensRows: [],
		baselineRows: [],
		replanningRows: [],
		measurementRows: [],
		contractRows: [],
		serviceRows: [],
		contractMeasurementRows: [],
		paymentRows: [],
		actualCostRows: [],
		quotationRows: [],
		sheetNames: workbook.SheetNames,
		sheetHeaders: extractSheetHeaders(workbook),
	};

	for (const [expectedName, actualName] of sheetMap) {
		const sheet = workbook.Sheets[actualName];

		switch (expectedName) {
			case "Obra": {
				const work = parseWorkSheet(sheet);
				result.work = work;
				result.sheetName = work.code || fileName;
				result.header = {
					workName: work.name,
					workCode: work.code,
					plannedStart: parseDate(work.plannedStart),
					plannedEnd: parseDate(work.plannedEnd),
					baseDate: parseDate(work.baseDate),
				};
				break;
			}
			case "Orcamento":
				result.budgetRows = parseBudgetRows(sheet);
				break;
			case "Itens do Orcamento":
				result.itensRows = parseBudgetRows(sheet);
				break;
			case "Cronograma Original":
				result.baselineRows = parseBaselineRows(sheet);
				break;
			case "Replanejamento":
				result.replanningRows = parseReplanningRows(sheet);
				break;
			case "Medicoes Obra":
				result.measurementRows = parseMeasurementRows(sheet);
				break;
			case "Contrato":
				result.contractRows = parseContractRows(sheet);
				break;
			case "Servicos":
				result.serviceRows = parseServiceRows(sheet);
				break;
			case "Medicoes Contrato":
				result.contractMeasurementRows = parseContractMeasurementRows(sheet);
				break;
			case "Pagamentos":
				result.paymentRows = parsePaymentRows(sheet);
				break;
			case "Custos Realizados":
				result.actualCostRows = parseActualCostRows(sheet);
				break;
			case "Mapa de Cotacao":
				result.quotationRows = parseQuotationRows(sheet);
				break;
		}
	}

	return result;
}

export function parseWorkbook(
	bytes: Uint8Array,
	fileName: string,
	_sheetName?: string,
): ParsedWorkbookUnified {
	return parseWorkbookByKind(bytes, fileName, "obra-completa");
}
