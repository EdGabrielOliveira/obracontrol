import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as XLSX from "xlsx";
import { parseWorkbookByKind } from "../../../../../src/modules/construction-planning/imports/parser";

const findWorkByOwnerAndCode = mock(async () => null);
const createWorkWithImport = mock(async () => ({
	workId: "work-1",
	importId: "import-1",
}));
const replaceWorkWithImport = mock(async () => ({
	workId: "work-1",
	importId: "import-2",
}));
const getImportById = mock(async () => null);

mock.module(
	"../../../../../src/modules/construction-planning/imports/import-repository",
	() => ({
		findWorkByOwnerAndCode,
		createWorkWithImport,
		replaceWorkWithImport,
		getImportById,
		existingBudgetIndexes: mock(async () => new Set()),
		existingScheduleIndexes: mock(async () => new Set()),
	}),
);

function makeObraRows(): Record<string, unknown>[] {
	return [
		{ Campo: "Codigo da obra", Valor: "OBRA-TEST-1" },
		{ Campo: "Nome da obra", Valor: "Obra Teste" },
		{ Campo: "Data-base", Valor: "2026-01-15" },
		{ Campo: "Inicio planejado original", Valor: "2026-01-01" },
		{ Campo: "Fim planejado original", Valor: "2026-12-31" },
	];
}

function makeOrcamentoRows(): Record<string, unknown>[] {
	return [
		{ Indice: "1", Tipo: "Etapa", Descricao: "Fundacao" },
		{
			Indice: "1.1",
			Tipo: "Item",
			Descricao: "Escavacao",
			Unidade: "m3",
			Quantidade: 10,
			"Mao de obra unitaria": 20,
			"Material unitario": 30,
			"Equipamento unitario": 5,
			"Outros unitario": 2,
			Situacao: "Ativo",
		},
	];
}

function makeWorkbookBytes(
	options: { badMeasurement?: boolean } = {},
): Uint8Array {
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet(makeObraRows()),
		"Obra",
	);
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet(makeOrcamentoRows()),
		"Orcamento",
	);
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet([
			{
				Indice: "1",
				"Inicio previsto": "2026-01-01",
				"Fim previsto": "2026-01-31",
				"Peso planejado opcional": null,
			},
		]),
		"Cronograma Original",
	);
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet([
			{
				Indice: "1",
				"Versao do replanejamento": "R1",
				"Inicio replanejado": "2026-01-05",
				"Fim replanejado": "2026-02-05",
				"Data da revisao": "2026-01-10",
				Motivo: "Chuva",
			},
		]),
		"Replanejamento",
	);
	const measurementRows = [
		{
			Indice: "1",
			"Data da medicao": "2026-01-15",
			"Percentual medido acumulado": 0.5,
			"Quantidade medida acumulada": 5,
			Observacao: "Parcial",
		},
	];
	if (options.badMeasurement) {
		measurementRows.push({
			Indice: "9.9",
			"Data da medicao": "2026-02-10",
			"Percentual medido acumulado": 0.1,
			"Quantidade medida acumulada": 1,
			Observacao: "Rejeitada",
		});
	}
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet(measurementRows),
		"Medicoes",
	);
	XLSX.utils.book_append_sheet(
		wb,
		XLSX.utils.json_to_sheet([
			{
				"Data do lancamento": "2026-01-20",
				"Indice apropriado": "1.1",
				Categoria: "Material",
				Descricao: "NF",
				"Valor realizado": 200,
				Tipo: "Atual",
				"Documento origem": "NF-1",
			},
		]),
		"Custos Realizados",
	);
	return new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function makeParsedWorkbook(bytes: Uint8Array = makeWorkbookBytes()) {
	return parseWorkbookByKind(bytes, "unificado.xlsx", "obra-completa");
}

beforeEach(() => {
	findWorkByOwnerAndCode.mockClear();
	createWorkWithImport.mockClear();
	replaceWorkWithImport.mockClear();
	getImportById.mockClear();
	findWorkByOwnerAndCode.mockResolvedValue(null);
	getImportById.mockResolvedValue(null);
});

describe("previewWorkbook", () => {
	it("validates and resolves dependencies in memory without persisting", async () => {
		const { previewWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		const result = await previewWorkbook(
			makeWorkbookBytes(),
			"unificado.xlsx",
			"obra-completa",
		);

		expect(result).toMatchObject({
			preview: true,
			importId: null,
			workId: null,
			status: "PENDING",
		});
		expect(createWorkWithImport).not.toHaveBeenCalled();
		expect(replaceWorkWithImport).not.toHaveBeenCalled();
		expect(findWorkByOwnerAndCode).not.toHaveBeenCalled();
		expect(result.errors).toEqual([]);
		expect(result.rejectedCount).toBe(0);
		expect(result.importedCount).toBeGreaterThan(0);
	});

	it("reports rejected rows from dependency resolution without touching the active import", async () => {
		const { previewWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		const result = await previewWorkbook(
			makeWorkbookBytes({ badMeasurement: true }),
			"unificado.xlsx",
			"obra-completa",
		);

		expect(result.rejectedCount).toBe(1);
		expect(result.errors).toEqual([
			expect.objectContaining({
				sheet: "Medicoes",
				row: 3,
				code: "UNKNOWN_BUDGET_INDEX",
			}),
		]);
		expect(createWorkWithImport).not.toHaveBeenCalled();
	});

	it("rejects unknown workbook kinds", async () => {
		const { previewWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		await expect(
			previewWorkbook(makeWorkbookBytes(), "x.xlsx", "inexistente" as never),
		).rejects.toMatchObject({ code: "INVALID_KIND", status: 400 });
	});
});

describe("importWorkbook reprocess chain", () => {
	it("rejects medicao-contrato with 422 MODEL_NOT_SUPPORTED (nao persiste contrato)", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		await expect(
			importWorkbook("owner-1", makeParsedWorkbook(), "cc-1", true, {
				kind: "medicao-contrato",
			}),
		).rejects.toMatchObject({
			code: "MODEL_NOT_SUPPORTED",
			status: 422,
		});
		expect(createWorkWithImport).not.toHaveBeenCalled();
		expect(replaceWorkWithImport).not.toHaveBeenCalled();
	});

	it("rejects reprocessOfId from another work with 422 INVALID_REPROCESS_ORIGIN", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);
		findWorkByOwnerAndCode.mockResolvedValue({ id: "work-1" } as never);
		getImportById.mockResolvedValue({
			id: "import-0",
			workId: "work-other",
		} as never);

		await expect(
			importWorkbook("owner-1", makeParsedWorkbook(), "cc-1", true, {
				reprocessOfId: "import-0",
			}),
		).rejects.toMatchObject({
			code: "INVALID_REPROCESS_ORIGIN",
			status: 422,
			message: "Origem de reprocessamento incompativel com a obra",
		});
		expect(createWorkWithImport).not.toHaveBeenCalled();
		expect(replaceWorkWithImport).not.toHaveBeenCalled();
	});

	it("rejects reprocessOfId when the target work does not exist yet", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);
		getImportById.mockResolvedValue({
			id: "import-0",
			workId: "work-1",
		} as never);

		await expect(
			importWorkbook("owner-1", makeParsedWorkbook(), "cc-1", true, {
				reprocessOfId: "import-0",
			}),
		).rejects.toMatchObject({
			code: "INVALID_REPROCESS_ORIGIN",
			status: 422,
		});
	});

	it("returns 404 when the reprocess origin does not exist", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);
		findWorkByOwnerAndCode.mockResolvedValue({ id: "work-1" } as never);

		await expect(
			importWorkbook("owner-1", makeParsedWorkbook(), "cc-1", true, {
				reprocessOfId: "missing-import",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("persists reprocessOfId when the origin belongs to the same work", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);
		findWorkByOwnerAndCode.mockResolvedValue({ id: "work-1" } as never);
		getImportById.mockResolvedValue({
			id: "import-0",
			workId: "work-1",
		} as never);

		await importWorkbook("owner-1", makeParsedWorkbook(), "cc-1", true, {
			reprocessOfId: "import-0",
			reason: "correcao de linhas rejeitadas",
		});

		expect(replaceWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ reprocessOfId: "import-0" }),
		);
	});
});

describe("importWorkbook errorSummary", () => {
	it("persists errorSummary when there are rejected rows", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		const parsed = parseWorkbookByKind(
			makeWorkbookBytes({ badMeasurement: true }),
			"unificado.xlsx",
			"obra-completa",
		);
		await importWorkbook("owner-1", parsed, "cc-1");

		expect(createWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			expect.anything(),
			"cc-1",
			expect.anything(),
			expect.objectContaining({
				errorSummary: {
					rejectedCount: 1,
					warnings: [],
					errors: [
						expect.objectContaining({
							sheet: "Medicoes",
							row: 3,
							code: "UNKNOWN_BUDGET_INDEX",
						}),
					],
				},
			}),
		);
	});

	it("keeps errorSummary null and reprocessOfId null on a clean import", async () => {
		const { importWorkbook } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		await importWorkbook("owner-1", makeParsedWorkbook(), "cc-1");

		expect(createWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			expect.anything(),
			"cc-1",
			expect.anything(),
			expect.objectContaining({ errorSummary: null, reprocessOfId: null }),
		);
	});
});

describe("buildRejectedSheet", () => {
	it("builds an xlsx with rejected rows preserving original columns plus error columns", async () => {
		const { buildRejectedSheet } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		const bytes = await buildRejectedSheet(
			makeWorkbookBytes({ badMeasurement: true }),
			"rejeitados.xlsx",
			"obra-completa",
		);

		const wb = XLSX.read(bytes, { type: "buffer" });
		expect(wb.SheetNames).toContain("Medicoes");
		const rows = XLSX.utils.sheet_to_json(wb.Sheets.Medicoes, {
			header: 1,
			defval: null,
		});
		expect(rows[0]).toEqual([
			"Indice",
			"Data da medicao",
			"Percentual medido acumulado",
			"Quantidade medida acumulada",
			"Observacao",
			"Aba",
			"Linha",
			"Código",
			"Mensagem",
		]);
		expect(rows[1]).toEqual([
			"9.9",
			"2026-02-10",
			0.1,
			1,
			"Rejeitada",
			"Medicoes",
			3,
			"UNKNOWN_BUDGET_INDEX",
			"Indice nao encontrado no orcamento",
		]);
	});

	it("returns a header-only sheet when nothing is rejected", async () => {
		const { buildRejectedSheet } = await import(
			"../../../../../src/modules/construction-planning/imports/import-service"
		);

		const bytes = await buildRejectedSheet(
			makeWorkbookBytes(),
			"ok.xlsx",
			"obra-completa",
		);

		const wb = XLSX.read(bytes, { type: "buffer" });
		const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
			header: 1,
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual(["Aba", "Linha", "Código", "Mensagem"]);
	});
});
