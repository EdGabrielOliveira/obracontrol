import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as XLSX from "xlsx";
import * as exportRepo from "../../../../src/modules/construction-planning/export.repository";
import { ExportService } from "../../../../src/modules/construction-planning/export.service";

const auditLog = mock(async (input: Record<string, unknown>) => ({
	id: "audit-1",
	...input,
}));

function makeService() {
	return new ExportService({ log: auditLog } as never);
}

function mockExportRepository() {
	const getBudgetItems = spyOn(
		exportRepo,
		"getBudgetItemsForExport",
	).mockResolvedValue([
		{
			index: "1.1",
			type: "ITEM",
			description: "Item A",
			unit: "m2",
			quantity: 10,
			laborUnitCost: 10,
			materialUnitCost: 40,
			equipmentUnitCost: 0,
			otherUnitCost: 0,
			unitCost: 50,
			totalCost: 500,
			plannedStart: new Date("2026-01-01"),
			plannedEnd: new Date("2026-01-31"),
			actualStart: new Date("2026-01-05"),
			actualEnd: null,
			completionPercentage: 0.5,
			computedStatus: "IN_PROGRESS",
		},
	] as never[]);
	const getBudgetVersions = spyOn(
		exportRepo,
		"getBudgetVersionsForExport",
	).mockResolvedValue([] as never[]);
	const getBaselineSchedules = spyOn(
		exportRepo,
		"getBaselineSchedulesForExport",
	).mockResolvedValue([
		{
			index: "1.1",
			budgetItem: {
				description: "Item A",
				unit: "m2",
				quantity: 10,
				unitCost: 50,
				totalCost: 500,
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-01-31"),
				actualStart: new Date("2026-01-05"),
				actualEnd: null,
				completionPercentage: 0.5,
				computedStatus: "IN_PROGRESS",
			},
			plannedStart: new Date("2026-01-01"),
			plannedEnd: new Date("2026-01-31"),
			plannedWeight: 1,
		},
	] as never[]);
	const getMeasurements = spyOn(
		exportRepo,
		"getMeasurementsWithBudgetItemForExport",
	).mockResolvedValue([
		{
			index: "1.1",
			budgetItem: { description: "Item A" },
			measurementDate: new Date("2026-01-15"),
			measuredPercentageAccumulated: 50,
			measuredQuantityAccumulated: 5,
			notes: "",
		},
	] as never[]);
	const getActualCosts = spyOn(
		exportRepo,
		"getActualCostsForExport",
	).mockResolvedValue([
		{
			costDate: new Date("2026-01-10"),
			category: "MATERIAL",
			description: "Cimento",
			amount: 200,
			costType: "CURRENT",
			supplierName: "Fornecedor A",
			paymentStatus: "PAID",
		},
	] as never[]);
	const getContracts = spyOn(
		exportRepo,
		"getContractsWithDetailsForExport",
	).mockResolvedValue([
		{
			code: "CT-001",
			supplierName: "Fornecedor A",
			title: "Contrato 1",
			contractValue: 10000,
			status: "ATIVO",
			services: [
				{ description: "Servico A", totalCost: 6000 },
				{ description: "Servico B", totalCost: 4000 },
			],
			measurements: [
				{
					number: 1,
					date: new Date("2026-01-15"),
					items: [{ measuredValue: 2000 }],
				},
			],
			payments: [{ paidValue: 1500 }],
		},
	] as never[]);
	const getWorkInfo = spyOn(
		exportRepo,
		"getWorkInfoForExport",
	).mockResolvedValue({
		code: "OBRA-001",
		name: "Obra Teste",
	} as never);
	const getMeasurementsSimple = spyOn(
		exportRepo,
		"getMeasurementsForExport",
	).mockResolvedValue([] as never[]);
	const getContractsSimple = spyOn(
		exportRepo,
		"getContractsSimpleForExport",
	).mockResolvedValue([] as never[]);
	const resolveExportSource = spyOn(
		exportRepo,
		"resolveExportSource",
	).mockResolvedValue({
		mode: "LIVE",
		persisted: null,
	} as never);

	return {
		getBudgetItems,
		getBudgetVersions,
		getBaselineSchedules,
		getMeasurements,
		getActualCosts,
		getContracts,
		getWorkInfo,
		getMeasurementsSimple,
		getContractsSimple,
		resolveExportSource,
	};
}

async function readWorkbook(response: Response): Promise<XLSX.WorkBook> {
	return XLSX.read(await response.arrayBuffer(), { type: "array" });
}

function metadadosValue(wb: XLSX.WorkBook, campo: string): string {
	const row = XLSX.utils
		.sheet_to_json<Record<string, string>>(wb.Sheets.Metadados)
		.find((r) => r.Campo === campo);
	return String(row?.Valor ?? "");
}

describe("export service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("exporta orcamento como xlsx com aba Metadados", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportOrcamento("owner-1", "work-1", {
			actor: { id: "user-1", name: "Fulano" },
		});

		expect(mocks.getBudgetItems).toHaveBeenCalledWith("owner-1", "work-1");
		expect(mocks.resolveExportSource).toHaveBeenCalledWith("owner-1", "work-1");
		expect(response).toBeInstanceOf(Response);
		expect(response.headers.get("content-type")).toContain("spreadsheetml");
		expect(response.headers.get("content-disposition")).toContain(
			"orcamento.xlsx",
		);

		const wb = await readWorkbook(response);
		expect(wb.SheetNames).toContain("Metadados");
		expect(wb.SheetNames).toContain("Orcamento");
		expect(wb.SheetNames).toContain("Cronograma Original");
		expect(metadadosValue(wb, "Obra")).toBe("Obra Teste");
		expect(metadadosValue(wb, "Codigo da Obra")).toBe("OBRA-001");
		expect(metadadosValue(wb, "Fonte")).toBe("LIVE");
		expect(metadadosValue(wb, "Versao do Snapshot")).toBe("");
		expect(metadadosValue(wb, "Usuario ID")).toBe("user-1");
		expect(metadadosValue(wb, "Usuario Nome")).toBe("Fulano");
		expect(metadadosValue(wb, "Data de Geracao")).not.toBe("");
	});

	it("exporta o aditivo em abas de historico sem misturar o rascunho no vigente", async () => {
		const mocks = mockExportRepository();
		mocks.getBudgetVersions.mockResolvedValue([
			{
				versionNumber: 2,
				label: "Aditivo 1",
				status: "DRAFT",
				isActive: false,
				reason: "Inclusao de servico",
				kind: "ACRESCIMO",
				acrescimoBruto: 1250,
				supressao: 0,
				impactoLiquido: 1250,
				percentualImpacto: 10,
				items: [
					{
						index: "2.1",
						type: "ITEM",
						description: "Servico aditivado",
						unit: "un",
						quantity: 5,
						unitCost: 250,
						totalCost: 1250,
						plannedStart: new Date("2026-02-01"),
						plannedEnd: new Date("2026-02-10"),
					},
				],
			},
		] as never);

		const response = await makeService().exportOrcamento("owner-1", "work-1");
		const wb = await readWorkbook(response);
		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			wb.Sheets["Versoes Orcamento"],
		);

		expect(mocks.getBudgetVersions).toHaveBeenCalledWith("owner-1", "work-1");
		expect(rows[0]).toMatchObject({
			Versao: 2,
			Status: "DRAFT",
			Aditivo: "Aditivo 1",
			Indice: "2.1",
			Descricao: "Servico aditivado",
			"Custo unitario": 250,
			"Valor total": 1250,
		});
		expect(rows[0]).toHaveProperty("Motivo", "Inclusao de servico");
	});

	it("exporta orcamento repassando asOfDate para os Metadados", async () => {
		mockExportRepository();

		const response = await makeService().exportOrcamento("owner-1", "work-1", {
			asOfDate: new Date("2026-01-15"),
		});

		const wb = await readWorkbook(response);
		expect(metadadosValue(wb, "Filtro asOfDate")).toBe("15/01/2026");
		expect(metadadosValue(wb, "Data de Corte")).toBe("15/01/2026");
	});

	it("exporta orcamento em modo raw com chaves tecnicas, enums e null", async () => {
		mockExportRepository();

		const response = await makeService().exportOrcamento("owner-1", "work-1", {
			mode: "raw",
			actor: { id: "user-1", name: "Fulano" },
		});

		const wb = await readWorkbook(response);
		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			wb.Sheets.Orcamento,
		);
		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row).toHaveProperty("index", "1.1");
		expect(row).toHaveProperty("type", "ITEM");
		expect(row).toHaveProperty("description", "Item A");
		expect(row).toHaveProperty("unit", "m2");
		expect(row).toHaveProperty("quantity", 10);
		expect(row).toHaveProperty("status", "IN_PROGRESS");
		expect(row).toHaveProperty("unit_cost", 50);
		expect(row).toHaveProperty("total_cost", 500);
		expect(row).toHaveProperty("planned_start", "01/01/2026");
		expect(row).not.toHaveProperty("Índice");
		expect(metadadosValue(wb, "Modo")).toBe("raw");
	});

	it("modo report permanece o padrao com rotulos legiveis", async () => {
		mockExportRepository();

		const response = await makeService().exportOrcamento("owner-1", "work-1", {
			actor: { id: "user-1" },
		});

		const wb = await readWorkbook(response);
		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			wb.Sheets.Orcamento,
		);
		expect(rows[0]).toHaveProperty("Índice", "1.1");
		expect(rows[0]).toHaveProperty("Situação", "IN_PROGRESS");
		expect(rows[0]).toHaveProperty("Custo unitário", 50);
		expect(rows[0]).toHaveProperty("Valor total", 500);
		expect(rows[0]).toHaveProperty("Início previsto", "01/01/2026");
		expect(metadadosValue(wb, "Modo")).toBe("report");
	});

	it("exporta cronograma como xlsx com aba Metadados", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportCronograma("owner-1", "work-1");

		expect(mocks.getBaselineSchedules).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
		);
		const wb = await readWorkbook(response);
		expect(wb.SheetNames).toContain("Metadados");
		expect(wb.SheetNames).toContain("Cronograma Original");
		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			wb.Sheets["Cronograma Original"],
		);
		expect(rows[0]).toHaveProperty("Descrição", "Item A");
		expect(rows[0]).toHaveProperty("Unidade", "m2");
		expect(rows[0]).toHaveProperty("Custo unitário", 50);
		expect(rows[0]).toHaveProperty("Valor total", 500);
		expect(rows[0]).toHaveProperty("Início real", "05/01/2026");
	});

	it("exporta medicoes como xlsx com aba Metadados", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportMedicoes("owner-1", "work-1");

		expect(mocks.getMeasurements).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			undefined,
		);
		const wb = await readWorkbook(response);
		expect(wb.SheetNames).toContain("Metadados");
		expect(wb.SheetNames).toContain("Medicoes Obra");
	});

	it("exporta custos como xlsx com aba Metadados", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportCustos("owner-1", "work-1");

		expect(mocks.getActualCosts).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			undefined,
		);
		const wb = await readWorkbook(response);
		expect(wb.SheetNames).toContain("Metadados");
		expect(wb.SheetNames).toContain("Custos Realizados");
	});

	it("exporta contratos como xlsx com aba Metadados", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportContratos("owner-1", "work-1");

		expect(mocks.getContractsSimple).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			undefined,
		);
		const wb = await readWorkbook(response);
		expect(wb.SheetNames).toContain("Metadados");
		expect(wb.SheetNames).toContain("Contrato");
	});

	it("IMP-004: exporta contratos com abas de servicos, medicoes e pagamentos", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportContratos("owner-1", "work-1");

		expect(mocks.getContracts).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			undefined,
		);
		const wb = await readWorkbook(response);

		expect(wb.SheetNames).toContain("Servicos");
		expect(wb.SheetNames).toContain("Medicoes");
		expect(wb.SheetNames).toContain("Pagamentos");

		const services = XLSX.utils.sheet_to_json<Record<string, string | number>>(
			wb.Sheets.Servicos,
		);
		expect(services).toHaveLength(2);
		expect(services[0]).toMatchObject({
			Contrato: "CT-001",
			Descricao: "Servico A",
			"Valor Total": 6000,
		});

		const measurements = XLSX.utils.sheet_to_json<
			Record<string, string | number>
		>(wb.Sheets.Medicoes);
		expect(measurements[0]).toMatchObject({
			Contrato: "CT-001",
			Medicao: 1,
			"Valor Medido": 2000,
		});

		const payments = XLSX.utils.sheet_to_json<Record<string, string | number>>(
			wb.Sheets.Pagamentos,
		);
		expect(payments[0]).toMatchObject({
			Contrato: "CT-001",
			"Valor Pago": 1500,
		});
	});

	it("exporta completo como xlsx com multiplas abas e Metadados", async () => {
		const mocks = mockExportRepository();

		const response = await makeService().exportCompleto("owner-1", "work-1");

		expect(mocks.getWorkInfo).toHaveBeenCalledWith("owner-1", "work-1");
		expect(response.headers.get("content-disposition")).toContain(
			"OBRA-001-completo.xlsx",
		);

		const wb = await readWorkbook(response);
		expect(wb.SheetNames).toEqual(
			expect.arrayContaining([
				"Metadados",
				"Obra",
				"Orcamento",
				"Cronograma Original",
				"Medicoes Obra",
				"Custos Realizados",
				"Contrato",
			]),
		);
	});

	it("exporta completo lancando 404 quando obra nao existe", async () => {
		mockExportRepository();
		spyOn(exportRepo, "getWorkInfoForExport").mockResolvedValue(null as never);

		await expect(
			makeService().exportCompleto("owner-1", "missing"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});
	});

	it("grava AuditLog por export com kind, fonte e arquivo", async () => {
		mockExportRepository();

		await makeService().exportOrcamento("owner-1", "work-1", {
			asOfDate: new Date("2026-01-15"),
			actor: { id: "user-1", name: "Fulano" },
		});

		expect(auditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				ownerId: "owner-1",
				action: "EXPORT",
				entityType: "EXPORT",
				entityId: "work-1",
				newState: expect.objectContaining({
					kind: "orcamento",
					asOfDate: "2026-01-15T00:00:00.000Z",
					sourceMode: "LIVE",
					fileName: "orcamento.xlsx",
				}),
			}),
		);
	});

	it("grava AuditLog em LIVE sem versao de snapshot", async () => {
		mockExportRepository();

		await makeService().exportContratos("owner-1", "work-1");

		expect(auditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "EXPORT",
				entityType: "EXPORT",
				entityId: "work-1",
				newState: expect.objectContaining({
					kind: "contratos",
					sourceMode: "LIVE",
					asOfDate: null,
					fileName: "contratos.xlsx",
				}),
			}),
		);
	});
});
