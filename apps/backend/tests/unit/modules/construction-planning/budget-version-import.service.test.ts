import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";
import type { BudgetVersionComparison } from "../../../../src/modules/construction-planning/budget-version-comparison";
import { assertBudgetVersionChanges } from "../../../../src/modules/construction-planning/budget-version-import.service";

function comparison(
	classification: BudgetVersionComparison["rows"][number]["classification"],
): BudgetVersionComparison {
	return {
		sourceTotal: 500,
		candidateTotal: 500,
		grossIncrease: 0,
		suppression: 0,
		netImpact: 0,
		impactPercent: 0,
		countsByClassification: {
			UNCHANGED: classification.includes("UNCHANGED") ? 1 : 0,
			INCREASED: classification.includes("INCREASED") ? 1 : 0,
			DECREASED: classification.includes("DECREASED") ? 1 : 0,
			ADDED: classification.includes("ADDED") ? 1 : 0,
			REMOVED: classification.includes("REMOVED") ? 1 : 0,
			STRUCTURE_CHANGED: classification.includes("STRUCTURE_CHANGED") ? 1 : 0,
			SCHEDULE_CHANGED: classification.includes("SCHEDULE_CHANGED") ? 1 : 0,
		},
		blockingIssues: [],
		rows: [
			{
				itemIndex: "1.1",
				parentIndex: "1",
				level: "ITEM",
				description: "Servico",
				classification,
				previous: null,
				candidate: null,
				delta: {
					quantity: 0,
					unitCost: 0,
					totalCost: 0,
					plannedStartDays: 0,
					plannedEndDays: 0,
					plannedDurationDays: 0,
				},
				validation: { valid: true, violations: [] },
			},
		],
	};
}

const importBatchFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const importBatchUpdate = mock(async () => ({}));
const budgetVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const createBatchMock = mock(async () => ({
	batchId: "batch-1",
	status: "READY",
}));
const loadExposureMock = mock(async () => new Map());
const createDraftMock = mock(async () => ({
	id: "version-2",
	index: "2",
	label: "Aditivo importado",
	version: 2,
	status: "DRAFT",
	sourceVersionId: "version-1",
	kind: null,
	acrescimoBruto: null,
	supressao: null,
	impactoLiquido: null,
	percentualImpacto: null,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		importBatch: {
			findFirst: importBatchFindFirst,
			update: importBatchUpdate,
		},
		budgetVersion: { findFirst: budgetVersionFindFirst },
	},
}));

mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mock(async () => ({ canWrite: true })),
}));

mock.module(
	"../../../../src/modules/construction-planning/imports/import-batch.service",
	() => ({
		constructionImportBatchService: { createBatch: createBatchMock },
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/budget-version-exposure.service",
	() => ({
		loadBudgetExposure: loadExposureMock,
	}),
);

mock.module("../../../../src/lib/budget-version-adapter", () => ({
	createDraftBudgetVersionFromSnapshot: createDraftMock,
}));

const workbookWith = (budgetRows: Array<Record<string, unknown>>) => ({
	budgetRows: [
		{
			index: "1",
			description: "Etapa 1",
			unit: null,
			quantity: 0,
			unitCost: 0,
			totalCost: 0,
		},
		...budgetRows,
	],
	baselineRows: [],
});

const validWorkbook = () =>
	workbookWith([
		{
			index: "1.1",
			description: "Servico",
			unit: "un",
			quantity: 12,
			unitCost: 50,
			totalCost: 600,
		},
	]);

const activeVersion = (items: Array<Record<string, unknown>>) => ({
	id: "version-1",
	ownerId: "user-1",
	workId: "work-1",
	isActive: true,
	items: [
		{
			id: "vitem-1",
			parentVersionId: null,
			index: "1",
			type: "STAGE",
			description: "Etapa 1",
			unit: null,
			quantity: null,
			unitCost: null,
			totalCost: new Decimal(0),
			plannedStart: null,
			plannedEnd: null,
		},
		...items,
	],
});

const sourceItem = (description: string) => ({
	id: "vitem-1.1",
	parentVersionId: null,
	index: "1.1",
	type: "ITEM",
	description,
	unit: "un",
	quantity: new Decimal(10),
	unitCost: new Decimal(50),
	totalCost: new Decimal(500),
	plannedStart: null,
	plannedEnd: null,
});

describe("budget version import guards", () => {
	it("rejects a comparison with no changes at all", () => {
		expect(() => assertBudgetVersionChanges(comparison(["UNCHANGED"]))).toThrow(
			"Nao e possivel criar aditivo",
		);
	});

	it("allows a financial, structural or schedule-only change", () => {
		expect(() =>
			assertBudgetVersionChanges(comparison(["SCHEDULE_CHANGED"])),
		).not.toThrow();
		expect(() =>
			assertBudgetVersionChanges(comparison(["INCREASED"])),
		).not.toThrow();
		expect(() =>
			assertBudgetVersionChanges(comparison(["STRUCTURE_CHANGED"])),
		).not.toThrow();
	});
});

describe("budget version import service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		importBatchFindFirst.mockResolvedValue(null);
		budgetVersionFindFirst.mockResolvedValue(null);
		createBatchMock.mockResolvedValue({
			batchId: "batch-1",
			status: "READY",
		});
		loadExposureMock.mockResolvedValue(new Map());
	});

	it("stores the immutable preview at staging", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			parsedWorkbook: validWorkbook(),
		});
		budgetVersionFindFirst.mockResolvedValue(
			activeVersion([sourceItem("Servico")]),
		);

		const { createBudgetVersionImport } = await import(
			"../../../../src/modules/construction-planning/budget-version-import.service"
		);
		await createBudgetVersionImport("user-1", "work-1", {
			title: "Aditivo 1",
			file: new File(["fake"], "orcamento.xlsx"),
			idempotencyKey: "key-1",
		});

		const updateCall = (importBatchUpdate as ReturnType<typeof mock>).mock
			.calls[0]?.[0] as { data: { preview: Record<string, unknown> } };
		expect(updateCall?.data.preview).toMatchObject({
			role: "ADITIVO",
			sourceVersionId: "version-1",
		});
		expect(updateCall?.data.preview.comparison).toMatchObject({
			grossIncrease: 100,
			netImpact: 100,
		});
	});

	it("normalizes padded hierarchy indexes before comparing an amendment", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			parsedWorkbook: workbookWith([
				{
					index: "001.01",
					type: "Etapa",
					description: "Etapa 1.1",
					unit: null,
					quantity: 0,
					unitCost: 0,
					totalCost: 0,
				},
				{
					index: "001.01.01",
					type: "Item",
					description: "Servico",
					unit: "un",
					quantity: 10,
					unitCost: 50,
					totalCost: 500,
				},
			]),
		});
		budgetVersionFindFirst.mockResolvedValue(
			activeVersion([
				{
					id: "vstage-1.1",
					parentVersionId: "vitem-1",
					index: "1.1",
					type: "STAGE",
					description: "Etapa 1.1",
					unit: null,
					quantity: null,
					unitCost: null,
					totalCost: new Decimal(0),
					plannedStart: null,
					plannedEnd: null,
				},
				{
					...sourceItem("Servico"),
					id: "vitem-1.1.1",
					index: "1.1.1",
					parentVersionId: "vstage-1.1",
				},
			]),
		);

		const { createBudgetVersionImport } = await import(
			"../../../../src/modules/construction-planning/budget-version-import.service"
		);

		await expect(
			createBudgetVersionImport("user-1", "work-1", {
				title: "Aditivo sem alteração de índice",
				file: new File(["fake"], "orcamento.xlsx"),
			}),
		).rejects.toMatchObject({ code: "BUDGET_VERSION_NO_CHANGES" });
	});

	it("allows a new budget item without a filled schedule", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			parsedWorkbook: workbookWith([
				{
					index: "1.1",
					description: "Servico",
					unit: "un",
					quantity: 10,
					unitCost: 50,
					totalCost: 500,
				},
				{
					index: "1.2",
					description: "Novo servico",
					unit: "un",
					quantity: 2,
					unitCost: 25,
					totalCost: 50,
				},
			]),
		});
		budgetVersionFindFirst.mockResolvedValue(
			activeVersion([sourceItem("Servico")]),
		);

		const { createBudgetVersionImport } = await import(
			"../../../../src/modules/construction-planning/budget-version-import.service"
		);

		await expect(
			createBudgetVersionImport("user-1", "work-1", {
				title: "Aditivo sem cronograma",
				file: new File(["fake"], "orcamento.xlsx"),
			}),
		).resolves.toMatchObject({ role: "ADITIVO" });
	});

	it("confirms idempotently, returning the same draft", async () => {
		importBatchFindFirst.mockResolvedValueOnce({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			title: "Aditivo 1",
			status: "READY",
			parsedWorkbook: validWorkbook(),
		});
		importBatchFindFirst.mockResolvedValueOnce({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			title: "Aditivo 1",
			status: "CONFIRMED",
			confirmedImportId: "version-2",
			parsedWorkbook: workbookWith([]),
		});
		budgetVersionFindFirst
			.mockResolvedValueOnce(activeVersion([sourceItem("Servico")]))
			.mockResolvedValueOnce({
				id: "version-2",
				versionNumber: 2,
				label: "Aditivo 1",
				status: "RASCUNHO",
				isActive: false,
				sourceVersionId: "version-1",
				kind: null,
				acrescimoBruto: null,
				supressao: null,
				impactoLiquido: null,
				percentualImpacto: null,
			});

		const { confirmBudgetVersionImport } = await import(
			"../../../../src/modules/construction-planning/budget-version-import.service"
		);
		await confirmBudgetVersionImport("user-1", "work-1", "batch-1", {
			expectedSourceVersionId: "version-1",
		});
		const replay = await confirmBudgetVersionImport(
			"user-1",
			"work-1",
			"batch-1",
			{
				expectedSourceVersionId: "version-1",
			},
		);

		expect(replay.id).toBe("version-2");
		expect(createDraftMock).toHaveBeenCalledTimes(1);
	});

	it("links the import to the created draft version", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			title: "Aditivo 1",
			status: "READY",
			parsedWorkbook: validWorkbook(),
		});
		budgetVersionFindFirst.mockResolvedValue(
			activeVersion([sourceItem("Servico")]),
		);

		const { confirmBudgetVersionImport } = await import(
			"../../../../src/modules/construction-planning/budget-version-import.service"
		);
		await confirmBudgetVersionImport("user-1", "work-1", "batch-1", {
			expectedSourceVersionId: "version-1",
		});

		expect(createDraftMock).toHaveBeenCalledWith(
			"user-1",
			"work-1",
			expect.objectContaining({ budgetImportId: "batch-1" }),
		);
	});

	it("blocks confirmation when the comparison has blocking issues", async () => {
		importBatchFindFirst.mockResolvedValue({
			id: "batch-1",
			ownerId: "user-1",
			workId: "work-1",
			title: "Aditivo 1",
			status: "READY",
			parsedWorkbook: workbookWith([
				{
					index: "1.1",
					description: "Pintura",
					unit: "un",
					quantity: 10,
					unitCost: 50,
					totalCost: 500,
				},
			]),
		});
		budgetVersionFindFirst.mockResolvedValue(
			activeVersion([sourceItem("Servico")]),
		);

		const { confirmBudgetVersionImport } = await import(
			"../../../../src/modules/construction-planning/budget-version-import.service"
		);
		await expect(
			confirmBudgetVersionImport("user-1", "work-1", "batch-1", {
				expectedSourceVersionId: "version-1",
			}),
		).rejects.toMatchObject({ code: "BUDGET_IMPORT_BLOCKED" });
		expect(createDraftMock).not.toHaveBeenCalled();
	});
});
