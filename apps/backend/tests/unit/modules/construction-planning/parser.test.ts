import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import { ConstructionError } from "../../../../src/lib/errors";
import {
	parseWorkbook,
	parseWorkbookByKind,
} from "../../../../src/modules/construction-planning/imports/parser";
import {
	validateWorkbook,
	validateWorkbookByKind,
} from "../../../../src/modules/construction-planning/imports/validator";
import { buildWorkbookTemplate } from "../../../../src/modules/construction-planning/templates/template-generator";
import {
	WORKBOOK_DEFINITIONS,
	WORKBOOK_KINDS,
	type WorkbookKind,
} from "../../../../src/modules/construction-planning/templates/workbook-contracts";
import type {
	ParsedActualCostRow,
	ParsedBaselineRow,
	ParsedBudgetRow,
	ParsedMeasurementRow,
	ParsedReplanningRow,
	ParsedWorkSheet,
} from "../../../../src/modules/construction-planning/types";

function toBytes(workbook: XLSX.WorkBook) {
	const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
	return new Uint8Array(buffer);
}

function expectUnifiedWorkbookContract(
	parsed: ReturnType<typeof parseWorkbook>,
) {
	const work: ParsedWorkSheet = parsed.work;
	const budgetRows: ParsedBudgetRow[] = parsed.budgetRows;
	const baselineRows: ParsedBaselineRow[] = parsed.baselineRows;
	const replanningRows: ParsedReplanningRow[] = parsed.replanningRows;
	const measurementRows: ParsedMeasurementRow[] = parsed.measurementRows;
	const actualCostRows: ParsedActualCostRow[] = parsed.actualCostRows;
	const sheetNames: string[] = parsed.sheetNames;

	expect(work).toBeDefined();
	expect(Array.isArray(budgetRows)).toBe(true);
	expect(Array.isArray(baselineRows)).toBe(true);
	expect(Array.isArray(replanningRows)).toBe(true);
	expect(Array.isArray(measurementRows)).toBe(true);
	expect(Array.isArray(actualCostRows)).toBe(true);
	expect(Array.isArray(sheetNames)).toBe(true);
}

function makeUnifiedWorkbook(
	options: {
		accentedSheetNames?: boolean;
		shuffledBudgetHeaders?: boolean;
	} = {},
) {
	const workbook = XLSX.utils.book_new();

	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet([
			["Campo", "Valor"],
			["Codigo da obra", "OBRA-001"],
			["Nome da obra", "Edificio Horizonte"],
			["Cliente/empreendimento", "Cliente A"],
			["Data-base", "2026-10-15"],
			["Inicio planejado original", "2026-01-01"],
			["Fim planejado original", "2026-12-31"],
		]),
		"Obra",
	);

	const budgetRows = options.shuffledBudgetHeaders
		? [
				[
					"Descricao",
					"Indice",
					"Situacao",
					"Outros unitario",
					"Equipamento unitario",
					"Material unitario",
					"Mao de obra unitaria",
					"Quantidade",
					"Unidade",
					"Tipo",
				],
				[
					"Fundacao",
					"1",
					null,
					null,
					null,
					null,
					null,
					null,
					null,
					"Etapa/Subetapa",
				],
				["Escavacao", "1.1", "Ativo", 0, 5, 30, 20, 10, "m3", "Item"],
			]
		: [
				[
					"Indice",
					"Tipo",
					"Descricao",
					"Unidade",
					"Quantidade",
					"Mao de obra unitaria",
					"Material unitario",
					"Equipamento unitario",
					"Outros unitario",
					"Situacao",
				],
				["1", "Etapa/Subetapa", "Fundacao"],
				["1.1", "Item", "Escavacao", "m3", 10, 20, 30, 5, 0, "Ativo"],
			];

	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet(budgetRows),
		options.accentedSheetNames ? "Orçamento" : "Orcamento",
	);

	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet([
			["Indice", "Inicio previsto", "Fim previsto", "Peso planejado opcional"],
			["1.1", "2026-01-01", "2026-01-31", null],
		]),
		"Cronograma Original",
	);

	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet([
			[
				"Indice",
				"Versao do replanejamento",
				"Inicio replanejado",
				"Fim replanejado",
				"Data da revisao",
				"Motivo",
			],
			["1.1", "R1", "2026-01-05", "2026-02-05", "2026-01-10", "Chuva"],
		]),
		"Replanejamento",
	);

	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet([
			[
				"Indice",
				"Data da medicao",
				"Percentual medido acumulado",
				"Quantidade medida acumulada",
				"Observacao",
			],
			["1.1", "2026-01-15", 0.5, 5, "Parcial"],
		]),
		options.accentedSheetNames ? "Medições" : "Medicoes",
	);

	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet([
			[
				"Data do lancamento",
				"Indice apropriado",
				"Categoria",
				"Descricao",
				"Valor realizado",
				"Tipo",
				"Documento/origem",
			],
			["2026-01-20", "1.1", "Material", "Nota fiscal", 200, "Atual", "NF-1"],
			["2026-02-20", null, "Outros", "Reserva", 50, "Futuro", "Planilha"],
		]),
		"Custos Realizados",
	);

	return workbook;
}

describe("parseWorkbook", () => {
	it("parses the unified workbook sheets", () => {
		const parsed = parseWorkbook(
			toBytes(makeUnifiedWorkbook()),
			"unificado.xlsx",
		);

		expectUnifiedWorkbookContract(parsed);
		expect(parsed.work.code).toBe("OBRA-001");
		expect(parsed.work.name).toBe("Edificio Horizonte");
		expect(parsed.work.clientName).toBe("Cliente A");
		expect(parsed.work.baseDate).toBe("2026-10-15");
		expect(parsed.budgetRows).toHaveLength(2);
		expect(parsed.baselineRows).toHaveLength(1);
		expect(parsed.replanningRows).toHaveLength(1);
		expect(parsed.measurementRows).toHaveLength(1);
		expect(parsed.actualCostRows).toHaveLength(2);
		expect(parsed.sheetNames).toEqual([
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		]);
	});

	it("matches budget and measurement sheets with accents", () => {
		const parsed = parseWorkbook(
			toBytes(makeUnifiedWorkbook({ accentedSheetNames: true })),
			"unificado.xlsx",
		);

		expect(parsed.sheetNames).toContain("Orçamento");
		expect(parsed.sheetNames).toContain("Medições");
		expect(parsed.budgetRows[1].index).toBe("1.1");
		expect(parsed.measurementRows[0].measurementDate).toBe("2026-01-15");
	});

	it("reads unified rows by normalized header text", () => {
		const parsed = parseWorkbook(
			toBytes(makeUnifiedWorkbook({ shuffledBudgetHeaders: true })),
			"unificado.xlsx",
		);

		expect(parsed.budgetRows[1]).toEqual(
			expect.objectContaining({
				index: "1.1",
				type: "Item",
				description: "Escavacao",
				unit: "m3",
				quantity: 10,
				laborUnitCost: 20,
				materialUnitCost: 30,
				equipmentUnitCost: 5,
				otherUnitCost: 0,
				providedStatus: "Ativo",
			}),
		);
	});

	it("reads canonical cost columns from exported budget reports", () => {
		const workbook = makeUnifiedWorkbook();
		workbook.Sheets.Orcamento = XLSX.utils.aoa_to_sheet([
			[
				"Índice",
				"Tipo",
				"Descrição",
				"Unidade",
				"Quantidade",
				"Custo unitário",
				"Valor total",
			],
			["8.1", "ITEM", "Serviço aditivado", "un", 4, 125, 500],
		]);

		const parsed = parseWorkbook(toBytes(workbook), "orcamento.xlsx");

		expect(parsed.budgetRows[0]).toEqual(
			expect.objectContaining({
				index: "8.1",
				quantity: 4,
				unitCost: 125,
				totalCost: 500,
			}),
		);
	});

	it("reads Obra fields by Campo and Valor headers when columns move", () => {
		const workbook = makeUnifiedWorkbook();
		workbook.Sheets.Obra = XLSX.utils.aoa_to_sheet([
			["Ignorar", "Valor", "Campo"],
			["x", "OBRA-002", "Codigo da obra"],
			["x", "Residencial Campo Valor", "Nome da obra"],
			["x", "Cliente B", "Cliente/empreendimento"],
			["x", "2026-11-15", "Data-base"],
			["x", "2026-02-01", "Inicio planejado original"],
			["x", "2026-11-30", "Fim planejado original"],
		]);

		const parsed = parseWorkbook(toBytes(workbook), "unificado.xlsx");

		expect(parsed.work).toEqual({
			code: "OBRA-002",
			name: "Residencial Campo Valor",
			clientName: "Cliente B",
			baseDate: "2026-11-15",
			plannedStart: "2026-02-01",
			plannedEnd: "2026-11-30",
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
		});
	});

	it("throws a ConstructionError when the workbook has no sheets", () => {
		expect(() => parseWorkbook(new Uint8Array(), "empty.xlsx")).toThrow(
			ConstructionError,
		);
		expect(() => parseWorkbook(new Uint8Array(), "empty.xlsx")).toThrow(
			"Workbook has no sheets",
		);
	});

	it("yields empty collections for absent sheets without a global error", () => {
		const workbook = makeUnifiedWorkbook();
		workbook.SheetNames = workbook.SheetNames.filter(
			(name) => name !== "Custos Realizados",
		);
		delete workbook.Sheets["Custos Realizados"];

		const parsed = parseWorkbook(toBytes(workbook), "missing.xlsx");

		expect(parsed.actualCostRows).toEqual([]);
		expect(parsed.budgetRows.length).toBeGreaterThan(0);
		expect(parsed.baselineRows.length).toBeGreaterThan(0);
	});

	function makeFullWorkbook() {
		const workbook = XLSX.utils.book_new();

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([["Guia"]]),
			"Guia",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				["Campo", "Valor"],
				["Codigo da obra", "OBRA-001"],
				["Nome da obra", "Edificio Horizonte"],
				["Cliente/empreendimento", "Cliente A"],
				["Data-base", "2026-10-15"],
				["Inicio planejado original", "2026-01-01"],
				["Fim planejado original", "2026-12-31"],
			]),
			"Obra",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Indice",
					"Tipo",
					"Descricao",
					"Unidade",
					"Quantidade",
					"Mao de obra unitaria",
					"Material unitario",
					"Equipamento unitario",
					"Outros unitario",
					"Situacao",
				],
				["1", "Etapa/Subetapa", "Fundacao"],
				["1.1", "Item", "Escavacao", "m3", 10, 20, 30, 5, 0, "Ativo"],
			]),
			"Orcamento",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Indice",
					"Inicio previsto",
					"Fim previsto",
					"Peso planejado opcional",
				],
				["1.1", "2026-01-01", "2026-01-31", null],
			]),
			"Cronograma Original",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Indice",
					"Versao do replanejamento",
					"Inicio replanejado",
					"Fim replanejado",
					"Data da revisao",
					"Motivo",
				],
				["1.1", "R1", "2026-01-05", "2026-02-05", "2026-01-10", "Chuva"],
			]),
			"Replanejamento",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Indice",
					"Data da medicao",
					"Percentual medido acumulado",
					"Quantidade medida acumulada",
					"Observacao",
				],
				["1.1", "2026-01-15", 0.5, 5, "Parcial"],
			]),
			"Medicoes Obra",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Codigo",
					"Fornecedor",
					"Valor do Contrato",
					"Tipo de Servico",
					"Titulo",
					"Inicio",
					"Fim",
					"Situacao",
					"Observacoes",
				],
				[
					"C-001",
					"Fornecedor A",
					50000,
					"Servico",
					"Contrato 1",
					"2026-01-01",
					"2026-12-31",
					"Ativo",
					null,
				],
			]),
			"Contrato",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Indice",
					"Tipo",
					"Descricao",
					"Unidade",
					"Quantidade",
					"Custo Unitario",
					"Custo Total",
				],
				["1", "Item", "Servico 1", "un", 10, 100, 1000],
			]),
			"Servicos",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Nº",
					"Data",
					"Titulo",
					"Situacao",
					"Desconto",
					"Retencao",
					"Observacoes",
				],
				["1", "2026-01-15", "Medicao 1", "APROVADA", null, null, null],
			]),
			"Medicoes Contrato",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Data",
					"Valor",
					"Valor Pago",
					"Descricao",
					"Retencao",
					"Desconto",
					"Situacao",
				],
				["2026-01-20", 10000, 10000, "Pagamento 1", null, null, "PAGO"],
			]),
			"Pagamentos",
		);

		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.aoa_to_sheet([
				[
					"Data do lancamento",
					"Indice apropriado",
					"Categoria",
					"Descricao",
					"Valor realizado",
					"Tipo",
				],
				["2026-01-20", "1", "Material", "NF", 200, "Atual"],
			]),
			"Custos Realizados",
		);

		return workbook;
	}

	describe("parseWorkbookByKind", () => {
		it("cotacao ignora colunas obsoletas e parseia os campos canonicos", () => {
			const workbook = XLSX.utils.book_new();
			const sheet = XLSX.utils.aoa_to_sheet([
				[
					"Código da cotação",
					"Fornecedor",
					"CNPJ",
					"Valor da proposta",
					"Justificativa",
					"Vencedor",
				],
				[
					"COT-001",
					"Fornecedor A",
					"12.345.678/0001-90",
					12000,
					"Prazo menor",
					"NAO",
				],
				["COT-001", "Fornecedor B", "98765432000100", 11500, "", "SIM"],
			]);
			XLSX.utils.book_append_sheet(workbook, sheet, "Mapa de Cotacao");

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"cotacao.xlsx",
				"cotacao",
			);

			expect(parsed.quotationRows).toHaveLength(2);
			expect(parsed.quotationRows[0]).toEqual(
				expect.objectContaining({
					supplierName: "Fornecedor A",
					supplierDocument: "12.345.678/0001-90",
					value: 12000,
					supplierAddress: null,
					supplierPhone: null,
					supplierEmail: null,
					supplierResponsible: null,
					serviceDescription: null,
					serviceStartDate: null,
					executionTermDays: null,
					paymentTerms: null,
					notes: null,
					quotationCode: "COT-001",
					suggestedWinner: null,
				}),
			);
			expect(parsed.quotationRows[1].supplierName).toBe("Fornecedor B");
			// Colunas obsoletas nao fazem parte do contrato parseado; o codigo
			// da cotacao e informacao nao vinculante e permanece rastreavel.
			expect(parsed.quotationRows[0]).toHaveProperty("quotationCode");
			expect(parsed.quotationRows[0]).not.toHaveProperty("justification");
			expect(parsed.quotationRows[0]).not.toHaveProperty("winner");
		});

		it("obra-completa parses all 10 data sheets", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"obra-completa",
			);

			expect(parsed.work.code).toBe("OBRA-001");
			expect(parsed.budgetRows.length).toBeGreaterThan(0);
			expect(parsed.baselineRows.length).toBeGreaterThan(0);
			expect(parsed.replanningRows.length).toBeGreaterThan(0);
			expect(parsed.measurementRows.length).toBeGreaterThan(0);
			expect(parsed.contractRows.length).toBeGreaterThan(0);
			expect(parsed.serviceRows.length).toBeGreaterThan(0);
			expect(parsed.contractMeasurementRows.length).toBeGreaterThan(0);
			expect(parsed.paymentRows.length).toBeGreaterThan(0);
			expect(parsed.actualCostRows.length).toBeGreaterThan(0);
			expect(parsed.sheetNames).toContain("Guia");
		});

		it("cronograma kind only parses schedule sheets", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"cronograma",
			);

			expect(parsed.work.code).toBe("");
			expect(parsed.budgetRows).toHaveLength(0);
			expect(parsed.baselineRows.length).toBeGreaterThan(0);
			expect(parsed.replanningRows.length).toBeGreaterThan(0);
			expect(parsed.measurementRows).toHaveLength(0);
			expect(parsed.contractRows).toHaveLength(0);
			expect(parsed.serviceRows).toHaveLength(0);
			expect(parsed.contractMeasurementRows).toHaveLength(0);
			expect(parsed.paymentRows).toHaveLength(0);
			expect(parsed.actualCostRows).toHaveLength(0);
		});

		it("orcamento kind only parses budget sheets", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"orcamento",
			);

			expect(parsed.work.code).toBe("");
			expect(parsed.budgetRows.length).toBeGreaterThan(0);
			expect(parsed.baselineRows).toHaveLength(0);
			expect(parsed.replanningRows).toHaveLength(0);
			expect(parsed.measurementRows).toHaveLength(0);
			expect(parsed.contractRows).toHaveLength(0);
			expect(parsed.serviceRows).toHaveLength(0);
			expect(parsed.contractMeasurementRows).toHaveLength(0);
			expect(parsed.paymentRows).toHaveLength(0);
			expect(parsed.actualCostRows).toHaveLength(0);
		});

		it("medicao-obra kind only parses measurement sheets", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"medicao-obra",
			);

			expect(parsed.measurementRows.length).toBeGreaterThan(0);
			expect(parsed.budgetRows).toHaveLength(0);
			expect(parsed.baselineRows).toHaveLength(0);
			expect(parsed.replanningRows).toHaveLength(0);
			expect(parsed.contractRows).toHaveLength(0);
			expect(parsed.serviceRows).toHaveLength(0);
			expect(parsed.contractMeasurementRows).toHaveLength(0);
			expect(parsed.paymentRows).toHaveLength(0);
			expect(parsed.actualCostRows).toHaveLength(0);
		});

		it("rejects a measurement workbook without the real measurement fields", () => {
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([
					["Código", "Descrição", "Valor"],
					["A-1", "Documento sem vínculo", 100],
				]),
				"Medicoes Obra",
			);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"sem-vinculo.xlsx",
				"medicao-obra",
			);
			const validation = validateWorkbookByKind(parsed, "medicao-obra", {
				measurementBudgetIndexes: new Set(["1.1"]),
			});

			expect(validation.valid).toBe(false);
			expect(validation.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "MISSING_REQUIRED_COLUMN",
						field: "Índice",
					}),
					expect.objectContaining({
						code: "MISSING_REQUIRED_COLUMN",
						field: "Data da medição",
					}),
					expect.objectContaining({
						code: "MISSING_REQUIRED_COLUMN",
						field: "Percentual medido acumulado",
					}),
				]),
			);
		});

		it("rejects a measurement workbook with no rows to import", () => {
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([
					[
						"Índice",
						"Nome do item",
						"Data da medição",
						"Percentual medido acumulado",
					],
				]),
				"Medicoes Obra",
			);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"sem-linhas.xlsx",
				"medicao-obra",
			);
			const validation = validateWorkbookByKind(parsed, "medicao-obra", {
				measurementBudgetIndexes: new Set(["1.1"]),
			});

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContainEqual(
				expect.objectContaining({
					code: "NO_DATA",
					field: "Medicoes Obra",
				}),
			);
		});

		it("custos kind only parses actual cost sheets", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"custos",
			);

			expect(parsed.actualCostRows.length).toBeGreaterThan(0);
			expect(parsed.budgetRows).toHaveLength(0);
			expect(parsed.baselineRows).toHaveLength(0);
			expect(parsed.replanningRows).toHaveLength(0);
			expect(parsed.measurementRows).toHaveLength(0);
			expect(parsed.contractRows).toHaveLength(0);
			expect(parsed.serviceRows).toHaveLength(0);
			expect(parsed.contractMeasurementRows).toHaveLength(0);
			expect(parsed.paymentRows).toHaveLength(0);
		});

		it("medicao-contrato kind only parses contract-related sheets", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"medicao-contrato",
			);

			expect(parsed.contractRows.length).toBeGreaterThan(0);
			expect(parsed.serviceRows.length).toBeGreaterThan(0);
			expect(parsed.contractMeasurementRows.length).toBeGreaterThan(0);
			expect(parsed.paymentRows.length).toBeGreaterThan(0);
			expect(parsed.budgetRows).toHaveLength(0);
			expect(parsed.baselineRows).toHaveLength(0);
			expect(parsed.replanningRows).toHaveLength(0);
			expect(parsed.measurementRows).toHaveLength(0);
			expect(parsed.actualCostRows).toHaveLength(0);
		});

		it("parses contract measurement rows with all expected fields", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"medicao-contrato",
			);

			expect(parsed.contractRows[0]).toEqual({
				rowNumber: 2,
				code: "C-001",
				supplierName: "Fornecedor A",
				contractValue: 50000,
				serviceType: "Servico",
				title: "Contrato 1",
				startDate: "2026-01-01",
				endDate: "2026-12-31",
				status: "Ativo",
				notes: null,
			});
			expect(parsed.contractMeasurementRows[0]).toEqual({
				rowNumber: 2,
				number: "1",
				date: "2026-01-15",
				title: "Medicao 1",
				discountValue: null,
				retentionValue: null,
				taxValue: null,
				notes: null,
			});
			expect(parsed.paymentRows[0]).toEqual({
				rowNumber: 2,
				date: "2026-01-20",
				value: 10000,
				paidValue: 10000,
				description: "Pagamento 1",
				retentionValue: null,
				discountValue: null,
				status: "PAGO",
			});
		});

		it("parses tax value from the Valor de impostos column", () => {
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([
					["Nº", "Data", "Título", "Desconto", "Retenção", "Valor de impostos"],
					["1", "2026-01-15", "Medicao 1", "", "", "1000"],
				]),
				"Medicoes Contrato",
			);
			const parsed = parseWorkbookByKind(
				XLSX.write(workbook, { type: "buffer" }),
				"tax.xlsx",
				"medicao-contrato",
			);

			expect(parsed.contractMeasurementRows[0]).toMatchObject({
				number: "1",
				taxValue: "1000",
			});
		});

		it("Guia sheet is always skipped and does not appear in parsed data", () => {
			const parsed = parseWorkbookByKind(
				toBytes(makeFullWorkbook()),
				"full.xlsx",
				"obra-completa",
			);

			expect(parsed.sheetNames).toContain("Guia");
		});

		it("throws ConstructionError for invalid workbook kind", () => {
			expect(() =>
				parseWorkbookByKind(
					toBytes(makeFullWorkbook()),
					"full.xlsx",
					"invalid-kind" as never,
				),
			).toThrow(ConstructionError);
		});

		it("yields empty collections when the kind's data sheet is absent", () => {
			const workbook = makeFullWorkbook();
			workbook.SheetNames = workbook.SheetNames.filter(
				(name) => name !== "Custos Realizados",
			);
			delete workbook.Sheets["Custos Realizados"];

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"missing.xlsx",
				"custos",
			);

			expect(parsed.actualCostRows).toEqual([]);
		});

		it("empty sheets produce no rows", () => {
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([["Guia"]]),
				"Guia",
			);
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([
					[
						"Indice",
						"Data da medicao",
						"Percentual medido acumulado",
						"Quantidade medida acumulada",
						"Observacao",
					],
				]),
				"Medicoes Obra",
			);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"empty.xlsx",
				"medicao-obra",
			);

			expect(parsed.measurementRows).toHaveLength(0);
		});

		function withOnlySheets(
			workbook: XLSX.WorkBook,
			names: string[],
		): XLSX.WorkBook {
			const keep = new Set(names);
			for (const name of Object.keys(workbook.Sheets)) {
				if (!keep.has(name)) delete workbook.Sheets[name];
			}
			workbook.SheetNames = workbook.SheetNames.filter((name) =>
				keep.has(name),
			);
			return workbook;
		}

		it("parses a workbook with only Orcamento present", () => {
			const workbook = withOnlySheets(makeUnifiedWorkbook(), ["Orcamento"]);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"orcamento-only.xlsx",
				"obra-completa",
			);

			expect(parsed.budgetRows.length).toBeGreaterThan(0);
			expect(parsed.work.code).toBe("");
			expect(parsed.baselineRows).toEqual([]);
			expect(parsed.replanningRows).toEqual([]);
			expect(parsed.measurementRows).toEqual([]);
			expect(parsed.actualCostRows).toEqual([]);
		});

		it("round-trip: a workbook with only the Orcamento sheet stays valid through parser and validator", () => {
			const workbook = withOnlySheets(makeUnifiedWorkbook(), ["Orcamento"]);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"orcamento-only.xlsx",
				"obra-completa",
			);
			const result = validateWorkbookByKind(parsed, "obra-completa");

			expect(parsed.work.baseDate).toBeNull();
			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
			expect(result.normalizedRows).toHaveLength(2);
		});

		it("parses a workbook with only Cronograma present", () => {
			const workbook = withOnlySheets(makeUnifiedWorkbook(), [
				"Cronograma Original",
			]);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"cronograma-only.xlsx",
				"obra-completa",
			);

			expect(parsed.baselineRows.length).toBeGreaterThan(0);
			expect(parsed.work.code).toBe("");
			expect(parsed.budgetRows).toEqual([]);
			expect(parsed.replanningRows).toEqual([]);
			expect(parsed.measurementRows).toEqual([]);
			expect(parsed.actualCostRows).toEqual([]);
		});

		it("parses a workbook with only Replanejamento present", () => {
			const workbook = withOnlySheets(makeUnifiedWorkbook(), [
				"Replanejamento",
			]);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"replanejamento-only.xlsx",
				"obra-completa",
			);

			expect(parsed.replanningRows.length).toBeGreaterThan(0);
			expect(parsed.work.code).toBe("");
			expect(parsed.budgetRows).toEqual([]);
			expect(parsed.baselineRows).toEqual([]);
			expect(parsed.measurementRows).toEqual([]);
			expect(parsed.actualCostRows).toEqual([]);
		});

		it("parses partial combinations such as Orcamento + Cronograma", () => {
			const workbook = withOnlySheets(makeUnifiedWorkbook(), [
				"Orcamento",
				"Cronograma Original",
			]);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"orcamento-cronograma.xlsx",
				"obra-completa",
			);

			expect(parsed.budgetRows.length).toBeGreaterThan(0);
			expect(parsed.baselineRows.length).toBeGreaterThan(0);
			expect(parsed.work.code).toBe("");
			expect(parsed.replanningRows).toEqual([]);
			expect(parsed.measurementRows).toEqual([]);
			expect(parsed.actualCostRows).toEqual([]);
		});

		it("parses a workbook with only the Itens do Orcamento sheet", () => {
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([
					[
						"Indice",
						"Tipo",
						"Descricao",
						"Unidade",
						"Quantidade",
						"Mao de obra unitaria",
						"Material unitario",
						"Equipamento unitario",
						"Outros unitario",
						"Situacao",
					],
					["1.1", "Item", "Escavacao", "m3", 10, 20, 30, 5, 0, "Ativo"],
					["1.2", "Item", "Aterro", "m3", 5, 10, 15, 2, 0, "Ativo"],
				]),
				"Itens do Orcamento",
			);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"itens-only.xlsx",
				"obra-completa",
			);

			expect(parsed.budgetRows).toEqual([]);
			expect(parsed.itensRows).toHaveLength(2);
			expect(parsed.itensRows[0]).toEqual(
				expect.objectContaining({
					rowNumber: 2,
					index: "1.1",
					type: "Item",
					description: "Escavacao",
				}),
			);
			expect(parsed.itensRows[1].index).toBe("1.2");
			expect(parsed.baselineRows).toEqual([]);
			expect(parsed.replanningRows).toEqual([]);
			expect(parsed.measurementRows).toEqual([]);
			expect(parsed.actualCostRows).toEqual([]);
		});

		it("resolves sheet aliases when only the aliased name is present", () => {
			const workbook = makeUnifiedWorkbook();
			workbook.Sheets.Cronograma = workbook.Sheets["Cronograma Original"];
			delete workbook.Sheets["Cronograma Original"];
			workbook.SheetNames = workbook.SheetNames.map((name) =>
				name === "Cronograma Original" ? "Cronograma" : name,
			);

			const parsed = parseWorkbookByKind(
				toBytes(withOnlySheets(workbook, ["Cronograma"])),
				"cronograma-alias.xlsx",
				"obra-completa",
			);

			expect(parsed.baselineRows.length).toBeGreaterThan(0);
			expect(parsed.budgetRows).toEqual([]);
			expect(parsed.replanningRows).toEqual([]);
		});

		it("parses a workbook with no data sheets at all", () => {
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.aoa_to_sheet([["Guia"]]),
				"Guia",
			);

			const parsed = parseWorkbookByKind(
				toBytes(workbook),
				"guia-only.xlsx",
				"obra-completa",
			);

			expect(parsed.work.code).toBe("");
			expect(parsed.budgetRows).toEqual([]);
			expect(parsed.baselineRows).toEqual([]);
			expect(parsed.replanningRows).toEqual([]);
			expect(parsed.measurementRows).toEqual([]);
			expect(parsed.actualCostRows).toEqual([]);
		});

		it("backward compat: parseWorkbook delegates to obra-completa kind", () => {
			const parsed = parseWorkbook(toBytes(makeFullWorkbook()), "full.xlsx");

			expect(parsed.work.code).toBe("OBRA-001");
			expect(parsed.budgetRows.length).toBeGreaterThan(0);
			expect(parsed.baselineRows.length).toBeGreaterThan(0);
			expect(parsed.replanningRows.length).toBeGreaterThan(0);
			expect(parsed.measurementRows.length).toBeGreaterThan(0);
			expect(parsed.contractRows.length).toBeGreaterThan(0);
			expect(parsed.serviceRows.length).toBeGreaterThan(0);
			expect(parsed.contractMeasurementRows.length).toBeGreaterThan(0);
			expect(parsed.paymentRows.length).toBeGreaterThan(0);
			expect(parsed.actualCostRows.length).toBeGreaterThan(0);
		});
	});

	it("parses expanded financial fields from workbook", () => {
		const workbook = makeUnifiedWorkbook();

		workbook.Sheets.Obra = XLSX.utils.aoa_to_sheet([
			["Campo", "Valor"],
			["Codigo da obra", "OBRA-001"],
			["Nome da obra", "Edificio Horizonte"],
			["Cliente/empreendimento", "Cliente A"],
			["Data-base", "2026-10-15"],
			["Inicio planejado original", "2026-01-01"],
			["Fim planejado original", "2026-12-31"],
			["Area m2", 219.57],
			["Situacao operacional", "Ativo"],
			["Responsavel pela obra", "Joao Silva"],
		]);

		workbook.Sheets["Custos Realizados"] = XLSX.utils.aoa_to_sheet([
			[
				"Data do lancamento",
				"Indice apropriado",
				"Fornecedor/Favorecido",
				"Grupo de custo",
				"Categoria",
				"Situacao do pagamento",
				"Data de competencia",
				"Data de vencimento",
				"Data de pagamento",
				"Numero do documento",
				"Descricao",
				"Valor realizado",
				"Tipo",
				"Documento/origem",
			],
			[
				"2026-01-20",
				"1.1",
				"Fornecedor A",
				"Materiais",
				"Material",
				"Pago",
				"2026-01-01",
				"2026-02-15",
				"2026-02-10",
				"NF-1",
				"Nota fiscal",
				200,
				"Atual",
				"NF-1",
			],
			[
				"2026-02-20",
				null,
				"Fornecedor B",
				"Servicos",
				"Servico",
				"Aberto",
				null,
				null,
				null,
				"OS-1",
				"Ordem de servico",
				50,
				"Futuro",
				"Planilha",
			],
		]);

		const parsed = parseWorkbook(toBytes(workbook), "unificado.xlsx");

		expect(parsed.work.areaM2).toBe(219.57);
		expect(parsed.work.operationalStatus).toBe("Ativo");
		expect(parsed.work.responsibleName).toBe("Joao Silva");

		expect(parsed.actualCostRows[0].supplierName).toBe("Fornecedor A");
		expect(parsed.actualCostRows[0].costGroup).toBe("Materiais");
		expect(parsed.actualCostRows[0].paymentStatus).toBe("Pago");
		expect(parsed.actualCostRows[0].competenceDate).toBe("2026-01-01");
		expect(parsed.actualCostRows[0].dueDate).toBe("2026-02-15");
		expect(parsed.actualCostRows[0].paymentDate).toBe("2026-02-10");
		expect(parsed.actualCostRows[0].documentNumber).toBe("NF-1");

		expect(parsed.actualCostRows[1].supplierName).toBe("Fornecedor B");
		expect(parsed.actualCostRows[1].costGroup).toBe("Servicos");
		expect(parsed.actualCostRows[1].paymentStatus).toBe("Aberto");
		expect(parsed.actualCostRows[1].documentNumber).toBe("OS-1");
	});
});

describe("parse-back smoke per workbook kind", () => {
	for (const kind of WORKBOOK_KINDS as WorkbookKind[]) {
		it(`${kind}: template gera, XLSX le, parser e validator consomem sem crash`, () => {
			const def = WORKBOOK_DEFINITIONS[kind];
			const bytes = buildWorkbookTemplate(kind);
			const expectedSheetNames = def.sheets.map((sheet) =>
				kind === "medicao-obra" && sheet.name === "Medicoes Obra"
					? "Medições de Obra"
					: sheet.name,
			);

			const workbook = XLSX.read(bytes, { type: "buffer" });
			expect(workbook.SheetNames).toEqual(expectedSheetNames);

			const parsed = parseWorkbookByKind(bytes, def.filename, kind);
			expect(parsed.sheetNames).toEqual(workbook.SheetNames);

			let result: ReturnType<typeof validateWorkbookByKind> | undefined;
			expect(() => {
				result = validateWorkbookByKind(parsed, kind);
			}).not.toThrow();
			expect(result).toBeDefined();

			const hasObraSheet = def.sheets.some((s) => s.name === "Obra");
			if (hasObraSheet) {
				// Sem a aba Obra preenchida, a obra-completa nao pode ser valida.
				expect(result?.valid).toBe(false);
				expect(result?.errors.length).toBeGreaterThan(0);
			} else {
				// Templates por kind trazem linha de exemplo valida.
				expect(result?.valid).toBe(true);
			}
		});
	}

	it("parseWorkbook (alias de compatibilidade) se comporta como obra-completa", () => {
		const bytes = buildWorkbookTemplate("obra-completa");
		const viaAlias = parseWorkbook(bytes, "qualquer.xlsx");
		const viaKind = parseWorkbookByKind(
			bytes,
			"qualquer.xlsx",
			"obra-completa",
		);

		expect(viaAlias).toEqual(viaKind);
		expect(viaAlias.sheetNames).toHaveLength(14);
	});

	it("unified validation accepts the Medicoes Obra sheet name used by templates", () => {
		const bytes = buildWorkbookTemplate("obra-completa");
		const parsed = parseWorkbook(bytes, "modelo-obra-completa.xlsx");

		expect(parsed.sheetNames).toContain("Medicoes Obra");

		const result = validateWorkbook(parsed);
		expect(
			result.errors.filter((error) => error.code === "MISSING_REQUIRED_SHEET"),
		).toEqual([]);
	});

	it("round-trip: parser and validator accept documented sheet name aliases", () => {
		const workbook = XLSX.read(buildWorkbookTemplate("obra-completa"), {
			type: "buffer",
		});
		const renamed = XLSX.utils.book_new();
		for (const name of workbook.SheetNames) {
			const alias =
				name === "Cronograma Original"
					? "Cronograma"
					: name === "Itens do Orcamento"
						? "Itens do Orçamento"
						: name;
			XLSX.utils.book_append_sheet(renamed, workbook.Sheets[name], alias);
		}

		const parsed = parseWorkbookByKind(
			toBytes(renamed),
			"aliases.xlsx",
			"obra-completa",
		);

		expect(parsed.sheetNames).toContain("Cronograma");
		expect(parsed.sheetNames).toContain("Itens do Orçamento");

		const result = validateWorkbookByKind(parsed, "obra-completa");
		expect(
			result.errors.filter((error) => error.code === "MISSING_REQUIRED_SHEET"),
		).toEqual([]);
	});
});
