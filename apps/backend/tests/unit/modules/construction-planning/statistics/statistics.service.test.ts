import { describe, expect, it, mock } from "bun:test";

const workFindFirst = mock(async () => ({
	id: "work-1",
	activeImportId: "import-1",
}));
const importFindFirst = mock(async () => null);
const costsFindMany = mock(async () => [
	{
		amount: 1000,
		costDate: new Date("2026-06-15T00:00:00.000Z"),
		supplierName: "Fornecedor A",
	},
]);
const importedMeasurementsFindMany = mock(async () => [
	{
		budgetItemId: "item-1",
		measurementDate: new Date("2026-06-30T00:00:00.000Z"),
		measuredValue: 600,
		measuredPercentageAccumulated: 0.6,
		measuredQuantityAccumulated: null,
	},
]);
const manualMeasurementsFindMany = mock(async () => []);
const contractsFindMany = mock(async () => [
	{
		createdAt: new Date("2026-06-10T00:00:00.000Z"),
		contractValue: 2000,
		supplierName: "Fornecedor A",
	},
]);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findFirst: workFindFirst },
		constructionImport: { findFirst: importFindFirst },
		constructionActualCost: { findMany: costsFindMany },
		constructionMeasurement: { findMany: importedMeasurementsFindMany },
		workMeasurement: { findMany: manualMeasurementsFindMany },
		contract: { findMany: contractsFindMany },
	},
}));

const { getWorkStatistics } = await import(
	"../../../../../src/modules/construction-planning/statistics/statistics.service"
);

describe("getWorkStatistics", () => {
	it("returns June costs, confirmed measurements and contracts in one period", async () => {
		const result = await getWorkStatistics(
			"owner-1",
			"work-1",
			"monthly",
			new Date("2026-06-30T23:59:59.999Z"),
		);

		expect(result.series).toEqual([
			{
				date: "2026-06",
				costs: 1000,
				measurements: 600,
				contracts: 2000,
			},
		]);
		expect(result.suppliers).toEqual([
			{
				name: "Fornecedor A",
				costs: 1000,
				contracts: 2000,
			},
		]);
	});
});
