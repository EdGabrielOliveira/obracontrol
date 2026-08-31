import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";
import { ConstructionBIService } from "../../../../src/modules/construction-planning/bi/bi-service";
import { buildWorkMetricsSnapshot } from "../../../../src/modules/construction-planning/bi/work-metrics-snapshot";
import type { BudgetMutationResult } from "../../../../src/modules/construction-planning/budget-control/budget-control.types";
import * as importRepository from "../../../../src/modules/construction-planning/imports/import-repository";
import { importWorkbook } from "../../../../src/modules/construction-planning/imports/import-service";
import * as repository from "../../../../src/modules/construction-planning/repository";
import { ConstructionScheduleService } from "../../../../src/modules/construction-planning/schedule/schedule-service";
import type {
	ParsedActualCostRow,
	ParsedBaselineRow,
	ParsedBudgetRow,
	ParsedMeasurementRow,
	ParsedReplanningRow,
	ParsedWorkbook,
} from "../../../../src/modules/construction-planning/types";

mock.module(
	"../../../../src/modules/construction-planning/work-measurement.repository",
	() => ({
		getWorkMeasurementsForBI: mock(async () => []),
		getWorkMeasurementsForManyWorks: mock(async () => new Map()),
		listWorkMeasurements: mock(async () => ({
			data: [],
			total: 0,
			page: 1,
			limit: 10,
		})),
		getWorkMeasurementById: mock(async () => null),
		createWorkMeasurement: mock(async () => ({ id: "wm-1" })),
		updateWorkMeasurement: mock(async () => null),
		deleteWorkMeasurement: mock(async () => ({ id: "wm-1" })),
		getWorkMeasurementMap: mock(async () => ({})),
		getWorkMeasurementReports: mock(async () => ({})),
		getWorkMeasurementSummary: mock(async () => ({})),
	}),
);

mock.module("../../../../src/lib/transaction-retry", () => ({
	withSerializableRetry: async (operation: (tx: never) => Promise<unknown>) =>
		operation({} as never),
}));

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		findActiveImpactsBySource: mock(async () => []),
		createImpact: mock(async () => ({ id: "impact-1" })),
		findImpactById: mock(async () => null),
		findImpactByKey: mock(async () => null),
		getBalanceRows: mock(async () => []),
		getBudgetItemReferences: mock(async () => ({ found: [], missing: [] })),
		setImpactStatus: mock(async () => null),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/ledger/ledger.integration",
	() => ({
		buildGeneralCostEvents: mock(() => []),
		competenceOf: mock(() => "2026-01"),
		GENERAL_COST_SOURCE_TYPE: "GENERAL_COST",
		resolveLedgerItemRef: mock(async () => null),
	}),
);

// Resolver fake: o overview consome a fonte canonica; aqui ele replica o
// caminho LIVE sobre o repository espionado (work + medicoes manuais).
const resolverResolve = mock(
	async (request: { ownerId: string; workId: string; asOfDate?: Date }) => {
		const work = await repository.getWorkWithItems(
			request.ownerId,
			request.workId,
		);
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		const snapshot = buildWorkMetricsSnapshot({
			work: work as never,
			manualMeasurements: await repository.getWorkMeasurementsForBI(
				request.ownerId,
				request.workId,
			),
			asOf: request.asOfDate,
		});
		return {
			mode: "LIVE",
			ownerId: request.ownerId,
			workId: request.workId,
			snapshotId: null,
			version: null,
			fingerprint: "live",
			asOfDate: snapshot.metrics.dataDate,
			input: snapshot.input,
			metrics: snapshot.metrics,
			series: { points: [] },
			contracts: [],
			quality: { missing: 0, invalid: 0, unlinked: 0, duplicated: 0, stale: 0 },
			snapshot: null,
		};
	},
);

const biService = new ConstructionBIService(repository, undefined, {
	resolve: resolverResolve,
} as never);
const scheduleService = new ConstructionScheduleService(repository);

const getWorkBI = (ownerId: string, workId: string) =>
	biService.getWorkBI(ownerId, workId);
const getMultiworksBI = (
	ownerId: string,
	filter?: Parameters<typeof biService.getMultiworksBI>[1],
) => biService.getMultiworksBI(ownerId, filter);
const getSchedule = (ownerId: string, workId: string) =>
	scheduleService.getWorkSchedule(ownerId, workId);

function mockRepository() {
	const createdImport = {
		workId: "work-1",
		importId: "import-1",
		importedSections: ["Obra", "Orcamento", "Medicoes"],
	};
	const replacementImport = {
		workId: "work-existing",
		importId: "import-replacement",
		importedSections: ["Obra", "Orcamento", "Medicoes"],
	};
	const findWorkByOwnerAndCode = spyOn(
		repository,
		"findWorkByOwnerAndCode",
	).mockResolvedValue(null);
	const createWorkWithImport = spyOn(
		repository,
		"createWorkWithImport",
	).mockResolvedValue(createdImport);
	const replaceWorkWithImport = spyOn(
		repository,
		"replaceWorkWithImport",
	).mockResolvedValue(replacementImport);

	return {
		findWorkByOwnerAndCode,
		createWorkWithImport,
		replaceWorkWithImport,
	};
}

function makeWorkbook(): ParsedWorkbook {
	return {
		fileName: "unificado.xlsx",
		sheetName: "Obra",
		header: {
			workCode: "LEGACY-CODE",
			workName: "Legacy Name",
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
		},
		work: {
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: "Cliente A",
			baseDate: "2026-01-15",
			plannedStart: "2026-01-01",
			plannedEnd: "2026-12-31",
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
		},
		budgetRows: [
			{
				rowNumber: 2,
				index: "1",
				type: "Item",
				description: "Escavacao",
				unit: "m3",
				quantity: 10,
				laborUnitCost: 20,
				materialUnitCost: 30,
				equipmentUnitCost: 5,
				otherUnitCost: 2,
				providedStatus: "Ativo",
			},
		],
		itensRows: [],
		baselineRows: [
			{
				rowNumber: 2,
				index: "1",
				plannedStart: "2026-01-01",
				plannedEnd: "2026-01-31",
				plannedWeight: null,
			},
		],
		replanningRows: [
			{
				rowNumber: 2,
				index: "1",
				version: "R1",
				replannedStart: "2026-01-05",
				replannedEnd: "2026-02-05",
				revisionDate: "2026-01-10",
				reason: "Chuva",
			},
		],
		measurementRows: [
			{
				rowNumber: 2,
				index: "1",
				measurementDate: "2026-01-15",
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: 5,
				notes: "Parcial",
			},
		],
		actualCostRows: [
			{
				rowNumber: 2,
				costDate: "2026-01-20",
				budgetIndex: "1",
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
		contractRows: [],
		serviceRows: [],
		contractMeasurementRows: [],
		paymentRows: [],
		quotationRows: [],
		sheetNames: [
			"Obra",
			"Orcamento",
			"Cronograma Original",
			"Replanejamento",
			"Medicoes",
			"Custos Realizados",
		],
	};
}

function makeStoredUnifiedWork() {
	return {
		id: "work-1",
		ownerId: "owner-1",
		code: "OBRA-001",
		name: "Obra Unificada",
		clientName: "Cliente A",
		plannedStart: new Date("2026-01-01T00:00:00.000Z"),
		plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
		baseDate: new Date("2026-01-15T00:00:00.000Z"),
		activeImportId: "import-1",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		imports: [{ createdAt: new Date("2026-01-02T00:00:00.000Z") }],
		items: [
			{
				id: "stage-1",
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Fundacao",
				unit: null,
				quantity: null,
				unitCost: null,
				totalCost: 0,
				totalBudget: 0,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: null,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
			{
				id: "item-1",
				parentId: "stage-1",
				index: "1.1",
				type: "ITEM",
				description: "Escavacao",
				unit: "m3",
				quantity: 10,
				unitCost: 55,
				totalCost: 550,
				totalBudget: 550,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: 0,
				providedStatus: "Ativo",
				computedStatus: "IN_PROGRESS",
				sortOrder: 2,
			},
		],
		baselineSchedules: [
			{
				id: "baseline-1",
				budgetItemId: "item-1",
				index: "1.1",
				plannedStart: new Date("2026-01-01T00:00:00.000Z"),
				plannedEnd: new Date("2026-01-31T00:00:00.000Z"),
				plannedWeight: null,
			},
		],
		scheduleRevisions: [
			{
				id: "revision-1",
				budgetItemId: "item-1",
				index: "1.1",
				version: "R1",
				replannedStart: new Date("2026-01-05T00:00:00.000Z"),
				replannedEnd: new Date("2026-02-05T00:00:00.000Z"),
				revisionDate: new Date("2026-01-10T00:00:00.000Z"),
				reason: "Chuva",
			},
		],
		measurements: [
			{
				id: "measurement-1",
				budgetItemId: "item-1",
				index: "1.1",
				measurementDate: new Date("2026-01-15T00:00:00.000Z"),
				measuredPercentageAccumulated: 0.5,
				measuredQuantityAccumulated: null,
			},
		],
		actualCosts: [
			{
				id: "cost-1",
				budgetItemId: "item-1",
				budgetIndex: "1.1",
				costDate: new Date("2026-01-10T00:00:00.000Z"),
				amount: 200,
				costType: "CURRENT",
				category: "MATERIAL",
				appropriationStatus: "APPROPRIATED",
			},
			{
				id: "cost-2",
				budgetItemId: null,
				budgetIndex: null,
				costDate: new Date("2026-01-12T00:00:00.000Z"),
				amount: 25,
				costType: "CURRENT",
				category: "OTHER",
				appropriationStatus: "UNAPPROPRIATED",
			},
		],
	};
}

beforeEach(() => {
	mock.restore();
});

afterEach(() => {
	mock.restore();
});

describe("construction service importWorkbook", () => {
	it("exposes the same import workflow through the imports boundary", async () => {
		const { findWorkByOwnerAndCode, createWorkWithImport } = mockRepository();

		const result = await importWorkbook("owner-1", makeWorkbook(), "cc-test");

		expect(findWorkByOwnerAndCode).toHaveBeenCalledWith("owner-1", "OBRA-001");
		expect(createWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({ code: "OBRA-001", name: "Edificio Horizonte" }),
			"cc-test",
			expect.any(Array),
			expect.objectContaining({ rowCount: 5 }),
		);
		expect(result).toMatchObject({
			importId: "import-1",
			workId: "work-1",
			status: "IMPORTED",
			rowCount: 5,
		});
	});

	it("forwards unified validation output when creating a work import", async () => {
		const { findWorkByOwnerAndCode, createWorkWithImport } = mockRepository();

		const result = await importWorkbook("owner-1", makeWorkbook(), "cc-test");

		expect(findWorkByOwnerAndCode).toHaveBeenCalledWith("owner-1", "OBRA-001");
		expect(createWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				code: "OBRA-001",
				name: "Edificio Horizonte",
				clientName: "Cliente A",
				importedSections: [
					"Obra",
					"Orcamento",
					"Cronograma Original",
					"Replanejamento",
					"Medicoes",
					"Custos Realizados",
				],
			}),
			"cc-test",
			expect.arrayContaining([
				expect.objectContaining({
					laborUnitCost: 20,
					materialUnitCost: 30,
					equipmentUnitCost: 5,
					otherUnitCost: 2,
					unitCostTotal: 57,
					totalBudget: 570,
				}),
			]),
			expect.objectContaining({
				baselineSchedules: expect.any(Array),
				scheduleRevisions: expect.any(Array),
				measurements: expect.any(Array),
				actualCosts: expect.any(Array),
				rowCount: 5,
			}),
		);
		expect(result).toMatchObject({
			rowCount: 5,
			warningCount: 0,
			importedSections: [
				"Obra",
				"Orcamento",
				"Cronograma Original",
				"Replanejamento",
				"Medicoes",
				"Custos Realizados",
			],
		});
	});

	it("forwards unified validation output when replacing a work import", async () => {
		const { findWorkByOwnerAndCode, replaceWorkWithImport } = mockRepository();
		findWorkByOwnerAndCode.mockResolvedValue({
			id: "work-existing",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Old",
			costCenterId: "cc-test",
			address: null,
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			activeImportId: null,
			structuredAddressId: null,
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
			bdiPercentage: null,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		const result = await importWorkbook("owner-1", makeWorkbook(), "cc-test");

		expect(replaceWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			"work-existing",
			expect.objectContaining({
				code: "OBRA-001",
				name: "Edificio Horizonte",
				clientName: "Cliente A",
				importedSections: [
					"Obra",
					"Orcamento",
					"Cronograma Original",
					"Replanejamento",
					"Medicoes",
					"Custos Realizados",
				],
			}),
			expect.arrayContaining([
				expect.objectContaining({
					laborUnitCost: 20,
					materialUnitCost: 30,
					equipmentUnitCost: 5,
					otherUnitCost: 2,
					unitCostTotal: 57,
					totalBudget: 570,
				}),
			]),
			expect.objectContaining({
				baselineSchedules: expect.any(Array),
				scheduleRevisions: expect.any(Array),
				measurements: expect.any(Array),
				actualCosts: expect.any(Array),
				rowCount: 5,
			}),
		);
		expect(result).toMatchObject({
			importedSections: [
				"Obra",
				"Orcamento",
				"Cronograma Original",
				"Replanejamento",
				"Medicoes",
				"Custos Realizados",
			],
		});
	});

	it("does not replace an existing work import when replacement is disabled", async () => {
		const {
			findWorkByOwnerAndCode,
			createWorkWithImport,
			replaceWorkWithImport,
		} = mockRepository();
		findWorkByOwnerAndCode.mockResolvedValue({
			id: "work-existing",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Old",
			costCenterId: "cc-test",
			address: null,
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			activeImportId: null,
			structuredAddressId: null,
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
			bdiPercentage: null,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		createWorkWithImport.mockClear();
		replaceWorkWithImport.mockClear();

		await expect(
			importWorkbook("owner-1", makeWorkbook(), "cc-test", false),
		).rejects.toMatchObject({
			code: "WORK_EXISTS",
			status: 409,
		});
		expect(createWorkWithImport).not.toHaveBeenCalled();
		expect(replaceWorkWithImport).not.toHaveBeenCalled();
	});
});

describe("construction import orchestrator", () => {
	function budgetRow(
		rowNumber: number,
		index: string,
		overrides: Partial<ParsedBudgetRow> = {},
	): ParsedBudgetRow {
		return {
			rowNumber,
			index,
			type: "Item",
			description: `Item ${index}`,
			unit: "m2",
			quantity: 10,
			laborUnitCost: 10,
			materialUnitCost: 10,
			equipmentUnitCost: 0,
			otherUnitCost: 0,
			providedStatus: "Ativo",
			...overrides,
		};
	}

	function baselineRow(rowNumber: number, index: string): ParsedBaselineRow {
		return {
			rowNumber,
			index,
			plannedStart: "2026-01-01",
			plannedEnd: "2026-01-31",
			plannedWeight: null,
		};
	}

	function replanningRow(
		rowNumber: number,
		index: string,
	): ParsedReplanningRow {
		return {
			rowNumber,
			index,
			version: "R1",
			replannedStart: "2026-01-05",
			replannedEnd: "2026-02-05",
			revisionDate: "2026-01-10",
			reason: "Chuva",
		};
	}

	function measurementRow(
		rowNumber: number,
		index: string,
	): ParsedMeasurementRow {
		return {
			rowNumber,
			index,
			measurementDate: "2026-01-15",
			measuredPercentageAccumulated: 0.5,
			measuredQuantityAccumulated: 5,
			notes: null,
		};
	}

	function actualCostRow(
		rowNumber: number,
		index: string | null,
	): ParsedActualCostRow {
		return {
			rowNumber,
			costDate: "2026-01-20",
			budgetIndex: index,
			category: "Material",
			description: "NF",
			amount: 100,
			costType: "Atual",
			sourceDocument: "NF-1",
			supplierName: null,
			costGroup: null,
			paymentStatus: null,
			competenceDate: null,
			dueDate: null,
			paymentDate: null,
			documentNumber: null,
		};
	}

	function makePartialWorkbook(overrides: {
		sheets: string[];
		budgetRows?: ParsedBudgetRow[];
		itensRows?: ParsedBudgetRow[];
		baselineRows?: ParsedBaselineRow[];
		replanningRows?: ParsedReplanningRow[];
		measurementRows?: ParsedMeasurementRow[];
		actualCostRows?: ParsedActualCostRow[];
		workCode?: string;
	}): ParsedWorkbook {
		const sheets = new Set(overrides.sheets);
		return {
			fileName: "parcial.xlsx",
			sheetName: "Obra",
			header: {
				workCode: overrides.workCode ?? "OBRA-P1",
				workName: "Obra Parcial",
				plannedStart: null,
				plannedEnd: null,
				baseDate: null,
			},
			work: {
				code: overrides.workCode ?? "OBRA-P1",
				name: "Obra Parcial",
				clientName: null,
				baseDate: "2026-01-15",
				plannedStart: "2026-01-01",
				plannedEnd: "2026-12-31",
				areaM2: null,
				operationalStatus: null,
				responsibleName: null,
			},
			budgetRows: sheets.has("Orcamento") ? (overrides.budgetRows ?? []) : [],
			itensRows: sheets.has("Itens do Orcamento")
				? (overrides.itensRows ?? [])
				: [],
			baselineRows: sheets.has("Cronograma Original")
				? (overrides.baselineRows ?? [])
				: [],
			replanningRows: sheets.has("Replanejamento")
				? (overrides.replanningRows ?? [])
				: [],
			measurementRows: sheets.has("Medicoes")
				? (overrides.measurementRows ?? [])
				: [],
			actualCostRows: sheets.has("Custos Realizados")
				? (overrides.actualCostRows ?? [])
				: [],
			contractRows: [],
			serviceRows: [],
			contractMeasurementRows: [],
			paymentRows: [],
			quotationRows: [],
			sheetNames: overrides.sheets,
		};
	}

	function mockOrchestratorRepository() {
		const createdImport = { workId: "work-1", importId: "import-1" };
		const replacementImport = {
			workId: "work-existing",
			importId: "import-replacement",
		};
		const findWorkByOwnerAndCode = spyOn(
			repository,
			"findWorkByOwnerAndCode",
		).mockResolvedValue(null);
		const createWorkWithImport = spyOn(
			repository,
			"createWorkWithImport",
		).mockResolvedValue(createdImport);
		const replaceWorkWithImport = spyOn(
			repository,
			"replaceWorkWithImport",
		).mockResolvedValue(replacementImport);
		return {
			findWorkByOwnerAndCode,
			createWorkWithImport,
			replaceWorkWithImport,
		};
	}

	it("imports only the sheets present and reports partial success with rejected rows", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Orcamento", "Cronograma Original"],
				budgetRows: [budgetRow(2, "1"), budgetRow(3, "2", { type: null })],
				baselineRows: [baselineRow(2, "1")],
			}),
			"cc-test",
		);

		const [, , , persistedItems, options] = createWorkWithImport.mock.calls[0];
		expect(persistedItems).toHaveLength(1);
		expect(options).toMatchObject({
			baselineSchedules: [expect.objectContaining({ index: "1" })],
			rowCount: 2,
		});
		expect(result).toMatchObject({
			status: "IMPORTED",
			importId: "import-1",
			workId: "work-1",
			processedSheets: ["Obra", "Orcamento", "Cronograma Original"],
			importedCount: 2,
			rejectedCount: 1,
			rowCount: 2,
			warnings: [],
		});
		expect(result.errors).toEqual([
			expect.objectContaining({
				sheet: "Orcamento",
				row: 3,
				field: "Tipo",
				code: "MISSING_REQUIRED_FIELD",
			}),
		]);
	});

	it("accepts a workbook with a single sheet (Obra)", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({ sheets: ["Obra"] }),
			"cc-test",
		);

		const [, , , persistedItems, options] = createWorkWithImport.mock.calls[0];
		expect(persistedItems).toEqual([]);
		expect(options).toMatchObject({ rowCount: 0 });
		expect(result).toMatchObject({
			processedSheets: ["Obra"],
			importedCount: 0,
			rejectedCount: 0,
		});
	});

	it("orchestrates a budget-only workbook", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Orcamento"],
				budgetRows: [budgetRow(2, "1"), budgetRow(3, "1.1")],
			}),
			"cc-test",
		);

		const [, , , persistedItems, options] = createWorkWithImport.mock.calls[0];
		expect(persistedItems).toHaveLength(2);
		expect(options).toMatchObject({
			itens: [],
			baselineSchedules: [],
			scheduleRevisions: [],
			rowCount: 2,
		});
	});

	it("orchestrates Orcamento plus Itens do Orcamento sheets", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Orcamento", "Itens do Orcamento"],
				budgetRows: [budgetRow(2, "1")],
				itensRows: [budgetRow(2, "1"), budgetRow(3, "1.1")],
			}),
			"cc-test",
		);

		const [, , , persistedItems, options] = createWorkWithImport.mock.calls[0];
		expect(persistedItems).toHaveLength(1);
		expect(options).toMatchObject({
			itens: [
				expect.objectContaining({ index: "1" }),
				expect.objectContaining({ index: "1.1" }),
			],
			rowCount: 2,
		});
		expect(result).toMatchObject({
			importedCount: 2,
			rejectedCount: 0,
		});
	});

	it("orchestrates Orcamento plus Cronograma sheets", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Orcamento", "Cronograma Original"],
				budgetRows: [budgetRow(2, "1")],
				baselineRows: [baselineRow(2, "1")],
			}),
			"cc-test",
		);

		const [, , , , options] = createWorkWithImport.mock.calls[0];
		expect(options).toMatchObject({
			baselineSchedules: [expect.objectContaining({ index: "1" })],
			scheduleRevisions: [],
			rowCount: 2,
		});
	});

	it("orchestrates Orcamento plus Cronograma plus Replanejamento sheets", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Orcamento", "Cronograma Original", "Replanejamento"],
				budgetRows: [budgetRow(2, "1")],
				baselineRows: [baselineRow(2, "1")],
				replanningRows: [replanningRow(2, "1")],
			}),
			"cc-test",
		);

		const [, , , , options] = createWorkWithImport.mock.calls[0];
		expect(options).toMatchObject({
			baselineSchedules: [expect.objectContaining({ index: "1" })],
			scheduleRevisions: [expect.objectContaining({ index: "1" })],
			rowCount: 3,
		});
	});

	it("rejects only the dependent rows when the parent is missing from file and work", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Itens do Orcamento"],
				itensRows: [budgetRow(2, "1.1"), budgetRow(3, "2.1")],
			}),
			"cc-test",
		);

		const [, , , persistedItems, options] = createWorkWithImport.mock.calls[0];
		expect(persistedItems).toEqual([]);
		expect(options).toMatchObject({ itens: [], rowCount: 0 });
		expect(result).toMatchObject({
			importedCount: 0,
			rejectedCount: 2,
		});
		expect(result.errors).toEqual([
			expect.objectContaining({
				sheet: "Itens do Orcamento",
				row: 2,
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "1.1",
			}),
			expect.objectContaining({
				sheet: "Itens do Orcamento",
				row: 3,
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "2.1",
			}),
		]);
	});

	it("binds rows to existing work entities when the sheet is absent", async () => {
		const { findWorkByOwnerAndCode, replaceWorkWithImport } =
			mockOrchestratorRepository();
		findWorkByOwnerAndCode.mockResolvedValue({
			id: "work-existing",
			ownerId: "owner-1",
			code: "OBRA-P1",
			name: "Old",
			costCenterId: "cc-test",
			address: null,
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			activeImportId: null,
			structuredAddressId: null,
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
			bdiPercentage: null,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		const hasBudget = spyOn(
			importRepository,
			"existingActiveBudgetIndexes",
		).mockResolvedValue(new Set(["1.1"]));

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Cronograma Original"],
				baselineRows: [baselineRow(2, "1.1")],
			}),
			"cc-test",
		);

		expect(hasBudget).toHaveBeenCalledWith(
			{ ownerId: "owner-1", workId: "work-existing" },
			["1.1", "1"],
		);
		expect(replaceWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			"work-existing",
			expect.objectContaining({ code: "OBRA-P1" }),
			expect.any(Array),
			expect.objectContaining({
				baselineSchedules: [expect.objectContaining({ index: "1.1" })],
				rowCount: 1,
			}),
		);
		expect(result).toMatchObject({
			workId: "work-existing",
			importedCount: 1,
			rejectedCount: 0,
		});
	});

	it("generates a work code when the workbook omits it", async () => {
		const { findWorkByOwnerAndCode, createWorkWithImport } =
			mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Orcamento"],
				workCode: "",
				budgetRows: [budgetRow(2, "1")],
			}),
			"cc-test",
		);

		expect(findWorkByOwnerAndCode).toHaveBeenCalledWith(
			"owner-1",
			expect.stringMatching(/^OBRA-/),
		);
		expect(createWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({ code: expect.stringMatching(/^OBRA-/) }),
			"cc-test",
			expect.any(Array),
			expect.any(Object),
		);
		expect(result.status).toBe("IMPORTED");
	});

	it("accepts an Obra sheet without a manually supplied code", async () => {
		const { findWorkByOwnerAndCode, createWorkWithImport } =
			mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({ sheets: ["Obra"], workCode: "" }),
			"cc-test",
		);

		expect(findWorkByOwnerAndCode).toHaveBeenCalledWith(
			"owner-1",
			expect.stringMatching(/^OBRA-/),
		);
		expect(createWorkWithImport).toHaveBeenCalled();
		expect(result.status).toBe("IMPORTED");
	});

	it("keeps operational rows bound to the in-file budget", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Orcamento", "Medicoes", "Custos Realizados"],
				budgetRows: [budgetRow(2, "1")],
				measurementRows: [measurementRow(2, "1")],
				actualCostRows: [actualCostRow(2, "1")],
			}),
			"cc-test",
		);

		const [, , , , options] = createWorkWithImport.mock.calls[0];
		expect(options).toMatchObject({
			measurements: [expect.objectContaining({ index: "1" })],
			actualCosts: [expect.objectContaining({ budgetIndex: "1" })],
			rowCount: 3,
		});
		expect(result).toMatchObject({ importedCount: 3 });
	});

	it("binds measurement and actual-cost rows to the existing work budget when the Orcamento sheet is absent", async () => {
		const { findWorkByOwnerAndCode, replaceWorkWithImport } =
			mockOrchestratorRepository();
		findWorkByOwnerAndCode.mockResolvedValue({
			id: "work-existing",
			ownerId: "owner-1",
			code: "OBRA-P1",
			name: "Old",
			costCenterId: "cc-test",
			address: null,
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			activeImportId: null,
			structuredAddressId: null,
			areaM2: null,
			operationalStatus: null,
			responsibleName: null,
			bdiPercentage: null,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		const hasBudget = spyOn(
			importRepository,
			"existingActiveBudgetIndexes",
		).mockResolvedValue(new Set(["1.1"]));

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Medicoes", "Custos Realizados"],
				measurementRows: [measurementRow(2, "1.1")],
				actualCostRows: [actualCostRow(2, "1.1")],
			}),
			"cc-test",
		);

		expect(hasBudget).toHaveBeenCalledWith(
			{ ownerId: "owner-1", workId: "work-existing" },
			["1.1", "1"],
		);
		expect(replaceWorkWithImport).toHaveBeenCalledWith(
			"owner-1",
			"work-existing",
			expect.objectContaining({ code: "OBRA-P1" }),
			expect.any(Array),
			expect.objectContaining({
				measurements: [expect.objectContaining({ index: "1.1" })],
				actualCosts: [expect.objectContaining({ budgetIndex: "1.1" })],
				rowCount: 2,
			}),
		);
		expect(result).toMatchObject({
			workId: "work-existing",
			importedCount: 2,
			rejectedCount: 0,
		});
	});

	it("rejects measurement rows without a budget parent instead of discarding them silently", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Medicoes"],
				measurementRows: [measurementRow(2, "1.1")],
			}),
			"cc-test",
		);

		const [, , , , options] = createWorkWithImport.mock.calls[0];
		expect(options).toMatchObject({
			measurements: [],
			rowCount: 0,
		});
		expect(result).toMatchObject({
			importedCount: 0,
			rejectedCount: 1,
		});
		expect(result.errors).toEqual([
			expect.objectContaining({
				sheet: "Medicoes",
				row: 2,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "1.1",
			}),
		]);
	});

	it("keeps unappropriated actual costs without a budget index and rejects only indexed rows without a parent", async () => {
		const { createWorkWithImport } = mockOrchestratorRepository();

		const result = await importWorkbook(
			"owner-1",
			makePartialWorkbook({
				sheets: ["Obra", "Custos Realizados"],
				actualCostRows: [actualCostRow(2, null), actualCostRow(3, "9.9")],
			}),
			"cc-test",
		);

		const [, , , , options] = createWorkWithImport.mock.calls[0];
		expect(options).toMatchObject({
			actualCosts: [
				expect.objectContaining({
					rowNumber: 2,
					budgetIndex: null,
					appropriationStatus: "UNAPPROPRIATED",
				}),
			],
			rowCount: 1,
		});
		expect(result).toMatchObject({
			importedCount: 1,
			rejectedCount: 1,
		});
		expect(result.errors).toEqual([
			expect.objectContaining({
				sheet: "Custos Realizados",
				row: 3,
				field: "Indice",
				code: "MISSING_BUDGET_DEPENDENCY",
				dependency: "9.9",
			}),
		]);
	});
});

describe("construction service read DTOs", () => {
	it("passes active-import baseline, measurements and actual costs into work BI", async () => {
		spyOn(repository, "getWorkWithItems").mockResolvedValue(
			makeStoredUnifiedWork() as never,
		);

		const result = await getWorkBI("owner-1", "work-1");

		expect(repository.getWorkWithItems).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
		);
		expect(result.summary.activeBudget).toBe(550);
		expect(result.summary.earnedValue).toBe(275);
		expect(result.summary.actualCost).toBe(225);
		expect(result.indicators.actualCost.status).toBe("AVAILABLE");
		expect(result.calculationAudit).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "AC", result: 225 }),
			]),
		);
	});

	it("does not return BI for a work owned by another user", async () => {
		spyOn(repository, "getWorkWithItems").mockResolvedValue(null);

		await expect(
			getWorkBI("owner-1", "work-owned-by-owner-2"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});
		expect(repository.getWorkWithItems).toHaveBeenCalledWith(
			"owner-1",
			"work-owned-by-owner-2",
		);
	});

	it("passes active-import baseline and revisions into schedule gantt", async () => {
		spyOn(repository, "getWorkWithItems").mockResolvedValue(
			makeStoredUnifiedWork() as never,
		);

		const result = await getSchedule("owner-1", "work-1");

		expect(result.gantt[0]).toMatchObject({
			itemId: "item-1",
			baselineStart: "2026-01-01T00:00:00.000Z",
			replannedStart: "2026-01-05T00:00:00.000Z",
		});
	});

	it("includes accepted manual measurements in schedule gantt progress", async () => {
		spyOn(repository, "getWorkWithItems").mockResolvedValue({
			...makeStoredUnifiedWork(),
			measurements: [],
			manualMeasurements: [
				{
					date: new Date("2026-01-15T00:00:00.000Z"),
					items: [
						{
							budgetItemId: "item-1",
							measuredValue: 275,
							accumulatedValue: 275,
							accumulatedPercentage: 0.5,
							accumulatedQuantity: 5,
						},
					],
				},
			],
		} as never);

		const result = await getSchedule("owner-1", "work-1");

		expect(result.gantt[0]).toMatchObject({
			itemId: "item-1",
			measuredPercentage: 0.5,
		});
	});

	it("filters multiworks status using calculated measurement metrics", async () => {
		spyOn(repository, "getAllWorksWithItems").mockResolvedValue([
			makeStoredUnifiedWork(),
		] as never);

		const result = await getMultiworksBI("owner-1", { status: "IN_PROGRESS" });

		expect(result.cards.totalWorks).toBe(1);
		expect(result.works[0]).toMatchObject({
			workId: "work-1",
			measuredPercentage: 0.5,
		});
	});

	it("filters multiworks BI by selected work ids without pagination", async () => {
		spyOn(repository, "getAllWorksWithItems").mockResolvedValue([
			{ ...makeStoredUnifiedWork(), operationalStatus: "IN_PROGRESS" },
			{
				...makeStoredUnifiedWork(),
				id: "work-2",
				code: "OBRA-002",
				operationalStatus: "IN_PROGRESS",
			},
		] as never);

		const result = await getMultiworksBI("owner-1", { workIds: ["work-2"] });

		expect(result.cards.totalWorks).toBe(1);
		expect(result.works).toHaveLength(1);
		expect(result.works[0]).toMatchObject({ workId: "work-2" });
	});

	it("drops another owner's work, measurements and actual costs from multiworks BI", async () => {
		spyOn(repository, "getAllWorksWithItems").mockResolvedValue([
			{
				...makeStoredUnifiedWork(),
				id: "work-owned-by-owner-2",
				ownerId: "owner-2",
			},
		] as never);

		const result = await getMultiworksBI("owner-1");

		expect(repository.getAllWorksWithItems).toHaveBeenCalledWith("owner-1");
		expect(result.cards.totalWorks).toBe(0);
		expect(result.works).toEqual([]);
		expect(result.portfolioChart).toEqual([]);
	});
});

describe("construction works and manual entries services", () => {
	it("creates manual works through an owner-scoped works repository", async () => {
		const repository = {
			findWorkByOwnerAndCode: mock(async () => null),
			createWorkManual: mock(async () => ({
				id: "work-created",
				code: "OBRA-NEW",
			})),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		const result = await service.create("owner-1", {
			code: " OBRA-NEW ",
			name: " Obra Nova ",
			costCenterId: "cc-test",
			clientName: " Cliente ",
			baseDate: "2026-01-15",
			plannedStart: "2026-01-01",
			plannedEnd: "2026-12-31",
			areaM2: 120,
			responsibleName: " Engenheira ",
			operationalStatus: "IN_PROGRESS",
		});

		expect(result as unknown).toEqual({ id: "work-created", code: "OBRA-NEW" });
		expect(repository.findWorkByOwnerAndCode).toHaveBeenCalledWith(
			"owner-1",
			"OBRA-NEW",
		);
		expect(repository.createWorkManual).toHaveBeenCalledWith(
			"owner-1",
			expect.objectContaining({
				code: "OBRA-NEW",
				name: "Obra Nova",
				operationalStatus: "DRAFT",
				statusReason: null,
				clientName: "Cliente",
				baseDate: new Date("2026-01-15"),
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-12-31"),
				areaM2: 120,
				responsibleName: "Engenheira",
			}),
		);
	});

	it("replays an idempotent work creation without creating a second work", async () => {
		const repository = {
			findWorkByOwnerAndCode: mock(async () => null),
			findWorkByOwnerAndCreationIdempotencyKey: mock(async () => ({
				id: "work-existing",
			})),
			createWorkManual: mock(async () => ({ id: "work-created" })),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		const result = await service.create("owner-1", {
			code: "OBRA-RETRY",
			name: "Obra",
			costCenterId: "cc-test",
			creationIdempotencyKey: "create-key-1",
		});

		expect(result).toEqual({ id: "work-existing" });
		expect(repository.createWorkManual).not.toHaveBeenCalled();
	});

	it("keeps works mutations behind owner-scoped service errors", async () => {
		const repository = {
			findWorkByOwnerAndCode: mock(async () => ({ id: "existing-work" })),
			createWorkManual: mock(async () => ({ id: "work-created" })),
			updateWork: mock(async () => null),
			deleteWork: mock(async () => null),
			getWorkDependencyCounts: mock(async () => ({})),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await expect(
			service.create("owner-1", {
				code: "OBRA-001",
				name: "Obra",
				costCenterId: "cc-test",
			}),
		).rejects.toMatchObject({
			code: "WORK_EXISTS",
			status: 409,
		});
		await expect(
			service.update("owner-1", "missing-work", { name: "Nova" }),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});
		await expect(
			service.delete("owner-1", "missing-work"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});
	});

	it("allows a work status to change directly between operational states", async () => {
		const repository = {
			getWorkById: mock(async () => ({
				id: "work-1",
				operationalStatus: "DRAFT",
			})),
			updateWork: mock(async () => ({
				id: "work-1",
				operationalStatus: "DONE",
			})),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await expect(
			service.update(
				"owner-1",
				"work-1",
				{ operationalStatus: "DONE" },
				{ userId: "user-1", role: "GESTOR" },
			),
		).resolves.toMatchObject({ operationalStatus: "DONE" });
		expect(repository.updateWork).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				operationalStatus: "DONE",
				expectedOperationalStatus: "DRAFT",
			}),
		);
	});

	it("still requires a reason when suspending or archiving a work", async () => {
		const repository = {
			getWorkById: mock(async () => ({
				id: "work-1",
				operationalStatus: "DRAFT",
			})),
			updateWork: mock(async () => ({ id: "work-1" })),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await expect(
			service.update(
				"owner-1",
				"work-1",
				{ operationalStatus: "SUSPENDED" },
				{ userId: "user-1", role: "GESTOR" },
			),
		).rejects.toMatchObject({ code: "STATUS_REASON_REQUIRED" });
	});

	it("rejects an invalid operational status without applying the update", async () => {
		const repository = {
			getWorkById: mock(async () => ({
				id: "work-1",
				operationalStatus: "DRAFT",
			})),
			updateWork: mock(async () => ({ id: "work-1" })),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await expect(
			service.update(
				"owner-1",
				"work-1",
				{ operationalStatus: "UNKNOWN" },
				{ userId: "user-1", role: "GESTOR" },
			),
		).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
		expect(repository.updateWork).not.toHaveBeenCalled();
	});

	it("returns successful work deletes instead of treating them as not found", async () => {
		const repository = {
			getWorkDependencyCounts: mock(async () => ({ contracts: 0 })),
			deleteWork: mock(async () => ({ id: "work-1", ownerId: "owner-1" })),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await expect(
			service.delete("owner-1", "work-1") as Promise<unknown>,
		).resolves.toEqual({
			id: "work-1",
			ownerId: "owner-1",
		});
		expect(repository.deleteWork).toHaveBeenCalledWith("owner-1", "work-1");
	});

	it("allows work deletes even when dependency data exists", async () => {
		const repository = {
			getWorkDependencyCounts: mock(async () => ({
				contracts: 2,
				photoReports: 5,
			})),
			deleteWork: mock(async () => ({ id: "work-1" })),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await expect(
			service.delete("owner-1", "work-1") as Promise<unknown>,
		).resolves.toEqual({ id: "work-1" });
		expect(repository.getWorkDependencyCounts).not.toHaveBeenCalled();
		expect(repository.deleteWork).toHaveBeenCalledWith("owner-1", "work-1");
	});

	it("deletes through the owner-scoped repository without a dependency pre-check", async () => {
		const repository = {
			getWorkDependencyCounts: mock(async () => ({})),
			deleteWork: mock(async () => ({ id: "work-1" })),
		};
		const { ConstructionWorkService } = await import(
			"../../../../src/modules/construction-planning/works/work-service"
		);
		const service = new ConstructionWorkService(repository as never);

		await service.delete("owner-9", "work-1");

		expect(repository.getWorkDependencyCounts).not.toHaveBeenCalled();
		expect(repository.deleteWork).toHaveBeenCalledWith("owner-9", "work-1");
	});

	it("creates and deletes measurements through the measurement service boundary", async () => {
		const input = {
			index: "1.1",
			measurementDate: "2026-01-15",
			measuredPercentageAccumulated: 50,
		};
		const repository = {
			getWorkById: mock(async () => ({
				id: "work-1",
				ownerId: "owner-1",
				activeImportId: "import-1",
			})),
			createMeasurement: mock(async () => ({ id: "measurement-1" })),
			listMeasurements: mock(async () => [{ id: "measurement-1" }]),
			deleteMeasurement: mock(async () => ({ id: "measurement-1" })),
		};
		const { ConstructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const service = new ConstructionManualEntryService(repository as never, {
			assertWritable: mock(async () => undefined),
			isWritableBlocked: mock(async () => false),
		});

		await expect(
			service.createMeasurement("owner-1", "work-1", input) as Promise<unknown>,
		).resolves.toEqual({
			id: "measurement-1",
		});
		await expect(
			service.listMeasurements("owner-1", "work-1") as Promise<unknown>,
		).resolves.toEqual([{ id: "measurement-1" }]);
		await expect(
			service.deleteMeasurement(
				"owner-1",
				"work-1",
				"measurement-1",
			) as Promise<unknown>,
		).resolves.toEqual({ id: "measurement-1" });

		expect(repository.getWorkById).toHaveBeenCalledWith("owner-1", "work-1");
		expect(repository.createMeasurement).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			null,
			input,
		);
		expect(repository.listMeasurements).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
		);
		expect(repository.deleteMeasurement).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"measurement-1",
		);
	});

	it("creates and deletes actual costs through the actual cost service boundary", async () => {
		const input = {
			costDate: "2026-01-20",
			description: "Compra de materiais",
			category: "MATERIAL",
			amount: 123,
			costType: "CURRENT" as const,
			supplierId: "supplier-1",
			paymentStatus: "OPEN" as const,
			allocations: [{ budgetItemId: "item-1", percentage: 100 }],
		};
		const repository = {
			getWorkById: mock(async () => ({
				id: "work-1",
				ownerId: "owner-1",
				activeImportId: "import-1",
			})),
			createActualCost: mock(async () => ({ id: "cost-1" })),
			getActualCostById: mock(async () => ({
				id: "cost-1",
				workId: "work-1",
				amount: 100,
				allocations: [],
			})),
			listActualCosts: mock(async () => [{ id: "cost-1" }]),
			deleteActualCost: mock(async () => ({ id: "cost-1" })),
		};
		const { ConstructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const assertLinkedToWork = mock(
			async () => ({ id: "work-supplier-1" }) as never,
		);
		const service = new ConstructionManualEntryService(
			repository as never,
			{
				assertWritable: mock(async () => undefined),
				isWritableBlocked: mock(async () => false),
			},
			{
				apply: mock(
					async (): Promise<BudgetMutationResult> => ({
						status: "APPROVED",
						requiresApproval: false,
						availableBalance: 0,
						projectedBalance: 0,
						allocations: [],
					}),
				),
				reverse: mock(
					async (): Promise<BudgetMutationResult> => ({
						status: "APPROVED",
						requiresApproval: false,
						availableBalance: 0,
						projectedBalance: 0,
						allocations: [],
					}),
				),
				reject: mock(async () => undefined),
			},
			{ assertLinkedToWork },
		);

		await expect(
			service.createActualCost("owner-1", "work-1", input) as Promise<unknown>,
		).resolves.toEqual({
			id: "cost-1",
		});
		await expect(
			service.listActualCosts("owner-1", "work-1") as Promise<unknown>,
		).resolves.toEqual([{ id: "cost-1" }]);
		await expect(
			service.deleteActualCost(
				"owner-1",
				"work-1",
				"cost-1",
			) as Promise<unknown>,
		).resolves.toEqual({ id: "cost-1" });

		expect(repository.getWorkById).toHaveBeenCalledWith("owner-1", "work-1");
		expect(assertLinkedToWork).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"supplier-1",
		);
		expect(repository.createActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			null,
			input,
			expect.anything(),
			expect.arrayContaining([
				expect.objectContaining({
					budgetItemId: "item-1",
					basis: "PERCENTAGE",
					percentage: 100,
				}),
			]),
		);
		expect(repository.listActualCosts).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			{},
		);
		expect(repository.deleteActualCost).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"cost-1",
			expect.anything(),
		);
	});

	it("normalizes the rateio on update and passes closed values to the repository", async () => {
		const repository = {
			getActualCostById: mock(async () => ({
				id: "cost-1",
				ownerId: "owner-1",
				workId: "work-1",
				amount: 100,
				allocations: [
					{
						id: "alloc-1",
						budgetItemId: "item-1",
						percentage: 100,
						value: 100,
					},
				],
			})),
			updateActualCost: mock(async () => ({ id: "cost-1" })),
		};
		const { ConstructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const service = new ConstructionManualEntryService(
			repository as never,
			{
				assertWritable: mock(async () => undefined),
				isWritableBlocked: mock(async () => false),
			},
			{
				apply: mock(
					async (): Promise<BudgetMutationResult> => ({
						status: "APPROVED",
						requiresApproval: false,
						availableBalance: 0,
						projectedBalance: 0,
						allocations: [],
					}),
				),
				reverse: mock(
					async (): Promise<BudgetMutationResult> => ({
						status: "APPROVED",
						requiresApproval: false,
						availableBalance: 0,
						projectedBalance: 0,
						allocations: [],
					}),
				),
				reject: mock(async () => undefined),
			},
			{ assertLinkedToWork: mock(async () => ({ id: "ws-1" }) as never) },
		);

		await service.updateActualCost("owner-1", "work-1", "cost-1", {
			amount: 200,
			allocations: [
				{ budgetItemId: "item-1", percentage: 50 },
				{ budgetItemId: "item-2", percentage: 50 },
			],
		});

		const calls = repository.updateActualCost.mock.calls as unknown[][];
		const normalizedCall = calls[calls.length - 1];
		const normalized = normalizedCall?.[5] as Array<{
			budgetItemId: string;
			basis: string;
			percentage: number;
			value: unknown;
		}>;
		expect(normalized).toHaveLength(2);
		expect(Number(normalized[0].value)).toBe(100);
		expect(Number(normalized[1].value)).toBe(100);
	});

	it("rejects update when value rateio does not close the cost total", async () => {
		const repository = {
			getActualCostById: mock(async () => ({
				id: "cost-1",
				ownerId: "owner-1",
				workId: "work-1",
				amount: 100,
				allocations: [],
			})),
			updateActualCost: mock(async () => ({ id: "cost-1" })),
		};
		const { ConstructionManualEntryService } = await import(
			"../../../../src/modules/construction-planning/entries/manual-entry-service"
		);
		const service = new ConstructionManualEntryService(
			repository as never,
			{
				assertWritable: mock(async () => undefined),
				isWritableBlocked: mock(async () => false),
			},
			{
				apply: mock(
					async (): Promise<BudgetMutationResult> => ({
						status: "APPROVED",
						requiresApproval: false,
						availableBalance: 0,
						projectedBalance: 0,
						allocations: [],
					}),
				),
				reverse: mock(
					async (): Promise<BudgetMutationResult> => ({
						status: "APPROVED",
						requiresApproval: false,
						availableBalance: 0,
						projectedBalance: 0,
						allocations: [],
					}),
				),
				reject: mock(async () => undefined),
			},
			{ assertLinkedToWork: mock(async () => ({ id: "ws-1" }) as never) },
		);

		await expect(
			service.updateActualCost("owner-1", "work-1", "cost-1", {
				amount: 1000,
				allocations: [
					{ budgetItemId: "item-1", value: 600 },
					{ budgetItemId: "item-2", value: 300 },
				],
			}) as Promise<unknown>,
		).rejects.toThrow(/soma das aloca/);
		expect(repository.updateActualCost).not.toHaveBeenCalled();
	});
});
