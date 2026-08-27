import { describe, expect, it } from "bun:test";
import {
	validateWorkbook,
	validateWorkbookByKind,
} from "../../../../src/modules/construction-planning/imports/validator";
import {
	normalizeContractMeasurementRows,
	normalizeContractPaymentRows,
	normalizeContractRows,
	normalizeContractServiceRows,
} from "../../../../src/modules/construction-planning/imports/validators/contract-measurement.validator";
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
	ParsedWorkbook,
	ParsedWorkSheet,
} from "../../../../src/modules/construction-planning/types";

function makeContractWorkbook(
	overrides: {
		contractRows?: ParsedContractRow[];
		serviceRows?: ParsedServiceRow[];
		contractMeasurementRows?: ParsedContractMeasurementRow[];
		paymentRows?: ParsedPaymentRow[];
	} = {},
): ParsedWorkbook {
	return {
		fileName: "medicao-contrato.xlsx",
		sheetName: "medicao-contrato.xlsx",
		header: {
			workName: "",
			workCode: "",
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
		},
		work: {
			code: "",
			name: "",
			clientName: null,
			baseDate: null,
			plannedStart: null,
			plannedEnd: null,
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
		},
		budgetRows: [],
		itensRows: [],
		baselineRows: [],
		replanningRows: [],
		measurementRows: [],
		contractRows: overrides.contractRows ?? [],
		serviceRows: overrides.serviceRows ?? [],
		contractMeasurementRows: overrides.contractMeasurementRows ?? [],
		paymentRows: overrides.paymentRows ?? [],
		actualCostRows: [],
		quotationRows: [],
		sheetNames: [
			"Guia",
			"Contrato",
			"Servicos",
			"Medicoes Contrato",
			"Pagamentos",
		],
	};
}

function makeParsedUnifiedWorkbook(
	overrides: {
		budgetRows?: ParsedBudgetRow[];
		itensRows?: ParsedBudgetRow[];
		baselineRows?: ParsedBaselineRow[];
		replanningRows?: ParsedReplanningRow[];
		measurementRows?: ParsedMeasurementRow[];
		contractRows?: ParsedContractRow[];
		serviceRows?: ParsedServiceRow[];
		contractMeasurementRows?: ParsedContractMeasurementRow[];
		paymentRows?: ParsedPaymentRow[];
		actualCostRows?: ParsedActualCostRow[];
		quotationRows?: Array<
			Partial<ParsedQuotationRow> & {
				rowNumber: number;
				value: unknown;
			}
		>;
		sheetNames?: string[];
		work?: Partial<ParsedWorkSheet>;
	} = {},
): ParsedWorkbook {
	function makeQuotationRow(
		row: Partial<ParsedQuotationRow> & { rowNumber: number },
	): ParsedQuotationRow {
		const defaults: ParsedQuotationRow = {
			rowNumber: row.rowNumber,
			supplierName: null,
			supplierDocument: null,
			value: null,
			supplierAddress: null,
			supplierPhone: null,
			supplierEmail: null,
			supplierResponsible: null,
			serviceDescription: null,
			serviceStartDate: null,
			executionTermDays: null,
			paymentTerms: null,
			notes: null,
			quotationCode: null,
			suggestedWinner: null,
		};
		return { ...defaults, ...row } as ParsedQuotationRow;
	}

	const budgetRows = overrides.budgetRows ?? [
		{
			rowNumber: 2,
			index: "1",
			type: "Etapa/Subetapa",
			description: "Fundacao",
			unit: null,
			quantity: null,
			laborUnitCost: null,
			materialUnitCost: null,
			equipmentUnitCost: null,
			otherUnitCost: null,
			providedStatus: null,
		},
		{
			rowNumber: 3,
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
		},
	];

	return {
		fileName: "unificado.xlsx",
		sheetName: "Orcamento",
		header: {
			workName: "Edificio Horizonte",
			workCode: "OBRA-001",
			plannedStart: new Date("2026-01-01"),
			plannedEnd: new Date("2026-12-31"),
			baseDate: new Date("2026-10-15"),
		},
		work: {
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: "Cliente A",
			baseDate: "2026-10-15",
			plannedStart: "2026-01-01",
			plannedEnd: "2026-12-31",
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
			...overrides.work,
		},
		budgetRows,
		itensRows: overrides.itensRows ?? [],
		baselineRows: overrides.baselineRows ?? [
			{
				rowNumber: 2,
				index: "1.1",
				plannedStart: "2026-01-01",
				plannedEnd: "2026-01-31",
				plannedWeight: null,
			},
		],
		replanningRows: overrides.replanningRows ?? [
			{
				rowNumber: 2,
				index: "1.1",
				version: "R1",
				replannedStart: "2026-01-05",
				replannedEnd: "2026-02-05",
				revisionDate: "2026-01-10",
				reason: "Chuva",
			},
		],
		measurementRows: overrides.measurementRows ?? [
			{
				rowNumber: 2,
				index: "1.1",
				measurementDate: "2026-01-15",
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: 5,
				notes: "Parcial",
			},
		],
		contractRows: overrides.contractRows ?? [],
		serviceRows: overrides.serviceRows ?? [],
		contractMeasurementRows: overrides.contractMeasurementRows ?? [],
		paymentRows: overrides.paymentRows ?? [],
		actualCostRows: overrides.actualCostRows ?? [
			{
				rowNumber: 2,
				costDate: "2026-01-20",
				budgetIndex: "1.1",
				category: "Material",
				description: "Nota fiscal",
				amount: 200,
				costType: "Atual",
				sourceDocument: "NF-1",
				supplierName: null,
				costGroup: null,
				paymentStatus: null,
				competenceDate: null,
				dueDate: null,
				paymentDate: null,
				documentNumber: null,
			},
		],
		quotationRows: (overrides.quotationRows ?? []).map((row) =>
			makeQuotationRow(row),
		),
		sheetNames: overrides.sheetNames ?? [
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		],
	};
}

describe("validate quotation workbook", () => {
	it("rejects quotation rows without supplier or positive proposal value", () => {
		const result = validateWorkbookByKind(
			makeParsedUnifiedWorkbook({
				quotationRows: [
					{
						rowNumber: 2,
						supplierName: null,
						supplierDocument: null,
						value: null,
					},
				],
				sheetNames: ["Mapa de Cotacao"],
			}),
			"cotacao",
		);

		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ field: "Razão Social" }),
				expect.objectContaining({ field: "Valor do Serviço" }),
			]),
		);
	});

	it("rejects missing, invalid, and duplicate supplier CNPJs", () => {
		const result = validateWorkbookByKind(
			makeParsedUnifiedWorkbook({
				quotationRows: [
					{
						rowNumber: 2,
						supplierName: "Fornecedor A",
						supplierDocument: null,
						value: 100,
					},
					{
						rowNumber: 3,
						supplierName: "Fornecedor B",
						supplierDocument: "123",
						value: 200,
					},
					{
						rowNumber: 4,
						supplierName: "Fornecedor C",
						supplierDocument: "12345678000195",
						value: 300,
					},
					{
						rowNumber: 5,
						supplierName: "Fornecedor D",
						supplierDocument: "12345678000195",
						value: 400,
					},
				],
				sheetNames: ["Mapa de Cotacao"],
			}),
			"cotacao",
		);

		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "SUPPLIER_DOCUMENT_REQUIRED",
					row: 2,
				}),
				expect.objectContaining({ code: "INVALID_CNPJ", row: 3 }),
				expect.objectContaining({
					code: "DUPLICATE_SUPPLIER_DOCUMENT",
					row: 5,
				}),
			]),
		);
	});

	it("rejects invalid execution term and start date on optional fields", () => {
		const result = validateWorkbookByKind(
			makeParsedUnifiedWorkbook({
				quotationRows: [
					{
						rowNumber: 2,
						supplierName: "Fornecedor A",
						supplierDocument: "12345678000195",
						value: 100,
						serviceStartDate: "nao-e-uma-data",
						executionTermDays: -5,
					},
				],
				sheetNames: ["Mapa de Cotacao"],
			}),
			"cotacao",
		);

		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "INVALID_DATE",
					field: "Data de Início",
					row: 2,
				}),
				expect.objectContaining({
					code: "INVALID_EXECUTION_TERM",
					field: "Prazo de Execução",
					row: 2,
				}),
			]),
		);
	});

	it("accepts optional fields when valid or empty", () => {
		const result = validateWorkbookByKind(
			makeParsedUnifiedWorkbook({
				quotationRows: [
					{
						rowNumber: 2,
						supplierName: "Fornecedor A",
						supplierDocument: "12345678000195",
						value: 100,
						serviceStartDate: "2026-09-01",
						executionTermDays: 90,
					},
					{
						rowNumber: 3,
						supplierName: "Fornecedor B",
						supplierDocument: "23456789000195",
						value: 200,
						serviceStartDate: null,
						executionTermDays: null,
					},
				],
				sheetNames: ["Mapa de Cotacao"],
			}),
			"cotacao",
		);

		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

describe("validateWorkbook", () => {
	it("normalizes budget composition and validates referenced indexes", () => {
		const result = validateWorkbook(makeParsedUnifiedWorkbook());

		expect(result.valid).toBe(true);
		expect(result.normalizedRows[1].laborUnitCost).toBe(20);
		expect(result.normalizedRows[1].materialUnitCost).toBe(30);
		expect(result.normalizedRows[1].equipmentUnitCost).toBe(5);
		expect(result.normalizedRows[1].otherUnitCost).toBe(0);
		expect(result.normalizedRows[1].unitCostTotal).toBe(55);
		expect(result.normalizedRows[1].unitCost).toBe(55);
		expect(result.normalizedRows[1].totalBudget).toBe(550);
		expect(result.normalizedRows[1].totalCost).toBe(550);
		expect(result.normalizedRows[1].parentIndex).toBe("1");
		expect(result.baselineSchedules).toHaveLength(1);
		expect(result.scheduleRevisions).toHaveLength(1);
		expect(result.measurements).toHaveLength(1);
		expect(result.actualCosts).toHaveLength(1);
		expect(result.actualCosts[0].appropriationStatus).toBe("APPROPRIATED");
		expect(result.actualCosts[0].category).toBe("MATERIAL");
		expect(result.actualCosts[0].costType).toBe("CURRENT");
	});

	it("rejects workbooks missing required unified sheets", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				actualCostRows: undefined,
				sheetNames: [
					"Obra",
					"Orcamento",
					"Cronograma Original",
					"Replanejamento",
					"Medicoes",
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "MISSING_REQUIRED_SHEET",
				field: "Custos Realizados",
			}),
		);
	});

	it("rejects unified workbooks missing required Obra dates", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				work: {
					baseDate: null,
					plannedStart: null,
					plannedEnd: null,
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sheet: "Obra",
					field: "Data-base",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Obra",
					field: "Inicio planejado original",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Obra",
					field: "Fim planejado original",
					code: "MISSING_REQUIRED_FIELD",
				}),
			]),
		);
	});

	it("requires the Obra name but not a manually supplied code", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				work: {
					code: "",
					name: "",
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual([
			{
				row: undefined,
				sheet: "Obra",
				field: "Nome da obra",
				code: "MISSING_REQUIRED_FIELD",
				message: "Nome da obra obrigatorio",
			},
		]);
	});

	it("normalizes ignored and suspended budget statuses", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				budgetRows: [
					{
						rowNumber: 2,
						index: "1",
						type: "Item",
						description: "Não executar",
						unit: "un",
						quantity: 1,
						laborUnitCost: 1,
						materialUnitCost: 0,
						equipmentUnitCost: 0,
						otherUnitCost: 0,
						providedStatus: "Não executar",
					},
					{
						rowNumber: 3,
						index: "2",
						type: "Item",
						description: "Suspenso",
						unit: "un",
						quantity: 1,
						laborUnitCost: 1,
						materialUnitCost: 0,
						equipmentUnitCost: 0,
						otherUnitCost: 0,
						providedStatus: "Suspenso",
					},
				],
				baselineRows: [],
				replanningRows: [],
				measurementRows: [],
				actualCostRows: [],
			}),
		);

		expect(result.valid).toBe(true);
		expect(result.normalizedRows.map((row) => row.computedStatus)).toEqual([
			"IGNORED",
			"SUSPENDED",
		]);
	});

	it("rejects missing cross-sheet budget indexes except unappropriated actual costs", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				baselineRows: [
					{
						rowNumber: 2,
						index: "9.9",
						plannedStart: "2026-01-01",
						plannedEnd: "2026-01-31",
						plannedWeight: null,
					},
				],
				actualCostRows: [
					{
						rowNumber: 2,
						costDate: "2026-01-20",
						budgetIndex: null,
						category: "Outros",
						description: "Reserva",
						amount: 50,
						costType: "Futuro",
						sourceDocument: "Planilha",
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "UNKNOWN_BUDGET_INDEX",
				field: "Indice",
				row: 2,
			}),
		);
		expect(result.actualCosts[0].budgetIndex).toBeNull();
		expect(result.actualCosts[0].appropriationStatus).toBe("UNAPPROPRIATED");
		expect(result.actualCosts[0].category).toBe("OTHER");
		expect(result.actualCosts[0].costType).toBe("FUTURE");
	});

	it("validates budget references in all unified detail sheets", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				baselineRows: [
					{
						rowNumber: 2,
						index: "9.1",
						plannedStart: "2026-01-01",
						plannedEnd: "2026-01-31",
						plannedWeight: null,
					},
				],
				replanningRows: [
					{
						rowNumber: 3,
						index: "9.2",
						version: "R1",
						replannedStart: "2026-01-05",
						replannedEnd: "2026-02-05",
						revisionDate: "2026-01-10",
						reason: null,
					},
				],
				measurementRows: [
					{
						rowNumber: 4,
						index: "9.3",
						measurementDate: "2026-01-15",
						measuredPercentageAccumulated: 0.5,
						measuredQuantityAccumulated: 5,
						notes: null,
					},
				],
				actualCostRows: [
					{
						rowNumber: 5,
						costDate: "2026-01-20",
						budgetIndex: "9.4",
						category: "Material",
						description: "NF",
						amount: 200,
						costType: "Atual",
						sourceDocument: "NF-1",
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(
			result.errors
				.filter((error) => error.code === "UNKNOWN_BUDGET_INDEX")
				.map((error) => ({
					row: error.row,
					sheet: error.sheet,
				})),
		).toEqual([
			{ row: 2, sheet: "Cronograma Original" },
			{ row: 4, sheet: "Medicoes" },
			{ row: 5, sheet: "Custos Realizados" },
		]);
		expect(
			result.errors.filter((error) => error.code === "UNKNOWN_SCHEDULE_INDEX"),
		).toEqual([expect.objectContaining({ row: 3, sheet: "Replanejamento" })]);
	});

	it("rejects unified detail rows missing required fields", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				baselineRows: [
					{
						rowNumber: 2,
						index: "1.1",
						plannedStart: null,
						plannedEnd: null,
						plannedWeight: null,
					},
				],
				replanningRows: [
					{
						rowNumber: 3,
						index: "1.1",
						version: null,
						replannedStart: null,
						replannedEnd: null,
						revisionDate: null,
						reason: null,
					},
				],
				measurementRows: [
					{
						rowNumber: 4,
						index: "1.1",
						measurementDate: null,
						measuredPercentageAccumulated: null,
						measuredQuantityAccumulated: null,
						notes: null,
					},
				],
				actualCostRows: [
					{
						rowNumber: 5,
						costDate: null,
						budgetIndex: "1.1",
						category: null,
						description: null,
						amount: null,
						costType: null,
						sourceDocument: null,
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sheet: "Cronograma Original",
					row: 2,
					field: "Inicio previsto",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Cronograma Original",
					row: 2,
					field: "Fim previsto",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Replanejamento",
					row: 3,
					field: "Versao",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Replanejamento",
					row: 3,
					field: "Inicio replanejado",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Replanejamento",
					row: 3,
					field: "Fim replanejado",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Replanejamento",
					row: 3,
					field: "Data da revisao",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Medicoes",
					row: 4,
					field: "Data da medicao",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Medicoes",
					row: 4,
					field: "Percentual medido acumulado",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 5,
					field: "Data do lancamento",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 5,
					field: "Categoria",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 5,
					field: "Descricao",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 5,
					field: "Valor realizado",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 5,
					field: "Tipo",
					code: "MISSING_REQUIRED_FIELD",
				}),
			]),
		);
	});

	it("excludes invalid and missing actual cost rows from normalized output", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				actualCostRows: [
					{
						rowNumber: 5,
						costDate: "2026-01-20",
						budgetIndex: "1.1",
						category: "Material",
						description: "NF valida",
						amount: 200,
						costType: "Atual",
						sourceDocument: "NF-1",
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
					{
						rowNumber: 6,
						costDate: null,
						budgetIndex: "1.1",
						category: null,
						description: null,
						amount: null,
						costType: null,
						sourceDocument: null,
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
					{
						rowNumber: 7,
						costDate: "data invalida",
						budgetIndex: "1.1",
						category: "Categoria desconhecida",
						description: "NF invalida",
						amount: {},
						costType: "Tipo desconhecido",
						sourceDocument: "NF-2",
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 6,
					field: "Data do lancamento",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 6,
					field: "Categoria",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 6,
					field: "Descricao",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 6,
					field: "Valor realizado",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 6,
					field: "Tipo",
					code: "MISSING_REQUIRED_FIELD",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 7,
					field: "Data do lancamento",
					code: "INVALID_DATE",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 7,
					field: "Categoria",
					code: "INVALID_CATEGORY",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 7,
					field: "Valor realizado",
					code: "INVALID_NUMBER",
				}),
				expect.objectContaining({
					sheet: "Custos Realizados",
					row: 7,
					field: "Tipo",
					code: "INVALID_COST_TYPE",
				}),
			]),
		);
		expect(result.actualCosts).toHaveLength(1);
		expect(result.actualCosts[0]).toEqual(
			expect.objectContaining({
				rowNumber: 5,
				category: "MATERIAL",
				amount: 200,
				costType: "CURRENT",
			}),
		);
	});

	it("rejects invalid unified budget types", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				budgetRows: [
					{
						rowNumber: 2,
						index: "1",
						type: "foo",
						description: "Tipo desconhecido",
						unit: null,
						quantity: null,
						laborUnitCost: null,
						materialUnitCost: null,
						equipmentUnitCost: null,
						otherUnitCost: null,
						providedStatus: null,
					},
				],
				baselineRows: [],
				replanningRows: [],
				measurementRows: [],
				actualCostRows: [],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.normalizedRows).toHaveLength(0);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				sheet: "Orcamento",
				row: 2,
				field: "Tipo",
				code: "INVALID_BUDGET_TYPE",
			}),
		);
	});

	it("marks duplicate budget indexes per row, keeping only the first occurrence", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				budgetRows: [
					{
						rowNumber: 2,
						index: "1",
						type: "Etapa/Subetapa",
						description: "Fundacao",
						unit: null,
						quantity: null,
						laborUnitCost: null,
						materialUnitCost: null,
						equipmentUnitCost: null,
						otherUnitCost: null,
						providedStatus: null,
					},
					{
						rowNumber: 3,
						index: "1.1",
						type: "Item",
						description: "Escavacao",
						unit: "m3",
						quantity: 10,
						laborUnitCost: 20,
						materialUnitCost: 30,
						equipmentUnitCost: 5,
						otherUnitCost: 0,
						providedStatus: null,
					},
					{
						rowNumber: 4,
						index: "1.1",
						type: "Item",
						description: "Escavacao duplicada",
						unit: "m3",
						quantity: 5,
						laborUnitCost: 10,
						materialUnitCost: 0,
						equipmentUnitCost: 0,
						otherUnitCost: 0,
						providedStatus: null,
					},
				],
				baselineRows: [],
				replanningRows: [],
				measurementRows: [],
				actualCostRows: [],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				sheet: "Orcamento",
				row: 4,
				field: "Indice",
				code: "DUPLICATE_INDEX",
			}),
		);
		expect(result.normalizedRows.map((row) => row.index)).toEqual(["1", "1.1"]);
	});

	it("normalizes planning, measurement, and cost dates as date-only UTC values", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				baselineRows: [
					{
						rowNumber: 2,
						index: "1.1",
						plannedStart: "2026-01-01T15:45:00-03:00",
						plannedEnd: new Date("2026-01-31T23:59:59.000Z"),
						plannedWeight: null,
					},
				],
				measurementRows: [
					{
						rowNumber: 2,
						index: "1.1",
						measurementDate: "2026-01-15T08:30:00-03:00",
						measuredPercentageAccumulated: 0.5,
						measuredQuantityAccumulated: 5,
						notes: null,
					},
				],
				actualCostRows: [
					{
						rowNumber: 2,
						costDate: "2026-01-20T10:15:00-03:00",
						budgetIndex: "1.1",
						category: "Material",
						description: "NF",
						amount: 200,
						costType: "Atual",
						sourceDocument: "NF-1",
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(true);
		expect(result.baselineSchedules[0].plannedStart?.toISOString()).toBe(
			"2026-01-01T00:00:00.000Z",
		);
		expect(result.baselineSchedules[0].plannedEnd?.toISOString()).toBe(
			"2026-01-31T00:00:00.000Z",
		);
		expect(result.measurements[0].measurementDate?.toISOString()).toBe(
			"2026-01-15T00:00:00.000Z",
		);
		expect(result.actualCosts[0].costDate?.toISOString()).toBe(
			"2026-01-20T00:00:00.000Z",
		);
	});

	it("excludes unknown budget detail rows from normalized output when invalid", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				baselineRows: [
					{
						rowNumber: 2,
						index: "9.1",
						plannedStart: "2026-01-01",
						plannedEnd: "2026-01-31",
						plannedWeight: null,
					},
				],
				replanningRows: [
					{
						rowNumber: 3,
						index: "9.2",
						version: "R1",
						replannedStart: "2026-01-05",
						replannedEnd: "2026-02-05",
						revisionDate: "2026-01-10",
						reason: null,
					},
				],
				measurementRows: [
					{
						rowNumber: 4,
						index: "9.3",
						measurementDate: "2026-01-15",
						measuredPercentageAccumulated: 0.5,
						measuredQuantityAccumulated: 5,
						notes: null,
					},
				],
				actualCostRows: [
					{
						rowNumber: 5,
						costDate: "2026-01-20",
						budgetIndex: "9.4",
						category: "Material",
						description: "NF",
						amount: 200,
						costType: "Atual",
						sourceDocument: "NF-1",
						supplierName: null,
						costGroup: null,
						paymentStatus: null,
						competenceDate: null,
						dueDate: null,
						paymentDate: null,
						documentNumber: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(
			result.errors.filter((error) => error.code === "UNKNOWN_BUDGET_INDEX"),
		).toHaveLength(3);
		expect(
			result.errors.filter((error) => error.code === "UNKNOWN_SCHEDULE_INDEX"),
		).toHaveLength(1);
		expect(result.baselineSchedules).toHaveLength(0);
		expect(result.scheduleRevisions).toHaveLength(0);
		expect(result.measurements).toHaveLength(0);
		expect(result.actualCosts).toHaveLength(0);
	});

	it("normalizes measurement percentages from whole numbers and rejects invalid date ranges", () => {
		const result = validateWorkbook(
			makeParsedUnifiedWorkbook({
				baselineRows: [
					{
						rowNumber: 2,
						index: "1.1",
						plannedStart: "2026-02-01",
						plannedEnd: "2026-01-31",
						plannedWeight: null,
					},
				],
				measurementRows: [
					{
						rowNumber: 2,
						index: "1.1",
						measurementDate: "2026-01-15",
						measuredPercentageAccumulated: 50,
						measuredQuantityAccumulated: 5,
						notes: null,
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.measurements[0].measuredPercentageAccumulated).toBe(0.5);
		expect(result.measurements[0].measurementDate).toBeInstanceOf(Date);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "INVALID_DATE_RANGE",
				field: "Fim previsto",
				row: 2,
			}),
		);
	});

	it("rejects empty rows", () => {
		const wb = makeParsedUnifiedWorkbook({ budgetRows: [] });
		const result = validateWorkbook(wb);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("accepts valid workbook", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "001",
					type: "Etapa/Subetapa",
					description: "Stage 1",
					unit: null,
					quantity: null,
					laborUnitCost: null,
					materialUnitCost: null,
					equipmentUnitCost: null,
					otherUnitCost: null,
					providedStatus: null,
				},
				{
					rowNumber: 7,
					index: "001.01",
					type: "Item",
					description: "Item 1",
					unit: "m2",
					quantity: 100,
					laborUnitCost: 25,
					materialUnitCost: 15,
					equipmentUnitCost: 5,
					otherUnitCost: 5,
					providedStatus: null,
				},
			],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			actualCostRows: [],
		});

		const result = validateWorkbook(wb);
		expect(result.valid).toBe(true);
		expect(result.normalizedRows).toHaveLength(2);
		expect(result.normalizedRows[0].totalCost).toBe(0);
		expect(result.normalizedRows[1].totalCost).toBe(5000);
		expect(result.normalizedRows[1].computedStatus).toBe("NOT_STARTED");
	});

	it("normalizes padded budget indexes and keeps their hierarchy", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "1.001",
					type: "Etapa/Subetapa",
					description: "Stage",
					unit: null,
					quantity: null,
					laborUnitCost: null,
					materialUnitCost: null,
					equipmentUnitCost: null,
					otherUnitCost: null,
					providedStatus: null,
				},
				{
					rowNumber: 7,
					index: "1.001.01",
					type: "Etapa/Subetapa",
					description: "Substage",
					unit: null,
					quantity: null,
					laborUnitCost: null,
					materialUnitCost: null,
					equipmentUnitCost: null,
					otherUnitCost: null,
					providedStatus: null,
				},
				{
					rowNumber: 8,
					index: "1.001.01.01",
					type: "Item",
					description: "Item",
					unit: "un",
					quantity: 1,
					laborUnitCost: 1,
					materialUnitCost: 0,
					equipmentUnitCost: 0,
					otherUnitCost: 0,
					providedStatus: null,
				},
			],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			actualCostRows: [],
		});

		const result = validateWorkbook(wb);

		expect(result.valid).toBe(true);
		expect(result.normalizedRows.map((row) => row.index)).toEqual([
			"1.1",
			"1.1.1",
			"1.1.1.1",
		]);
		expect(result.normalizedRows.map((row) => row.parentIndex)).toEqual([
			null,
			"1.1",
			"1.1.1",
		]);
	});

	it("derives parent indexes from stage and item indexes", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "001",
					type: "Etapa/Subetapa",
					description: "Stage 1",
					unit: null,
					quantity: null,
					laborUnitCost: null,
					materialUnitCost: null,
					equipmentUnitCost: null,
					otherUnitCost: null,
					providedStatus: null,
				},
				{
					rowNumber: 7,
					index: "001.01",
					type: "Item",
					description: "Item 1",
					unit: "m2",
					quantity: 10,
					laborUnitCost: 2,
					materialUnitCost: 1.5,
					equipmentUnitCost: 1,
					otherUnitCost: 0.5,
					providedStatus: null,
				},
			],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			actualCostRows: [],
		});

		const result = validateWorkbook(wb);

		expect(result.valid).toBe(true);
		expect(result.normalizedRows[0].parentIndex).toBeNull();
		expect(result.normalizedRows[1].parentIndex).toBe("1");
	});

	it("derives parent indexes for nested stages", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "001",
					type: "Etapa/Subetapa",
					description: "Stage",
					unit: null,
					quantity: null,
					laborUnitCost: null,
					materialUnitCost: null,
					equipmentUnitCost: null,
					otherUnitCost: null,
					providedStatus: null,
				},
				{
					rowNumber: 7,
					index: "001.01",
					type: "Etapa/Subetapa",
					description: "Substage",
					unit: null,
					quantity: null,
					laborUnitCost: null,
					materialUnitCost: null,
					equipmentUnitCost: null,
					otherUnitCost: null,
					providedStatus: null,
				},
				{
					rowNumber: 8,
					index: "001.01.01",
					type: "Item",
					description: "Item",
					unit: "un",
					quantity: 1,
					laborUnitCost: 50,
					materialUnitCost: 30,
					equipmentUnitCost: 15,
					otherUnitCost: 5,
					providedStatus: null,
				},
			],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			actualCostRows: [],
		});

		const result = validateWorkbook(wb);

		expect(result.valid).toBe(true);
		expect(result.normalizedRows.map((row) => row.parentIndex)).toEqual([
			null,
			"1",
			"1.1",
		]);
	});

	it("sets completionPercentage to 0 for budget rows", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "001",
					type: "Item",
					description: "Item",
					unit: "un",
					quantity: 10,
					laborUnitCost: 40,
					materialUnitCost: 30,
					equipmentUnitCost: 20,
					otherUnitCost: 10,
					providedStatus: null,
				},
			],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			actualCostRows: [],
		});

		const result = validateWorkbook(wb);
		expect(result.valid).toBe(true);
		expect(result.normalizedRows[0].completionPercentage).toBe(0);
	});

	it("normalizes Portuguese do-not-execute statuses to ignored", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "001",
					type: "Item",
					description: "Accented",
					unit: "un",
					quantity: 1,
					laborUnitCost: 40,
					materialUnitCost: 30,
					equipmentUnitCost: 20,
					otherUnitCost: 10,
					providedStatus: "Não executar",
				},
				{
					rowNumber: 7,
					index: "002",
					type: "Item",
					description: "Unaccented",
					unit: "un",
					quantity: 1,
					laborUnitCost: 40,
					materialUnitCost: 30,
					equipmentUnitCost: 20,
					otherUnitCost: 10,
					providedStatus: "Não executar",
				},
			],
			baselineRows: [],
			replanningRows: [],
			measurementRows: [],
			actualCostRows: [],
		});

		const result = validateWorkbook(wb);

		expect(result.valid).toBe(true);
		expect(result.normalizedRows.map((row) => row.computedStatus)).toEqual([
			"IGNORED",
			"IGNORED",
		]);
	});

	describe("validateWorkbookByKind", () => {
		it("obra-completa validates all sheets", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					contractRows: [
						{
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
						},
					],
					serviceRows: [
						{
							rowNumber: 2,
							index: "1",
							type: "Item",
							description: "Servico 1",
							unit: "un",
							quantity: 10,
							unitCost: 100,
							totalCost: 1000,
						},
					],
					contractMeasurementRows: [
						{
							rowNumber: 2,
							number: "1",
							date: "2026-01-15",
							title: "Medicao 1",
							discountValue: null,
							retentionValue: null,
							taxValue: null,
							notes: null,
						},
					],
					paymentRows: [
						{
							rowNumber: 2,
							date: "2026-01-20",
							value: 10000,
							paidValue: 10000,
							description: "Pagamento 1",
							retentionValue: null,
							discountValue: null,
							status: "PAGO",
						},
					],
				}),
				"obra-completa",
			);

			expect(result.valid).toBe(true);
		});

		it("cronograma kind only validates schedule-related checks", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook(),
				"cronograma",
			);

			expect(result.valid).toBe(true);
			expect(result.baselineSchedules.length).toBeGreaterThan(0);
			expect(result.scheduleRevisions.length).toBeGreaterThan(0);
		});

		it("does not emit Obra required-field errors for kinds without an Obra sheet", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					work: {
						code: "",
						name: "",
						baseDate: null,
						plannedStart: null,
						plannedEnd: null,
					},
				}),
				"cronograma",
			);

			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it("medicao-obra kind only validates measurement-related checks", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook(),
				"medicao-obra",
			);

			expect(result.valid).toBe(true);
			expect(result.measurements.length).toBeGreaterThan(0);
		});

		it("validates medicao-obra indexes against the work budget when provided", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook(),
				"medicao-obra",
				{ measurementBudgetIndexes: new Set(["9.9"]) },
			);

			expect(result.valid).toBe(false);
			expect(result.measurements).toHaveLength(0);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					code: "UNKNOWN_BUDGET_INDEX",
					field: "Indice",
				}),
			);
		});

		it("custos kind only validates actual cost-related checks", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook(),
				"custos",
			);

			expect(result.valid).toBe(true);
			expect(result.actualCosts.length).toBeGreaterThan(0);
		});

		it("medicao-contrato kind validates contract-related checks", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook(),
				"medicao-contrato",
			);

			expect(result.valid).toBe(true);
		});

		it("reports processedSheets derived from the kind definition, excluding contract sheets outside medicao-contrato", () => {
			const unified = validateWorkbookByKind(
				makeParsedUnifiedWorkbook(),
				"obra-completa",
			);

			expect(unified.processedSheets).toContain("Orcamento");
			expect(unified.processedSheets).toContain("Cronograma Original");
			expect(unified.processedSheets).not.toContain("Contrato");
			expect(unified.processedSheets).not.toContain("Servicos");
			expect(unified.processedSheets).not.toContain("Medicoes Contrato");
			expect(unified.processedSheets).not.toContain("Pagamentos");

			const contract = validateWorkbookByKind(
				makeContractWorkbook(),
				"medicao-contrato",
			);

			expect(contract.processedSheets).toEqual([
				"Contrato",
				"Servicos",
				"Medicoes Contrato",
				"Pagamentos",
			]);
		});

		it("tolerates missing data sheets for the medicao-contrato kind", () => {
			const wb = makeContractWorkbook();
			wb.sheetNames = ["Guia"];

			const result = validateWorkbookByKind(wb, "medicao-contrato");

			expect(result.valid).toBe(true);
			expect(
				result.errors.filter(
					(error) => error.code === "MISSING_REQUIRED_SHEET",
				),
			).toEqual([]);
		});

		it("tolerates missing data sheets for the cronograma kind", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					baselineRows: [],
					replanningRows: [],
					sheetNames: ["Guia"],
				}),
				"cronograma",
			);

			expect(result.valid).toBe(true);
			expect(
				result.errors.filter(
					(error) => error.code === "MISSING_REQUIRED_SHEET",
				),
			).toEqual([]);
		});

		it("returns error for invalid kind", () => {
			expect(() =>
				validateWorkbookByKind(
					makeParsedUnifiedWorkbook(),
					"invalid-kind" as never,
				),
			).toThrow("Tipo de workbook invalido");
		});

		it("keeps a workbook with only the Orcamento sheet valid", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					budgetRows: [
						{
							rowNumber: 2,
							index: "1",
							type: "Etapa/Subetapa",
							description: "Fundacao",
							unit: null,
							quantity: null,
							laborUnitCost: null,
							materialUnitCost: null,
							equipmentUnitCost: null,
							otherUnitCost: null,
							providedStatus: null,
						},
						{
							rowNumber: 3,
							index: "1.1",
							type: "Item",
							description: "Escavacao",
							unit: "m3",
							quantity: 10,
							laborUnitCost: 20,
							materialUnitCost: 30,
							equipmentUnitCost: 5,
							otherUnitCost: 0,
							providedStatus: null,
						},
					],
					baselineRows: [],
					replanningRows: [],
					measurementRows: [],
					actualCostRows: [],
					sheetNames: ["Orcamento"],
				}),
				"obra-completa",
			);

			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
			expect(result.normalizedRows).toHaveLength(2);
		});

		it("defers budget dependency resolution when the Orcamento sheet is absent", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					sheetNames: ["Obra", "Cronograma Original", "Replanejamento"],
				}),
				"obra-completa",
			);

			expect(result.valid).toBe(true);
			expect(
				result.errors.filter((error) => error.code === "UNKNOWN_BUDGET_INDEX"),
			).toEqual([]);
			expect(result.baselineSchedules).toHaveLength(1);
			expect(result.scheduleRevisions).toHaveLength(1);
		});

		it("validates Itens do Orcamento rows per row, keeping valid rows on partial failure", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					itensRows: [
						{
							rowNumber: 2,
							index: "1.1",
							type: "Item",
							description: "Escavacao",
							unit: "m3",
							quantity: 10,
							laborUnitCost: 20,
							materialUnitCost: 30,
							equipmentUnitCost: 5,
							otherUnitCost: 0,
							providedStatus: null,
						},
						{
							rowNumber: 3,
							index: null,
							type: "Item",
							description: "Sem indice",
							unit: "m3",
							quantity: 10,
							laborUnitCost: 1,
							materialUnitCost: 0,
							equipmentUnitCost: 0,
							otherUnitCost: 0,
							providedStatus: null,
						},
						{
							rowNumber: 4,
							index: "1.2",
							type: "foo",
							description: "Tipo invalido",
							unit: "m3",
							quantity: 10,
							laborUnitCost: 1,
							materialUnitCost: 0,
							equipmentUnitCost: 0,
							otherUnitCost: 0,
							providedStatus: null,
						},
					],
					sheetNames: [
						"Obra",
						"Orcamento",
						"Itens do Orcamento",
						"Cronograma Original",
						"Replanejamento",
						"Medicoes",
						"Custos Realizados",
					],
				}),
				"obra-completa",
			);

			expect(result.normalizedItens).toHaveLength(1);
			expect(result.normalizedItens[0].index).toBe("1.1");
			expect(result.errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						sheet: "Itens do Orcamento",
						row: 3,
						field: "Indice",
						code: "MISSING_REQUIRED_FIELD",
					}),
					expect.objectContaining({
						sheet: "Itens do Orcamento",
						row: 4,
						field: "Tipo",
						code: "INVALID_BUDGET_TYPE",
					}),
				]),
			);
		});

		it("defers replanning dependency binding when the index is missing from the in-file Cronograma rows", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					baselineRows: [
						{
							rowNumber: 2,
							index: "1.1",
							plannedStart: "2026-01-01",
							plannedEnd: "2026-01-31",
							plannedWeight: null,
						},
					],
					replanningRows: [
						{
							rowNumber: 3,
							index: "9.9",
							version: "R1",
							replannedStart: "2026-01-05",
							replannedEnd: "2026-02-05",
							revisionDate: "2026-01-10",
							reason: null,
						},
					],
					measurementRows: [],
					actualCostRows: [],
				}),
				"obra-completa",
			);

			expect(result.valid).toBe(true);
			expect(
				result.errors.filter(
					(error) => error.code === "UNKNOWN_SCHEDULE_INDEX",
				),
			).toEqual([]);
			expect(result.scheduleRevisions).toHaveLength(1);
		});

		it("defers baseline dependency binding when the index is missing from the in-file Orcamento rows", () => {
			const result = validateWorkbookByKind(
				makeParsedUnifiedWorkbook({
					baselineRows: [
						{
							rowNumber: 2,
							index: "9.9",
							plannedStart: "2026-01-01",
							plannedEnd: "2026-01-31",
							plannedWeight: null,
						},
					],
					replanningRows: [],
					measurementRows: [],
					actualCostRows: [],
				}),
				"obra-completa",
			);

			expect(result.valid).toBe(true);
			expect(
				result.errors.filter((error) => error.code === "UNKNOWN_BUDGET_INDEX"),
			).toEqual([]);
			expect(result.baselineSchedules).toHaveLength(1);
		});
	});

	it("rejects end date before start date in baseline schedule", () => {
		const wb = makeParsedUnifiedWorkbook({
			budgetRows: [
				{
					rowNumber: 6,
					index: "001",
					type: "Item",
					description: "Item",
					unit: "un",
					quantity: 10,
					laborUnitCost: 40,
					materialUnitCost: 30,
					equipmentUnitCost: 20,
					otherUnitCost: 10,
					providedStatus: null,
				},
			],
			baselineRows: [
				{
					rowNumber: 6,
					index: "001",
					plannedStart: new Date("2024-06-30"),
					plannedEnd: new Date("2024-01-01"),
					plannedWeight: null,
				},
			],
		});

		const result = validateWorkbook(wb);
		expect(result.valid).toBe(false);
		expect(result.errors[0].code).toBe("INVALID_DATE_RANGE");
	});

	describe("contract measurement validators", () => {
		it("normalizes contract measurement rows through validateWorkbookByKind", () => {
			const wb = makeContractWorkbook({
				contractRows: [
					{
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
					},
				],
				serviceRows: [
					{
						rowNumber: 2,
						index: "1",
						type: "Item",
						description: "Servico 1",
						unit: "un",
						quantity: 10,
						unitCost: 100,
						totalCost: 1000,
					},
				],
				contractMeasurementRows: [
					{
						rowNumber: 2,
						number: "1",
						date: "2026-01-15",
						title: "Medicao 1",
						discountValue: null,
						retentionValue: null,
						taxValue: null,
						notes: null,
					},
				],
				paymentRows: [
					{
						rowNumber: 2,
						date: "2026-01-20",
						value: 10000,
						paidValue: 10000,
						description: "Pagamento 1",
						retentionValue: null,
						discountValue: null,
						status: null,
					},
				],
			});

			const result = validateWorkbookByKind(wb, "medicao-contrato");

			expect(result.valid).toBe(true);
			expect(result.contracts).toHaveLength(1);
			expect(result.contracts[0]).toEqual(
				expect.objectContaining({
					code: "C-001",
					contractValue: 50000,
					status: "EM_ANDAMENTO",
				}),
			);
			expect(result.contractServices).toHaveLength(1);
			expect(result.contractServices[0]).toEqual(
				expect.objectContaining({
					index: "1",
					type: "ITEM",
					description: "Servico 1",
					quantity: 10,
					unitCost: 100,
					totalCost: 1000,
				}),
			);
			expect(result.contractMeasurements).toHaveLength(1);
			expect(result.contractMeasurements[0].date).toBeInstanceOf(Date);
			expect(result.contractPayments).toHaveLength(1);
		});

		it("defaults empty payment status to EM_ABERTO and maps paid keywords", () => {
			const wb = makeContractWorkbook({
				paymentRows: [
					{
						rowNumber: 2,
						date: "2026-01-20",
						value: 100,
						paidValue: 100,
						description: null,
						retentionValue: null,
						discountValue: null,
						status: null,
					},
					{
						rowNumber: 3,
						date: "2026-02-20",
						value: 200,
						paidValue: 200,
						description: null,
						retentionValue: null,
						discountValue: null,
						status: "Pago",
					},
				],
			});

			const result = normalizeContractPaymentRows(wb, []);

			expect(result).toHaveLength(2);
			expect(result[0].status).toBe("EM_ABERTO");
			expect(result[1].status).toBe("PAGO");
		});

		it("emits INVALID_NUMBER for unparseable money and excludes the row from normalized output", () => {
			const wb = makeContractWorkbook({
				paymentRows: [
					{
						rowNumber: 2,
						date: "2026-01-20",
						value: "abc",
						paidValue: 100,
						description: null,
						retentionValue: null,
						discountValue: null,
						status: "PAGO",
					},
				],
			});

			const errors: Parameters<typeof normalizeContractPaymentRows>[1] = [];
			const payments = normalizeContractPaymentRows(wb, errors);

			expect(payments).toEqual([]);
			expect(errors).toEqual([
				expect.objectContaining({
					sheet: "Pagamentos",
					row: 2,
					field: "Valor",
					code: "INVALID_NUMBER",
					message: "Numero invalido na linha 2",
				}),
			]);
		});

		it("emits INVALID_DATE for unparseable dates and excludes the measurement row from normalized output", () => {
			const wb = makeContractWorkbook({
				contractMeasurementRows: [
					{
						rowNumber: 2,
						number: "1",
						date: "nao-e-data",
						title: "Medicao",
						discountValue: null,
						retentionValue: null,
						taxValue: null,
						notes: null,
					},
					{
						rowNumber: 3,
						number: "2",
						date: "2026-01-15",
						title: "Medicao valida",
						discountValue: null,
						retentionValue: null,
						taxValue: null,
						notes: null,
					},
				],
			});

			const errors: Parameters<typeof normalizeContractPaymentRows>[1] = [];
			const measurements = normalizeContractMeasurementRows(wb, errors);

			expect(measurements).toHaveLength(1);
			expect(measurements[0].rowNumber).toBe(3);
			expect(errors).toEqual([
				expect.objectContaining({
					sheet: "Medicoes Contrato",
					row: 2,
					field: "Data",
					code: "INVALID_DATE",
					message: "Data invalida",
				}),
			]);
		});

		it("excludes contract payment rows missing required fields from normalized output", () => {
			const wb = makeContractWorkbook({
				paymentRows: [
					{
						rowNumber: 2,
						date: null,
						value: 100,
						paidValue: 100,
						description: null,
						retentionValue: null,
						discountValue: null,
						status: "PAGO",
					},
					{
						rowNumber: 3,
						date: "2026-01-20",
						value: null,
						paidValue: null,
						description: null,
						retentionValue: null,
						discountValue: null,
						status: "PAGO",
					},
				],
			});

			const errors: Parameters<typeof normalizeContractPaymentRows>[1] = [];
			const payments = normalizeContractPaymentRows(wb, errors);

			expect(payments).toEqual([]);
			expect(
				errors.filter((error) => error.code === "MISSING_REQUIRED_FIELD"),
			).toEqual([
				expect.objectContaining({
					sheet: "Pagamentos",
					row: 2,
					field: "Data",
				}),
				expect.objectContaining({
					sheet: "Pagamentos",
					row: 3,
					field: "Valor",
				}),
				expect.objectContaining({
					sheet: "Pagamentos",
					row: 3,
					field: "Valor Pago",
				}),
			]);
		});

		it("emits INVALID_DATE for unparseable dates", () => {
			const wb = makeContractWorkbook({
				contractMeasurementRows: [
					{
						rowNumber: 2,
						number: "1",
						date: "nao-e-data",
						title: "Medicao",
						discountValue: null,
						retentionValue: null,
						taxValue: null,
						notes: null,
					},
				],
			});

			const errors: Parameters<typeof normalizeContractPaymentRows>[1] = [];
			normalizeContractMeasurementRows(wb, errors);

			expect(errors).toEqual([
				expect.objectContaining({
					sheet: "Medicoes Contrato",
					row: 2,
					field: "Data",
					code: "INVALID_DATE",
					message: "Data invalida",
				}),
			]);
		});

		it("dedups service rows by Indice and contract rows by Codigo with warnings", () => {
			const wb = makeContractWorkbook({
				serviceRows: [
					{
						rowNumber: 2,
						index: "1",
						type: "ITEM",
						description: "Primeiro",
						unit: null,
						quantity: 1,
						unitCost: null,
						totalCost: null,
					},
					{
						rowNumber: 3,
						index: "1",
						type: "ITEM",
						description: "Duplicado",
						unit: null,
						quantity: 2,
						unitCost: null,
						totalCost: null,
					},
				],
				contractRows: [
					{
						rowNumber: 2,
						code: "C-001",
						supplierName: "Fornecedor A",
						contractValue: 100,
						serviceType: null,
						title: null,
						startDate: null,
						endDate: null,
						status: null,
						notes: null,
					},
					{
						rowNumber: 3,
						code: "C-001",
						supplierName: "Fornecedor B",
						contractValue: 200,
						serviceType: null,
						title: null,
						startDate: null,
						endDate: null,
						status: null,
						notes: null,
					},
				],
			});

			const warnings: Parameters<typeof normalizeContractRows>[2] = [];
			const services = normalizeContractServiceRows(wb, [], warnings);
			const contracts = normalizeContractRows(wb, [], warnings);

			expect(services).toHaveLength(1);
			expect(services[0].description).toBe("Primeiro");
			expect(contracts).toHaveLength(1);
			expect(contracts[0].supplierName).toBe("Fornecedor A");
			expect(warnings).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						sheet: "Servicos",
						row: 3,
						code: "DUPLICATE_SERVICE",
					}),
					expect.objectContaining({
						sheet: "Contrato",
						row: 3,
						code: "DUPLICATE_CONTRACT",
					}),
				]),
			);
		});
	});
});
