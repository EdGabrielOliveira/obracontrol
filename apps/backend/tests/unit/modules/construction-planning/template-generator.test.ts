import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import {
	buildDataSheet,
	buildStyledSheet,
	buildWorkbookTemplate,
	generateCustosTemplate,
	generateMedicoesTemplate,
	generateObraTemplate,
	generateUnifiedTemplate,
} from "../../../../src/modules/construction-planning/templates/template-generator";
import {
	WORKBOOK_DEFINITIONS,
	WORKBOOK_KINDS,
	type WorkbookKind,
} from "../../../../src/modules/construction-planning/templates/workbook-contracts";

function readWorkbook(buffer: Uint8Array) {
	return XLSX.read(buffer, { type: "buffer" });
}

function getHeaderRow(buffer: Uint8Array) {
	const wb = readWorkbook(buffer);
	const sheet = wb.Sheets[wb.SheetNames[0]];
	const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
	return data[1] as string[];
}

describe("generateObraTemplate", () => {
	it("produces a valid xlsx workbook with one sheet", () => {
		const buffer = generateObraTemplate();
		const wb = readWorkbook(buffer);
		expect(wb.SheetNames.length).toBe(1);
	});

	it("keeps the current separate obra sheet name", () => {
		const wb = readWorkbook(generateObraTemplate());

		expect(wb.SheetNames).toEqual(["Obra"]);
	});

	it("has title in row 1", () => {
		const buffer = generateObraTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const row1 = data[0] as string[];
		expect(row1[0]).toBe("PLANILHA DE ORÇAMENTO E CRONOGRAMA — OBRA");
	});

	it("has correct header row in row 2", () => {
		expect(getHeaderRow(generateObraTemplate())).toEqual([
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
		]);
	});

	it("has sub-headers for labor, material, equipment, other costs", () => {
		const buffer = generateObraTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headerRow = data[1] as string[];
		expect(headerRow[5]).toBe("Mão de Obra");
		expect(headerRow[6]).toBe("Material");
		expect(headerRow[7]).toBe("Equipamento");
		expect(headerRow[8]).toBe("Outros");
	});

	it("has merged title cell spanning all columns", () => {
		const ws = buildStyledSheet("PLANILHA DE ORÇAMENTO E CRONOGRAMA — OBRA", [
			"Índice",
			"Tipo",
			"Descrição",
		]);
		expect(ws["!merges"]).toBeDefined();
		expect(ws["!merges"]?.length).toBe(1);
		expect(ws["!merges"]?.[0].s.c).toBe(0);
		expect(ws["!merges"]?.[0].e.c).toBe(2);
	});

	it("has freeze panes configured", () => {
		const ws = buildStyledSheet("PLANILHA DE ORÇAMENTO E CRONOGRAMA — OBRA", [
			"Índice",
			"Tipo",
		]);
		expect(ws["!freeze"]).toBeDefined();
		expect(ws["!freeze"]?.xSplit).toBe(1);
		expect(ws["!freeze"]?.ySplit).toBe(2);
	});

	it("has styled title cell with dark blue background", () => {
		const ws = buildStyledSheet("PLANILHA DE ORÇAMENTO E CRONOGRAMA — OBRA", [
			"Índice",
			"Tipo",
		]);
		const titleCell = ws.A1;
		expect(titleCell).toBeDefined();
		expect(titleCell?.s).toBeDefined();
		expect(titleCell?.s?.font?.bold).toBe(true);
		expect(titleCell?.s?.font?.color?.rgb).toBe("FFFFFF");
		expect(titleCell?.s?.fill?.fgColor?.rgb).toBe("1F4E79");
	});

	it("has styled header cell with blue background", () => {
		const ws = buildStyledSheet("PLANILHA DE ORÇAMENTO E CRONOGRAMA — OBRA", [
			"Índice",
			"Tipo",
		]);
		const headerCell = ws.A2;
		expect(headerCell).toBeDefined();
		expect(headerCell?.s).toBeDefined();
		expect(headerCell?.s?.font?.bold).toBe(true);
		expect(headerCell?.s?.font?.color?.rgb).toBe("FFFFFF");
		expect(headerCell?.s?.fill?.fgColor?.rgb).toBe("2E75B6");
	});

	it("has borders on header cells", () => {
		const ws = buildStyledSheet("Title", ["Col1", "Col2"]);
		const headerCell = ws.A2;
		expect(headerCell?.s?.border).toBeDefined();
		expect(headerCell?.s?.border?.top?.style).toBe("thin");
		expect(headerCell?.s?.border?.bottom?.style).toBe("thin");
		expect(headerCell?.s?.border?.left?.style).toBe("thin");
		expect(headerCell?.s?.border?.right?.style).toBe("thin");
	});

	it("has column widths computed from headers", () => {
		const ws = buildStyledSheet("Title", ["Índice", "Descrição do Item"]);
		expect(ws["!cols"]).toBeDefined();
		expect(ws["!cols"]?.length).toBe(2);
		expect(ws["!cols"]?.[0].wch).toBeGreaterThanOrEqual(14);
		expect(ws["!cols"]?.[1].wch).toBeGreaterThan(ws["!cols"]?.[0].wch ?? 0);
	});

	it("has no example data rows when dataRows is empty", () => {
		const buffer = generateObraTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		expect(data.length).toBe(2);
	});
});

describe("generateMedicoesTemplate", () => {
	it("keeps the current separate medicoes sheet name", () => {
		const wb = readWorkbook(generateMedicoesTemplate());

		expect(wb.SheetNames).toEqual(["Medições"]);
	});

	it("has title in row 1", () => {
		const buffer = generateMedicoesTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const row1 = data[0] as string[];
		expect(row1[0]).toBe("PLANILHA DE MEDIÇÕES");
	});

	it("has measurement columns in row 2", () => {
		expect(getHeaderRow(generateMedicoesTemplate())).toEqual([
			"Índice",
			"Data da Medição",
			"% Acumulado",
			"Qtd Acumulada",
			"Observação",
		]);
	});

	it("has merged title cell", () => {
		const ws = buildStyledSheet("PLANILHA DE MEDIÇÕES", [
			"Índice",
			"Data da Medição",
			"% Acumulado",
			"Qtd Acumulada",
			"Observação",
		]);
		expect(ws["!merges"]).toBeDefined();
		expect(ws["!merges"]?.length).toBe(1);
		expect(ws["!merges"]?.[0].s.c).toBe(0);
		expect(ws["!merges"]?.[0].e.c).toBe(4);
	});

	it("has no example data rows", () => {
		const buffer = generateMedicoesTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		expect(data.length).toBe(2);
	});
});

describe("generateCustosTemplate", () => {
	it("keeps the current separate custos sheet name", () => {
		const wb = readWorkbook(generateCustosTemplate());

		expect(wb.SheetNames).toEqual(["Custos"]);
	});

	it("has title in row 1", () => {
		const buffer = generateCustosTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const row1 = data[0] as string[];
		expect(row1[0]).toBe("PLANILHA DE CUSTOS REALIZADOS");
	});

	it("has cost columns in row 2", () => {
		expect(getHeaderRow(generateCustosTemplate())).toEqual([
			"Índice",
			"Data",
			"Categoria",
			"Descrição",
			"Valor (R$)",
			"Tipo",
			"Fornecedor",
			"Status",
		]);
	});

	it("has merged title cell", () => {
		const ws = buildStyledSheet("PLANILHA DE CUSTOS REALIZADOS", [
			"Índice",
			"Data",
			"Categoria",
			"Descrição",
			"Valor (R$)",
			"Tipo",
			"Fornecedor",
			"Status",
		]);
		expect(ws["!merges"]).toBeDefined();
		expect(ws["!merges"]?.length).toBe(1);
		expect(ws["!merges"]?.[0].s.c).toBe(0);
		expect(ws["!merges"]?.[0].e.c).toBe(7);
	});

	it("has no example data rows", () => {
		const buffer = generateCustosTemplate();
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets[wb.SheetNames[0]];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		expect(data.length).toBe(2);
	});
});

describe("generateUnifiedTemplate", () => {
	it("produces a workbook with all 6 required sheets", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);

		expect(wb.SheetNames).toEqual([
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		]);
	});

	it("has Obra sheet with Campo/Valor headers and expected field rows", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets.Obra;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headers = data[1] as string[];

		expect(headers).toEqual(["Campo", "Valor"]);

		const fieldNames = (data.slice(2) as string[][]).map((row) => row[0]);
		expect(fieldNames).toContain("Código da obra");
		expect(fieldNames).toContain("Nome da obra");
		expect(fieldNames).toContain("Cliente/empreendimento");
		expect(fieldNames).toContain("Data-base");
		expect(fieldNames).toContain("Início planejado original");
		expect(fieldNames).toContain("Fim planejado original");
	});

	it("has Obra sheet readable by Campo/Valor parser after normalization", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets.Obra;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const campoIndex = 0;
		const valorIndex = 1;
		const rows = data.slice(2) as unknown[][];

		const getValue = (field: string) => {
			const row = rows.find((r) => String(r[campoIndex]).trim() === field);
			return row ? (row[valorIndex] as string) : null;
		};

		expect(getValue("Código da obra")).toBe("");
		expect(getValue("Nome da obra")).toBe("");
		expect(getValue("Cliente/empreendimento")).toBe("");
		expect(getValue("Data-base")).toBe("");
		expect(getValue("Início planejado original")).toBe("");
		expect(getValue("Fim planejado original")).toBe("");
		expect(getValue("Área m²")).toBe("");
		expect(getValue("Situação operacional")).toBe("");
		expect(getValue("Responsável")).toBe("");
	});

	it("has Orcamento sheet headers matching parser contract", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets.Orcamento;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headers = data[1] as string[];

		expect(headers).toEqual([
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
		]);
	});

	it("has Cronograma Original sheet headers matching parser contract", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets["Cronograma Original"];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headers = data[1] as string[];

		expect(headers).toEqual([
			"Índice",
			"Início previsto",
			"Fim previsto",
			"Peso planejado opcional",
		]);
	});

	it("has Replanejamento sheet headers matching parser contract", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets.Replanejamento;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headers = data[1] as string[];

		expect(headers).toEqual([
			"Índice",
			"Versão do replanejamento",
			"Início replanejado",
			"Fim replanejado",
			"Data da revisão",
			"Motivo",
		]);
	});

	it("has Medicoes sheet headers matching parser contract", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets.Medicoes;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headers = data[1] as string[];

		expect(headers).toEqual([
			"Índice",
			"Data da medição",
			"Percentual medido acumulado",
			"Quantidade medida acumulada",
			"Observação",
		]);
	});

	it("has Custos Realizados sheet headers matching parser contract", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);
		const sheet = wb.Sheets["Custos Realizados"];
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
		const headers = data[1] as string[];

		expect(headers).toEqual([
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
		]);
	});

	it("generates an xlsx that can be parsed by parseWorkbook", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);

		expect(wb.SheetNames.length).toBe(6);

		for (const sheetName of wb.SheetNames) {
			const sheet = wb.Sheets[sheetName];
			const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
			expect(data.length).toBeGreaterThanOrEqual(1);
			expect(data[0]).toBeDefined();
		}
	});

	it("has styled sheets consistent with existing templates", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);

		for (const sheetName of wb.SheetNames) {
			const sheet = wb.Sheets[sheetName];
			expect(sheet["!merges"]).toBeDefined();
		}
	});

	it("has example data row in each sheet", () => {
		const buffer = generateUnifiedTemplate();
		const wb = readWorkbook(buffer);

		for (const sheetName of wb.SheetNames) {
			const sheet = wb.Sheets[sheetName];
			const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

			if (sheetName === "Obra") {
				expect(data.length).toBeGreaterThanOrEqual(11);
			} else {
				expect(data.length).toBeGreaterThanOrEqual(3);
			}
		}
	});
});

describe("WORKBOOK_DEFINITIONS", () => {
	it("defines all workbook kinds", () => {
		expect(WORKBOOK_KINDS).toEqual([
			"obra-completa",
			"orcamento",
			"orcamento-aditivo",
			"cronograma",
			"medicao-obra",
			"medicao-contrato",
			"custos",
			"cotacao",
			"quotation-map",
		]);
	});

	it("every kind has a definition with filename and sheets", () => {
		for (const kind of WORKBOOK_KINDS) {
			const def = WORKBOOK_DEFINITIONS[kind];
			expect(def).toBeDefined();
			expect(def.kind).toBe(kind);
			expect(def.filename).toBeTruthy();
			expect(def.sheets.length).toBeGreaterThan(0);
		}
	});

	it("every kind has Guia as first sheet (not a data sheet)", () => {
		for (const kind of WORKBOOK_KINDS) {
			const first = WORKBOOK_DEFINITIONS[kind].sheets[0];
			expect(first.name).toBe("Guia");
			expect(first.isDataSheet).toBe(false);
		}
	});

	it("obra-completa has all 14 sheets", () => {
		const sheetNames = WORKBOOK_DEFINITIONS["obra-completa"].sheets.map(
			(s) => s.name,
		);
		expect(sheetNames).toEqual([
			"Guia",
			"Obra",
			"Orcamento",
			"Itens do Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes Obra",
			"Contrato",
			"Servicos",
			"Medicoes Contrato",
			"Pagamentos",
			"Custos Realizados",
			"Mapa de Cotacao",
			"Lista de Fornecedores",
		]);
	});

	it("cronograma has 3 sheets", () => {
		const sheetNames = WORKBOOK_DEFINITIONS.cronograma.sheets.map(
			(s) => s.name,
		);
		expect(sheetNames).toEqual([
			"Guia",
			"Cronograma Original",
			"Replanejamento",
		]);
	});

	it("orcamento has budget and schedule sheets", () => {
		const sheetNames = WORKBOOK_DEFINITIONS.orcamento.sheets.map((s) => s.name);
		expect(sheetNames).toEqual(["Guia", "Orcamento", "Cronograma Original"]);
	});

	it("medicao-obra has measurement and budget reference sheets", () => {
		const sheetNames = WORKBOOK_DEFINITIONS["medicao-obra"].sheets.map(
			(s) => s.name,
		);
		expect(sheetNames).toEqual(["Guia", "Medicoes Obra", "Orçamento"]);
	});

	it("medicao-contrato has 5 sheets", () => {
		const sheetNames = WORKBOOK_DEFINITIONS["medicao-contrato"].sheets.map(
			(s) => s.name,
		);
		expect(sheetNames).toEqual([
			"Guia",
			"Contrato",
			"Servicos",
			"Medicoes Contrato",
			"Pagamentos",
		]);
	});

	it("custos has 2 sheets", () => {
		const sheetNames = WORKBOOK_DEFINITIONS.custos.sheets.map((s) => s.name);
		expect(sheetNames).toEqual(["Guia", "Custos Realizados"]);
	});
});

describe("buildWorkbookTemplate", () => {
	it("obra-completa produces all 14 required sheets", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toEqual([
			"Guia",
			"Obra",
			"Orcamento",
			"Itens do Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes Obra",
			"Contrato",
			"Servicos",
			"Medicoes Contrato",
			"Pagamentos",
			"Custos Realizados",
			"Mapa de Cotacao",
			"Lista de Fornecedores",
		]);
	});

	it("obra-completa template contains the canonical planning sheets", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });

		expect(wb.SheetNames).toEqual(
			expect.arrayContaining([
				"Orcamento",
				"Itens do Orcamento",
				"Cronograma Original",
				"Replanejamento",
			]),
		);
	});

	it("cronograma produces 3 sheets", () => {
		const buffer = buildWorkbookTemplate("cronograma");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toEqual([
			"Guia",
			"Cronograma Original",
			"Replanejamento",
		]);
	});

	it("cronograma contextual template lists the budget indexes without fake dates", () => {
		const buffer = buildWorkbookTemplate(
			"cronograma",
			{
				"Cronograma Original": [
					{
						Índice: "1.1",
						"Nome do item": "Fundação",
						"Início previsto": "",
						"Fim previsto": "",
						"Peso planejado opcional": "",
					},
				],
				Replanejamento: [],
			},
			[{ index: "1.1", description: "Fundação" }],
		);
		const wb = XLSX.read(buffer, { type: "buffer" });
		const scheduleRows = XLSX.utils.sheet_to_json(
			wb.Sheets["Cronograma Original"],
			{ header: 1, defval: "" },
		) as string[][];
		const revisionsRows = XLSX.utils.sheet_to_json(wb.Sheets.Replanejamento, {
			header: 1,
			defval: "",
		}) as string[][];

		expect(scheduleRows[1]).toEqual(["1.1", "Fundação", "", "", ""]);
		expect(revisionsRows).toHaveLength(1);
	});

	it("orcamento produces budget and schedule sheets", () => {
		const buffer = buildWorkbookTemplate("orcamento");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toEqual(["Guia", "Orcamento", "Cronograma Original"]);
	});

	it("medicao-obra produces measurement and budget reference sheets", () => {
		const buffer = buildWorkbookTemplate("medicao-obra");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toEqual(["Guia", "Medições de Obra", "Orçamento"]);
		const budgetRows = XLSX.utils.sheet_to_json(wb.Sheets.Orçamento, {
			header: 1,
			defval: "",
		});
		expect(budgetRows[1]).toEqual(["Índice", "Nome do item"]);
	});

	it("medicao-contrato produces 5 sheets", () => {
		const buffer = buildWorkbookTemplate("medicao-contrato");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toEqual([
			"Guia",
			"Contrato",
			"Servicos",
			"Medicoes Contrato",
			"Pagamentos",
		]);
	});

	it("custos produces 2 sheets", () => {
		const buffer = buildWorkbookTemplate("custos");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toEqual(["Guia", "Custos Realizados"]);
	});

	it("Guia sheet has a merged title row", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets.Guia;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

		expect(data.length).toBeGreaterThan(0);
		const firstRow = data[0] as string[];
		expect(firstRow[0]).toBe("Modelo de Importação - ObraControl");
		expect(sheet["!merges"]).toBeDefined();
	});

	it("Guia sheet documents the Servicos columns for medicao-contrato", () => {
		const wb = XLSX.read(buildWorkbookTemplate("medicao-contrato"), {
			type: "buffer",
		});
		const data = XLSX.utils.sheet_to_json(wb.Sheets.Guia, {
			header: 1,
			defval: "",
		}) as unknown[][];

		expect(data.some((row) => String(row[0]).startsWith("Aba: Servicos"))).toBe(
			true,
		);
		expect(data.some((row) => String(row[0]) === "Custo Unitário")).toBe(true);
	});

	it("Guia sheet without a Servicos sheet does not document Servicos columns", () => {
		const wb = XLSX.read(buildWorkbookTemplate("custos"), {
			type: "buffer",
		});
		const data = XLSX.utils.sheet_to_json(wb.Sheets.Guia, {
			header: 1,
			defval: "",
		}) as unknown[][];

		expect(data.some((row) => String(row[0]).startsWith("Aba: Servicos"))).toBe(
			false,
		);
	});

	it("Guia sheet documents Coluna/Obrigatorio/Tipo/Exemplo/Descricao/Dependencia for every data sheet", () => {
		const wb = XLSX.read(buildWorkbookTemplate("orcamento"), {
			type: "buffer",
		});
		const data = XLSX.utils.sheet_to_json(wb.Sheets.Guia, {
			header: 1,
			defval: "",
		}) as unknown[][];

		expect(
			data.some(
				(row) =>
					row[0] === "Coluna" &&
					row[1] === "Obrigatório" &&
					row[2] === "Tipo" &&
					row[3] === "Exemplo" &&
					row[4] === "Descrição" &&
					row[5] === "Dependência",
			),
		).toBe(true);
		expect(data.some((row) => row[0] === "Índice" && row[1] === "Sim")).toBe(
			true,
		);
		expect(data.some((row) => row[0] === "Situação" && row[1] === "Não")).toBe(
			true,
		);
	});

	it("data sheets have no merged cells", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });
		const dataSheetNames = wb.SheetNames.filter((n) => n !== "Guia");

		for (const sheetName of dataSheetNames) {
			const sheet = wb.Sheets[sheetName];
			expect(sheet["!merges"]).toBeUndefined();
		}
	});

	it("data sheets have freeze panes covering header and example row", () => {
		const sheet = buildDataSheet(
			WORKBOOK_DEFINITIONS["obra-completa"].sheets[1],
		);
		expect(sheet["!freeze"]).toBeDefined();
		expect(sheet["!freeze"]?.ySplit).toBe(2);
	});

	it("data sheets include an example row built from column metadata", () => {
		const sheet = buildDataSheet(WORKBOOK_DEFINITIONS.orcamento.sheets[1]);
		const data = XLSX.utils.sheet_to_json(sheet, {
			header: 1,
			defval: "",
		}) as unknown[][];
		expect(data).toHaveLength(2);
		expect(data[1]?.[0]).toBe("1.1");
		expect(data[1]?.[2]).toBe("Fundação direta");
	});

	it("data sheets have autofilter enabled", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });
		const dataSheetNames = wb.SheetNames.filter((n) => n !== "Guia");

		for (const sheetName of dataSheetNames) {
			const sheet = wb.Sheets[sheetName];
			expect(sheet["!autofilter"]).toBeDefined();
		}
	});

	describe("headers match parser contract", () => {
		it("Obra sheet has Campo/Valor headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets.Obra, {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual(["Campo", "Valor"]);
		});

		it("Orcamento sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets.Orcamento, {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
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
			]);
		});

		it("Itens do Orcamento sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets["Itens do Orcamento"], {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
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
			]);
		});

		it("Cronograma Original sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets["Cronograma Original"], {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Índice",
				"Nome do item",
				"Início previsto",
				"Fim previsto",
				"Peso planejado opcional",
			]);
		});

		it("Replanejamento sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets.Replanejamento, {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Índice",
				"Versão do replanejamento",
				"Início replanejado",
				"Fim replanejado",
				"Data da revisão",
				"Motivo",
			]);
		});

		it("Medicoes Obra sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets["Medicoes Obra"], {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Índice",
				"Nome do item",
				"Data da medição",
				"Percentual medido acumulado",
				"Quantidade medida acumulada",
				"Observação",
			]);
		});

		it("Contrato sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets.Contrato, {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Código",
				"Fornecedor",
				"Valor do Contrato",
				"Tipo de Serviço",
				"Título",
				"Início",
				"Fim",
				"Situação",
				"Observações",
			]);
		});

		it("Servicos sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets.Servicos, {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual(["Índice", "Quantidade", "Custo Unitário"]);
		});

		it("Medicoes Contrato sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets["Medicoes Contrato"], {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Nº",
				"Data",
				"Título",
				"Situação",
				"Desconto",
				"Retenção",
				"Valor de impostos",
				"Observações",
			]);
		});

		it("Pagamentos sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets.Pagamentos, {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Data",
				"Valor",
				"Valor Pago",
				"Descrição",
				"Retenção",
				"Desconto",
				"Situação",
			]);
		});

		it("Custos Realizados sheet has correct headers", () => {
			const buffer = buildWorkbookTemplate("obra-completa");
			const wb = XLSX.read(buffer, { type: "buffer" });
			const data = XLSX.utils.sheet_to_json(wb.Sheets["Custos Realizados"], {
				header: 1,
				defval: "",
			});
			expect(data[0]).toEqual([
				"Data do lançamento",
				"Índice apropriado",
				"Nome do item do orçamento",
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
			]);
		});
	});

	describe("number formats applied to header cells", () => {
		function findSheet(name: string) {
			const sheetDef = WORKBOOK_DEFINITIONS["obra-completa"].sheets.find(
				(s) => s.name === name,
			);
			if (!sheetDef) throw new Error(`Sheet ${name} not found`);
			return sheetDef;
		}

		it("applies #,##0.00 format to quantity column in Orcamento sheet", () => {
			const sheet = buildDataSheet(findSheet("Orcamento"));
			const cellE1 = sheet.E1;
			expect(cellE1).toBeDefined();
			expect(cellE1.s?.numFmt).toBe("#,##0.00");
		});

		it("applies 'R$ #,##0.00' format to money columns in Orcamento sheet", () => {
			const sheet = buildDataSheet(findSheet("Orcamento"));
			const cellF1 = sheet.F1;
			expect(cellF1).toBeDefined();
			expect(cellF1.s?.numFmt).toBe("'R$ #,##0.00'");
		});

		it("applies dd/mm/yyyy format to date columns in Cronograma Original sheet", () => {
			const sheet = buildDataSheet(findSheet("Cronograma Original"));
			const cellC1 = sheet.C1;
			expect(cellC1).toBeDefined();
			expect(cellC1.s?.numFmt).toBe("dd/mm/yyyy");
		});

		it("applies 0% format to percent columns in Medicoes Obra sheet", () => {
			const sheet = buildDataSheet(findSheet("Medicoes Obra"));
			const cellD1 = sheet.D1;
			expect(cellD1).toBeDefined();
			expect(cellD1.s?.numFmt).toBe("0%");
		});

		it("text columns have no numFmt set", () => {
			const sheet = buildDataSheet(findSheet("Orcamento"));
			const cellA1 = sheet.A1;
			expect(cellA1.s?.numFmt).toBeUndefined();
		});

		it("sheets without formats array do not set numFmt", () => {
			const sheet = buildDataSheet(findSheet("Obra"));
			const cellA1 = sheet.A1;
			expect(cellA1.s?.numFmt).toBeUndefined();
		});
	});

	it("every workbook can be round-tripped through xlsx read", () => {
		for (const kind of WORKBOOK_KINDS as WorkbookKind[]) {
			const buffer = buildWorkbookTemplate(kind);
			const wb = XLSX.read(buffer, { type: "buffer" });
			expect(wb.SheetNames.length).toBe(
				WORKBOOK_DEFINITIONS[kind].sheets.length,
			);
		}
	});

	it("headers are in row 1 for all data sheets (Obra sheet)", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });
		const sheet = wb.Sheets.Obra;
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

		const firstRow = data[0] as string[];
		expect(firstRow[0]).toBe("Campo");
		expect(firstRow[1]).toBe("Valor");

		const headerCell = XLSX.utils.decode_cell("A1");
		const cell = sheet[XLSX.utils.encode_cell(headerCell)];
		expect(cell).toBeDefined();
	});

	it("cronograma workbook has correct structure for parser", () => {
		const buffer = buildWorkbookTemplate("cronograma");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toContain("Cronograma Original");
		expect(wb.SheetNames).toContain("Replanejamento");

		const baselineData = XLSX.utils.sheet_to_json(
			wb.Sheets["Cronograma Original"],
			{ header: 1, defval: "" },
		);
		expect(baselineData[0]).toBeDefined();
		const baselineRow0 = baselineData[0] as string[];
		expect(baselineRow0[0]).toBe("Índice");
	});

	it("medicao-obra workbook has correct structure for parser", () => {
		const buffer = buildWorkbookTemplate("medicao-obra");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toContain("Medições de Obra");

		const measurementData = XLSX.utils.sheet_to_json(
			wb.Sheets["Medições de Obra"],
			{ header: 1, defval: "" },
		);
		expect(measurementData[0]).toBeDefined();
		const measurementRow0 = measurementData[0] as string[];
		expect(measurementRow0[0]).toBe("Índice");
	});

	it("medicao-obra contextual workbook lists budget indexes and item names", () => {
		const buffer = buildWorkbookTemplate(
			"medicao-obra",
			{
				"Medicoes Obra": [
					{
						Índice: "1.1",
						"Nome do item": "Escavação",
						"Data da medição": "",
						"Percentual medido acumulado": "",
						"Quantidade medida acumulada": "",
						Observação: "",
					},
				],
			},
			[{ index: "1.1", description: "Escavação" }],
		);
		const wb = XLSX.read(buffer, { type: "buffer" });
		const rows = XLSX.utils.sheet_to_json(wb.Sheets["Medições de Obra"], {
			header: 1,
			defval: "",
		});

		expect(rows[1]).toEqual(["1.1", "Escavação", "", "", "", ""]);

		const budgetRows = XLSX.utils.sheet_to_json(wb.Sheets.Orçamento, {
			header: 1,
			defval: "",
		});
		expect(budgetRows[2]).toEqual(["1.1", "Escavação"]);

		const guideRows = XLSX.utils.sheet_to_json(wb.Sheets.Guia, {
			header: 1,
			defval: "",
		}) as unknown[][];
		const guideText = guideRows.flat().join(" ");
		expect(guideText).toContain("Medições de Obra");
		expect(guideText).toContain("somente para consulta");
		expect(guideText).toContain("30% (ou 0,30)");
		expect(guideText).not.toContain("Referência do orçamento");
	});

	it("medicao-contrato workbook has correct structure for parser", () => {
		const buffer = buildWorkbookTemplate("medicao-contrato");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toContain("Contrato");
		expect(wb.SheetNames).toContain("Servicos");
		expect(wb.SheetNames).toContain("Medicoes Contrato");
		expect(wb.SheetNames).toContain("Pagamentos");

		const contractData = XLSX.utils.sheet_to_json(wb.Sheets.Contrato, {
			header: 1,
			defval: "",
		});
		expect(contractData[0]).toBeDefined();
		const contractRow0 = contractData[0] as string[];
		expect(contractRow0[0]).toBe("Código");
	});

	it("custos workbook has correct structure for parser", () => {
		const buffer = buildWorkbookTemplate("custos");
		const wb = XLSX.read(buffer, { type: "buffer" });
		expect(wb.SheetNames).toContain("Custos Realizados");

		const costData = XLSX.utils.sheet_to_json(wb.Sheets["Custos Realizados"], {
			header: 1,
			defval: "",
		});
		expect(costData[0]).toBeDefined();
		const costRow0 = costData[0] as string[];
		expect(costRow0[0]).toBe("Data do lançamento");
	});
});

describe("IMP-005 largura por conteudo no gerador", () => {
	it("largura da coluna considera valores longos dos dados, nao so o cabecalho", () => {
		const ws = buildStyledSheet(
			"Titulo",
			["Curto", "Longo"],
			[
				["x", "descricao extremamente longa de um item de orcamento"],
				["y", "outra linha"],
			],
		);

		const cols = ws["!cols"];
		expect(cols).toHaveLength(2);
		// Coluna 0: cabecalho "Curto" (6) -> minimo 14.
		expect(cols?.[0]?.wch).toBe(14);
		// Coluna 1: valor mais longo (46 chars + 4) domina o cabecalho.
		expect(cols?.[1]?.wch).toBeGreaterThanOrEqual(46);
	});

	it("largura nunca passa do teto MAX_COL_WIDTH", () => {
		const longValue = "a".repeat(500);
		const ws = buildStyledSheet("Titulo", ["Desc"], [[longValue]]);

		const cols = ws["!cols"];
		expect(cols?.[0]?.wch).toBeLessThanOrEqual(60);
	});

	it("valores nulos nao interferem na largura", () => {
		const ws = buildStyledSheet("Titulo", ["A", "B"], [
			[null, "valor b"],
		] as never[][]);

		const cols = ws["!cols"];
		// Minimo MIN_COL_WIDTH (14) vale para cabecalho e conteudo curto.
		expect(cols?.[0]?.wch).toBe(14);
		expect(cols?.[1]?.wch).toBe(14);
	});
});

describe("IMP-003 (DEC-002/003) mapa de cotacao", () => {
	it("gera o template de cotacao com a aba Mapa de Cotacao", () => {
		const buffer = buildWorkbookTemplate("cotacao");
		const wb = XLSX.read(buffer, { type: "buffer" });

		expect(wb.SheetNames).toContain("Mapa de Cotacao");
	});

	it("o template unificado inclui a aba Mapa de Cotacao", () => {
		const buffer = buildWorkbookTemplate("obra-completa");
		const wb = XLSX.read(buffer, { type: "buffer" });

		expect(wb.SheetNames).toContain("Mapa de Cotacao");
	});

	it("o mapa de cotacao tem as doze colunas canonicas de empreitada", () => {
		const wb = XLSX.read(buildWorkbookTemplate("cotacao"), { type: "buffer" });
		const sheet = wb.Sheets["Mapa de Cotacao"];
		const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

		expect(rows).toContainEqual([
			"CNPJ",
			"Razão Social",
			"Endereço Completo",
			"Telefone",
			"E-mail",
			"Responsável",
			"Descrição do Serviço",
			"Valor do Serviço",
			"Data de Início",
			"Prazo de Execução",
			"Condição de Pagamento",
			"Observações",
		]);

		expect(JSON.stringify(rows)).not.toContain("Código da cotação");
		expect(JSON.stringify(rows)).not.toContain("Vencedor");
		expect(JSON.stringify(rows)).not.toContain("Justificativa");
	});
});
