import * as XLSX from "xlsx";
import type {
	ColumnDefinition,
	SheetDefinition,
	WorkbookKind,
} from "./workbook-contracts";
import { SHEET_DEFINITIONS, WORKBOOK_DEFINITIONS } from "./workbook-contracts";

const COLORS = {
	titleBg: "1F4E79",
	titleFg: "FFFFFF",
	headerBg: "2E75B6",
	headerFg: "FFFFFF",
	border: "B4C6E7",
};

const BORDER_STYLE = {
	border: {
		top: { style: "thin", color: { rgb: COLORS.border } },
		bottom: { style: "thin", color: { rgb: COLORS.border } },
		left: { style: "thin", color: { rgb: COLORS.border } },
		right: { style: "thin", color: { rgb: COLORS.border } },
	},
};

const TITLE_STYLE = {
	font: { bold: true, color: { rgb: COLORS.titleFg }, sz: 14 },
	fill: { fgColor: { rgb: COLORS.titleBg } },
	alignment: { horizontal: "center", vertical: "center" },
};

const HEADER_STYLE = {
	font: { bold: true, color: { rgb: COLORS.headerFg }, sz: 11 },
	fill: { fgColor: { rgb: COLORS.headerBg } },
	alignment: { horizontal: "center", vertical: "center", wrapText: true },
	...BORDER_STYLE,
};

const CELL_STYLE = {
	alignment: { vertical: "center" },
	...BORDER_STYLE,
};

const MIN_COL_WIDTH = 14;
const MAX_COL_WIDTH = 60;

function computeColumnWidths(
	headers: string[],
	dataRows: unknown[][] = [],
): XLSX.ColInfo[] {
	return headers.map((header, column) => {
		const headerWidth = String(header).length + 4;
		const contentWidth = dataRows.reduce((max, row) => {
			const value = row[column];
			if (value === null || value === undefined) return max;
			return Math.max(max, String(value).length + 4);
		}, 0);
		const width = Math.max(headerWidth, contentWidth, MIN_COL_WIDTH);
		return { wch: Math.min(width, MAX_COL_WIDTH) };
	});
}

export function buildStyledSheet(
	title: string,
	headers: string[],
	dataRows: unknown[][] = [],
): XLSX.WorkSheet {
	const totalCols = headers.length;

	const aoa: unknown[][] = [[title], headers, ...dataRows];
	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws["!cols"] = computeColumnWidths(headers, dataRows);
	ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];

	ws["!freeze"] = { xSplit: 1, ySplit: 2 };

	const titleRange = XLSX.utils.decode_range(
		`A1:${XLSX.utils.encode_col(totalCols - 1)}1`,
	);
	for (let c = titleRange.s.c; c <= titleRange.e.c; c++) {
		const addr = XLSX.utils.encode_cell({ r: 0, c });
		ws[addr] = ws[addr] || {};
		ws[addr].t = "s";
		ws[addr].v = title;
		ws[addr].s = TITLE_STYLE;
	}

	const headerRange = XLSX.utils.decode_range(
		`A2:${XLSX.utils.encode_col(totalCols - 1)}2`,
	);
	for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
		const addr = XLSX.utils.encode_cell({ r: 1, c });
		ws[addr] = ws[addr] || {};
		ws[addr].t = "s";
		ws[addr].v = headers[c];
		ws[addr].s = HEADER_STYLE;
	}

	for (let r = 0; r < dataRows.length; r++) {
		for (let c = 0; c < totalCols; c++) {
			const addr = XLSX.utils.encode_cell({ r: r + 2, c });
			ws[addr] = ws[addr] || {};
			ws[addr].s = CELL_STYLE;
		}
	}

	return ws;
}

function createWorkbook(
	sheetName: string,
	title: string,
	headers: string[],
	dataRows: unknown[][] = [],
): Uint8Array {
	const ws = buildStyledSheet(title, headers, dataRows);
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, sheetName);
	return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function generateObraTemplate(): Uint8Array {
	const title = "PLANILHA DE ORÇAMENTO E CRONOGRAMA — OBRA";
	const headers = [
		"Índice",
		"Tipo",
		"Descrição",
		"Unid.",
		"QTDE.",
		"Mão de Obra",
		"Material",
		"Equipamento",
		"Outros",
		"Início Previsto",
		"Fim Previsto",
		"Início Real",
		"Fim Real",
		"% Concluído",
		"Situação",
	];

	return createWorkbook("Obra", title, headers);
}

export function generateMedicoesTemplate(): Uint8Array {
	const title = "PLANILHA DE MEDIÇÕES";
	const headers = [
		"Índice",
		"Data da Medição",
		"% Acumulado",
		"Qtd Acumulada",
		"Observação",
	];

	return createWorkbook("Medições", title, headers);
}

export function generateCustosTemplate(): Uint8Array {
	const title = "PLANILHA DE CUSTOS REALIZADOS";
	const headers = [
		"Índice",
		"Data",
		"Categoria",
		"Descrição",
		"Valor (R$)",
		"Tipo",
		"Fornecedor",
		"Status",
	];

	return createWorkbook("Custos", title, headers);
}

const OBRA_FIELDS = [
	["Código da obra", ""],
	["Nome da obra", ""],
	["Cliente/empreendimento", ""],
	["Data-base", ""],
	["Início planejado original", ""],
	["Fim planejado original", ""],
	["Área m²", ""],
	["Situação operacional", ""],
	["Responsável", ""],
];

const ORCAMENTO_HEADERS = [
	"Índice",
	"Tipo",
	"Descrição",
	"Unidade",
	"Quantidade",
	"Mão de obra unitária",
	"Material unitário",
	"Equipamento unitário",
	"Outros unitário",
	"Situação",
];

const ORCAMENTO_EXAMPLE = [
	["1", "Etapa/Subetapa", "Fundação", "", "", "", "", "", "", ""],
	["1.1", "Item", "Escavação", "m³", "10", "20", "30", "5", "0", ""],
];

const CRONOGRAMA_ORIGINAL_HEADERS = [
	"Índice",
	"Início previsto",
	"Fim previsto",
	"Peso planejado opcional",
];

const CRONOGRAMA_ORIGINAL_EXAMPLE = [["1.1", "2026-01-01", "2026-01-31", ""]];

const REPLANEJAMENTO_HEADERS = [
	"Índice",
	"Versão do replanejamento",
	"Início replanejado",
	"Fim replanejado",
	"Data da revisão",
	"Motivo",
];

const REPLANEJAMENTO_EXAMPLE = [
	["1.1", "R1", "2026-01-05", "2026-02-05", "2026-01-10", ""],
];

const MEDICOES_HEADERS = [
	"Índice",
	"Data da medição",
	"Percentual medido acumulado",
	"Quantidade medida acumulada",
	"Observação",
];

const MEDICOES_EXAMPLE = [["1.1", "2026-01-15", "50", "", ""]];

const CUSTOS_REALIZADOS_HEADERS = [
	"Data do lançamento",
	"Índice apropriado",
	"Categoria",
	"Descrição",
	"Valor realizado",
	"Tipo",
	"Documento origem",
	"Fornecedor/Favorecido",
	"Grupo de custo",
	"Situação do pagamento",
	"Data de competência",
	"Data de vencimento",
	"Data de pagamento",
	"Número do documento",
];

const CUSTOS_REALIZADOS_EXAMPLE = [
	[
		"2026-01-20",
		"1.1",
		"Material",
		"Nota fiscal",
		"200",
		"Atual",
		"NF-1",
		"",
		"",
		"Pago",
		"2026-01-01",
		"2026-02-15",
		"2026-02-10",
		"NF-1",
	],
];

export function generateUnifiedTemplate(): Uint8Array {
	const wb = XLSX.utils.book_new();

	const obraSheet = buildStyledSheet(
		"DADOS DA OBRA",
		["Campo", "Valor"],
		OBRA_FIELDS,
	);
	XLSX.utils.book_append_sheet(wb, obraSheet, "Obra");

	const orcamentoSheet = buildStyledSheet(
		"ORÇAMENTO",
		ORCAMENTO_HEADERS,
		ORCAMENTO_EXAMPLE,
	);
	XLSX.utils.book_append_sheet(wb, orcamentoSheet, "Orcamento");

	const cronogramaSheet = buildStyledSheet(
		"CRONOGRAMA ORIGINAL",
		CRONOGRAMA_ORIGINAL_HEADERS,
		CRONOGRAMA_ORIGINAL_EXAMPLE,
	);
	XLSX.utils.book_append_sheet(wb, cronogramaSheet, "Cronograma Original");

	const replanejamentoSheet = buildStyledSheet(
		"REPLANEJAMENTO",
		REPLANEJAMENTO_HEADERS,
		REPLANEJAMENTO_EXAMPLE,
	);
	XLSX.utils.book_append_sheet(wb, replanejamentoSheet, "Replanejamento");

	const medicoesSheet = buildStyledSheet(
		"MEDIÇÕES",
		MEDICOES_HEADERS,
		MEDICOES_EXAMPLE,
	);
	XLSX.utils.book_append_sheet(wb, medicoesSheet, "Medicoes");

	const custosSheet = buildStyledSheet(
		"CUSTOS REALIZADOS",
		CUSTOS_REALIZADOS_HEADERS,
		CUSTOS_REALIZADOS_EXAMPLE,
	);
	XLSX.utils.book_append_sheet(wb, custosSheet, "Custos Realizados");

	return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function buildDataSheet(
	sheetDef: SheetDefinition,
	dataRows?: Array<Record<string, unknown>>,
): XLSX.WorkSheet {
	const headers = sheetDef.headers;
	const formats = sheetDef.formats;
	const exampleRow = sheetDef.columns.map((column) => column.example ?? "");
	const rows =
		dataRows !== undefined
			? dataRows.map((row) => headers.map((header) => row[header] ?? ""))
			: [exampleRow];
	const aoa: unknown[][] = [headers, ...rows];
	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws["!cols"] = computeColumnWidths(headers, rows);
	ws["!freeze"] = { xSplit: 0, ySplit: 2 };

	const totalCols = headers.length;
	const lastCol = XLSX.utils.encode_col(totalCols - 1);

	for (let c = 0; c < totalCols; c++) {
		const addr = XLSX.utils.encode_cell({ r: 0, c });
		ws[addr] = ws[addr] || {};
		ws[addr].t = "s";
		ws[addr].v = headers[c];
		ws[addr].s = HEADER_STYLE;
		if (formats?.[c] && formats[c] !== "text") {
			ws[addr].s = { ...HEADER_STYLE, numFmt: formats[c] };
		}
	}

	for (let c = 0; c < totalCols; c++) {
		const addr = XLSX.utils.encode_cell({ r: 1, c });
		ws[addr] = ws[addr] || {};
		ws[addr].s = CELL_STYLE;
		if (formats?.[c] && formats[c] !== "text") {
			ws[addr].s = { ...CELL_STYLE, numFmt: formats[c] };
		}
	}

	ws["!autofilter"] = { ref: `A1:${lastCol}${Math.max(2, rows.length + 1)}` };

	return ws;
}

const GUIA_COLORS = {
	mastheadBg: "0A1530",
	mastheadFg: "FFFFFF",
};

const GUIA_MASTHEAD_STYLE = {
	font: { bold: true, color: { rgb: GUIA_COLORS.mastheadFg }, sz: 14 },
	fill: { fgColor: { rgb: GUIA_COLORS.mastheadBg } },
	alignment: { horizontal: "center", vertical: "center" },
};

const GUIA_HEADER_STYLE = {
	font: { bold: true, color: { rgb: "FFFFFF" } },
	fill: { fgColor: { rgb: "1F3864" } },
	alignment: { horizontal: "left", vertical: "center" },
};

const GUIA_SECTION_STYLE = {
	font: { bold: true, sz: 12 },
	fill: { fgColor: { rgb: "D9E2F3" } },
};

const GUIA_TOTAL_COLS = 6;

const TYPE_LABELS: Record<ColumnDefinition["type"], string> = {
	text: "Texto",
	number: "Número",
	currency: "Moeda (R$)",
	date: "Data (dd/mm/aaaa)",
	percent: "Percentual (0-100)",
};

function appendGuiaSection(aoa: unknown[][], sheet: SheetDefinition): void {
	aoa.push([], [`Aba: ${sheet.name}`]);
	aoa.push([
		"Coluna",
		"Obrigatório",
		"Tipo",
		"Exemplo",
		"Descrição",
		"Dependência",
	]);
	for (const column of sheet.columns) {
		aoa.push([
			column.header,
			column.required ? "Sim" : "Não",
			TYPE_LABELS[column.type],
			column.example ?? "",
			column.description,
			column.dependency ?? "",
		]);
	}
}

export function buildGuiaSheet(
	kind?: WorkbookKind,
	budgetItems?: Array<{ index: string; description: string }>,
): XLSX.WorkSheet {
	const title = "Modelo de Importação - ObraControl";
	const subtitle =
		"Preencha os dados nas abas correspondentes e salve o arquivo. Em seguida, faça o upload no sistema ObraControl.";

	const aoa: unknown[][] = [
		[title],
		[subtitle],
		[],
		["Como preencher"],
		[
			"Baixe o modelo, preencha as abas de dados usando a primeira linha de exemplo como referência e envie o arquivo. As colunas marcadas como obrigatórias não podem ficar vazias. Datas no formato dd/mm/aaaa e valores monetários sem máscara.",
		],
	];

	aoa.push(
		[],
		["Referência do orçamento"],
		["Orçamento", "Índice", "Nome do item"],
		...(budgetItems?.length
			? budgetItems.map((item) => [
					"Orçamento vigente",
					item.index,
					item.description,
				])
			: [
					[
						"Orçamento vigente",
						"Preencha o Índice",
						"Nome preenchido automaticamente",
					],
				]),
	);

	if (kind !== undefined) {
		for (const sheet of WORKBOOK_DEFINITIONS[kind].sheets) {
			if (sheet.isDataSheet && sheet.columns.length > 0) {
				appendGuiaSection(aoa, sheet);
			}
		}
	} else {
		for (const sheet of Object.values(SHEET_DEFINITIONS)) {
			if (sheet.isDataSheet && sheet.columns.length > 0) {
				appendGuiaSection(aoa, sheet);
			}
		}
	}

	const ws = XLSX.utils.aoa_to_sheet(aoa);

	ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: GUIA_TOTAL_COLS - 1 } }];

	ws["!cols"] = [
		{ wch: 32 },
		{ wch: 12 },
		{ wch: 22 },
		{ wch: 28 },
		{ wch: 60 },
		{ wch: 24 },
	];

	for (let c = 0; c < GUIA_TOTAL_COLS; c++) {
		const addr = XLSX.utils.encode_cell({ r: 0, c });
		ws[addr] = ws[addr] || {};
		ws[addr].t = "s";
		ws[addr].v = title;
		ws[addr].s = GUIA_MASTHEAD_STYLE;
	}

	let rowIndex = 0;
	for (const row of aoa) {
		if (typeof row[0] === "string" && (row[0] as string).startsWith("Aba: ")) {
			ws[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })] = {
				t: "s",
				v: row[0],
				s: GUIA_SECTION_STYLE,
			};
		} else if (row[0] === "Coluna") {
			for (let c = 0; c < GUIA_TOTAL_COLS; c++) {
				ws[XLSX.utils.encode_cell({ r: rowIndex, c })] = {
					t: "s",
					v: row[c],
					s: GUIA_HEADER_STYLE,
				};
			}
		}
		rowIndex += 1;
	}

	return ws;
}

export function buildWorkbookTemplate(
	kind: WorkbookKind,
	data?: Partial<Record<string, Array<Record<string, unknown>>>>,
	budgetItems?: Array<{ index: string; description: string }>,
): Uint8Array {
	const def = WORKBOOK_DEFINITIONS[kind];
	const wb = XLSX.utils.book_new();

	for (const sheetDef of def.sheets) {
		let ws: XLSX.WorkSheet;
		if (sheetDef.isDataSheet) {
			ws = buildDataSheet(sheetDef, data?.[sheetDef.name]);
		} else {
			ws = buildGuiaSheet(kind, budgetItems);
		}
		XLSX.utils.book_append_sheet(wb, ws, sheetDef.name);
	}

	return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
