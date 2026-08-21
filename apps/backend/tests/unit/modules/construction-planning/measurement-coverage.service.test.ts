import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const workItem = {
	id: "work-item-1",
	budgetItemId: "budget-1",
	measuredQuantity: 10,
	measurementId: "wm-1",
	measurement: { id: "wm-1", workId: "work-1" },
};
const contractItem = {
	id: "contract-item-1",
	serviceId: "service-1",
	measuredQuantity: 8,
	measurementId: "cm-1",
	measurement: {
		id: "cm-1",
		contractId: "contract-1",
		contract: { workId: "work-1" },
	},
};

const getWorkMeasurementItem = mock(
	async (): Promise<unknown | null> => workItem,
);
const getContractMeasurementItem = mock(
	async (): Promise<unknown | null> => contractItem,
);
const getContractServiceBudgetItem = mock(
	async (): Promise<unknown | null> => "budget-1",
);
const sumCoveragesByWorkItem = mock(
	async (): Promise<Decimal> => new Decimal(0),
);
const sumCoveragesByContractItem = mock(
	async (): Promise<Decimal> => new Decimal(0),
);
const findCoverageByPair = mock(async (): Promise<unknown | null> => null);
const createCoverage = mock(
	async (): Promise<unknown> => ({ id: "coverage-1" }),
);
const getCoverage = mock(async (): Promise<unknown | null> => null);
const deleteCoverage = mock(async (): Promise<unknown | null> => null);
const getWorkMeasurementItems = mock(
	async (): Promise<unknown[]> => [
		{ id: "work-item-1", budgetItemId: "budget-1", measuredQuantity: 10 },
	],
);
const countCoveragesByWorkMeasurement = mock(async (): Promise<number> => 0);
const findActiveImpactsBySource = mock(async (): Promise<unknown[]> => []);

mock.module(
	"../../../../src/modules/construction-planning/measurement-coverage.repository",
	() => ({
		getWorkMeasurementItem,
		getContractMeasurementItem,
		getContractServiceBudgetItem,
		sumCoveragesByWorkItem,
		sumCoveragesByContractItem,
		findCoverageByPair,
		createCoverage,
		getCoverage,
		deleteCoverage,
		getWorkMeasurementItems,
		countCoveragesByWorkMeasurement,
	}),
);

const replaceSourceImpact = mock(async () => ({
	status: "APPROVED",
	requiresApproval: false,
	availableBalance: 0,
	projectedBalance: 0,
	allocations: [],
}));
const reverse = mock(async () => ({
	status: "APPROVED",
	requiresApproval: false,
	availableBalance: 0,
	projectedBalance: 0,
	allocations: [],
}));

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: { replaceSourceImpact, reverse },
	}),
);

mock.module("../../../../src/lib/transaction-retry", () => ({
	withSerializableRetry: async (operation: (tx: unknown) => Promise<unknown>) =>
		operation({}),
}));

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		getBudgetItemReferences: mock(async () => ({
			found: [
				{
					budgetItemId: "budget-1",
					identityId: "identity-1",
					versionItemId: "version-1",
					quantity: new Decimal(100),
					unitCost: new Decimal(50),
				},
			],
			missing: [],
		})),
		findActiveImpactsBySource,
	}),
);

const { MeasurementCoverageService } = await import(
	"../../../../src/modules/construction-planning/measurement-coverage.service"
);

const service = new MeasurementCoverageService();

beforeEach(() => {
	[
		getWorkMeasurementItem,
		getContractMeasurementItem,
		getContractServiceBudgetItem,
		sumCoveragesByWorkItem,
		sumCoveragesByContractItem,
		findCoverageByPair,
		createCoverage,
		getCoverage,
		deleteCoverage,
		getWorkMeasurementItems,
		countCoveragesByWorkMeasurement,
		replaceSourceImpact,
		reverse,
	].forEach((m) => {
		m.mockClear();
	});
	getWorkMeasurementItem.mockImplementation(async () => workItem);
	getContractMeasurementItem.mockImplementation(async () => contractItem);
	getContractServiceBudgetItem.mockImplementation(async () => "budget-1");
	sumCoveragesByWorkItem.mockImplementation(async () => new Decimal(0));
	sumCoveragesByContractItem.mockImplementation(async () => new Decimal(0));
	findCoverageByPair.mockImplementation(async () => null);
	getWorkMeasurementItems.mockImplementation(async () => [
		{ id: "work-item-1", budgetItemId: "budget-1", measuredQuantity: 10 },
	]);
	countCoveragesByWorkMeasurement.mockImplementation(async () => 0);
	findActiveImpactsBySource.mockImplementation(async () => []);
});

const ctx = { userId: "user-1" };

describe("MeasurementCoverageService.link", () => {
	it("cria cobertura e reduz o consumo da medicao de obra coberta", async () => {
		getCoverage.mockImplementation(async () => ({ id: "coverage-1" }));

		const result = await service.link(
			"owner-1",
			"work-1",
			{
				workMeasurementItemId: "work-item-1",
				contractMeasurementItemId: "contract-item-1",
				quantity: 3,
			},
			ctx,
		);

		expect(createCoverage).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				ownerId: "owner-1",
				workMeasurementItemId: "work-item-1",
				contractMeasurementItemId: "contract-item-1",
				quantity: new Decimal(3),
				amount: new Decimal(150),
			}),
		);
		expect(replaceSourceImpact).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				sourceType: "WORK_MEASUREMENT",
				sourceId: "wm-1",
				allocations: [{ budgetItemId: "budget-1", quantity: 7 }],
			}),
			ctx,
			expect.anything(),
		);
		expect(result).toMatchObject({ id: "coverage-1" });
	});

	it("rejeita quantidade zero ou negativa", async () => {
		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 0,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "INVALID_COVERAGE_QUANTITY",
				status: 400,
			}),
		);
		expect(createCoverage).not.toHaveBeenCalled();
	});

	it("rejeita quantidade acima da medicao de obra", async () => {
		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 11,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "COVERAGE_EXCEEDS_MEASURED_QUANTITY",
				status: 422,
			}),
		);
	});

	it("rejeita quantidade acima da medicao contratual", async () => {
		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 9,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "COVERAGE_EXCEEDS_MEASURED_QUANTITY",
				status: 422,
			}),
		);
	});

	it("rejeita itens de obras diferentes", async () => {
		getContractMeasurementItem.mockImplementation(async () => ({
			...contractItem,
			measurement: {
				id: "cm-2",
				contractId: "contract-2",
				contract: { workId: "work-2" },
			},
		}));

		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 3,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({ code: "COVERAGE_WRONG_WORK", status: 422 }),
		);
	});

	it("rejeita item de outro owner/obra inexistente", async () => {
		getWorkMeasurementItem.mockImplementation(async () => null);

		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "missing",
					contractMeasurementItemId: "contract-item-1",
					quantity: 3,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({ code: "NOT_FOUND", status: 404 }),
		);
	});

	it("rejeita quando o servico do contrato nao tem item de orcamento", async () => {
		getContractServiceBudgetItem.mockImplementation(async () => null);

		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 3,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({ code: "BUDGET_ITEM_REQUIRED", status: 422 }),
		);
	});

	it("rejeita itens de itens de orcamento diferentes", async () => {
		getContractServiceBudgetItem.mockImplementation(async () => "budget-2");

		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 3,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "COVERAGE_BUDGET_MISMATCH",
				status: 422,
			}),
		);
	});

	it("rejeita par duplicado ja coberto", async () => {
		findCoverageByPair.mockImplementation(async () => ({ id: "coverage-1" }));

		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 3,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "COVERAGE_ALREADY_EXISTS",
				status: 409,
			}),
		);
	});

	it("rejeita soma de coberturas acima da medicao de obra", async () => {
		sumCoveragesByWorkItem.mockImplementation(async () => new Decimal(8));

		await expect(
			service.link(
				"owner-1",
				"work-1",
				{
					workMeasurementItemId: "work-item-1",
					contractMeasurementItemId: "contract-item-1",
					quantity: 3,
				},
				ctx,
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "COVERAGE_EXCEEDS_MEASURED_QUANTITY",
				status: 422,
			}),
		);
	});

	it("reverte apenas os impactos quando toda a medicao de obra fica coberta", async () => {
		getWorkMeasurementItems.mockImplementation(async () => [
			{ id: "work-item-1", budgetItemId: "budget-1", measuredQuantity: 3 },
		]);
		getCoverage.mockImplementation(async () => ({ id: "coverage-1" }));
		findActiveImpactsBySource.mockImplementation(async () => [
			{ id: "impact-1", impactType: "CONSUMPTION", status: "APPROVED" },
		]);

		await service.link(
			"owner-1",
			"work-1",
			{
				workMeasurementItemId: "work-item-1",
				contractMeasurementItemId: "contract-item-1",
				quantity: 3,
			},
			ctx,
		);

		expect(replaceSourceImpact).not.toHaveBeenCalled();
		expect(reverse).toHaveBeenCalled();
	});
});

describe("MeasurementCoverageService.unlink", () => {
	it("remove cobertura e restaura o consumo da medicao de obra", async () => {
		getCoverage.mockImplementation(async () => ({
			id: "coverage-1",
			workMeasurementItemId: "work-item-1",
			contractMeasurementItemId: "contract-item-1",
			quantity: new Decimal(3),
		}));
		getWorkMeasurementItems.mockImplementation(async () => [
			{ id: "work-item-1", budgetItemId: "budget-1", measuredQuantity: 10 },
		]);

		await service.unlink("owner-1", "work-1", "coverage-1", ctx);

		expect(deleteCoverage).toHaveBeenCalledWith(
			expect.anything(),
			"coverage-1",
		);
		expect(replaceSourceImpact).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				sourceType: "WORK_MEASUREMENT",
				sourceId: "wm-1",
				allocations: [{ budgetItemId: "budget-1", quantity: 10 }],
			}),
			ctx,
			expect.anything(),
		);
	});

	it("lanca 404 quando cobertura nao existe", async () => {
		getCoverage.mockImplementation(async () => null);

		await expect(
			service.unlink("owner-1", "work-1", "missing", ctx),
		).rejects.toThrow(
			expect.objectContaining({ code: "NOT_FOUND", status: 404 }),
		);
		expect(deleteCoverage).not.toHaveBeenCalled();
	});
});

describe("MeasurementCoverageService.hasCoveragesForWorkMeasurement", () => {
	it("indica se a medicao de obra possui coberturas", async () => {
		countCoveragesByWorkMeasurement.mockImplementation(async () => 2);

		const result = await service.hasCoveragesForWorkMeasurement(
			"owner-1",
			"wm-1",
		);

		expect(countCoveragesByWorkMeasurement).toHaveBeenCalledWith(
			"owner-1",
			"wm-1",
		);
		expect(result).toBe(true);
	});
});
