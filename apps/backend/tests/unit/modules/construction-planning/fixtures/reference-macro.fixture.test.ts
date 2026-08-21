import { describe, expect, it } from "bun:test";
import {
	referenceMacroCases,
	referenceValidationSummary,
	referenceWorkbookMetadata,
} from "./reference-macro.fixture";

function sumBy<T extends Record<string, unknown>>(
	rows: readonly T[],
	key: keyof T,
	value: keyof T,
): number {
	return rows
		.filter((row) => row[key] !== undefined && row[key] !== null)
		.reduce((sum, row) => sum + Number(row[value] ?? 0), 0);
}

describe("QA-001 fixture de paridade com a referência macro", () => {
	it("mantém as fontes, linhas e a ata vazia identificáveis", () => {
		expect(referenceWorkbookMetadata.baseSheet).toBe("BASE_UNICA_BD");
		expect(referenceWorkbookMetadata.validationSheet).toBe("RESUMO_VALIDACAO");
		expect(referenceWorkbookMetadata.dictionarySheet).toBe("DICIONARIO");
		expect(referenceWorkbookMetadata.meetingNotesStatus).toBe("EMPTY");
		expect(referenceMacroCases).toHaveLength(5);
	});

	it("reproduz a amostra de valores da linha válida e a agregação por estado", () => {
		const validRows = referenceMacroCases.filter(
			(row) => row.source.kind === "BASE_UNICA_BD" && row.state === "PARAÍBA",
		);

		expect(sumBy(validRows, "produced", "produced")).toBeCloseTo(1799266.49, 2);
		expect(sumBy(validRows, "billed", "billed")).toBeCloseTo(1659811.49, 2);
		expect(
			referenceMacroCases.find((row) => row.id === "base-jan-pb-seect-item-1"),
		).toEqual(
			expect.objectContaining({
				totvsKey: "202010101003",
				produced: 1756570.34,
				billed: 1659811.49,
				referenceProducedNotBilled: 96758.85,
			}),
		);
	});

	it("preserva zero, ausência e sinal negativo como estados diferentes", () => {
		const zeroMeta = referenceMacroCases.find(
			(row) => row.id === "base-jan-pb-seect-item-3-meta-zero",
		);
		const negativeExpenses = referenceMacroCases.find(
			(row) => row.id === "base-fev-mg-negative-expenses",
		);
		const missingProject = referenceMacroCases.find(
			(row) => row.id === "base-jan-pb-project-without-totvs",
		);

		expect(zeroMeta?.metaMonthly).toBe(0);
		expect(zeroMeta?.expected.metaAttainment.status).toBe("UNAVAILABLE");
		expect(negativeExpenses?.expenses).toBe(-15);
		expect(negativeExpenses?.expected.resultCalculated.status).toBe(
			"PENDING_DEFINITION",
		);
		expect(missingProject?.totvsKey).toBeNull();
		expect(missingProject?.expected.resultCalculated.status).toBe(
			"UNAVAILABLE",
		);
	});

	it("não transforma #N/A ou ausência de medição em zero", () => {
		const sourceError = referenceMacroCases.find(
			(row) => row.id === "audit-source-na",
		);
		const validRow = referenceMacroCases.find(
			(row) => row.id === "base-jan-pb-seect-item-1",
		);

		expect(sourceError?.source.literal).toBe("#N/A");
		expect(sourceError?.expected.producedNotBilled).toEqual(
			expect.objectContaining({ status: "UNAVAILABLE", value: null }),
		);
		expect(validRow?.measurementAvailable).toBe(false);
		expect(validRow?.expected.measurement).toEqual(
			expect.objectContaining({ status: "UNAVAILABLE", value: null }),
		);
	});

	it("mantém os totais mensais da aba RESUMO_VALIDACAO como referência de reconciliação", () => {
		expect(referenceValidationSummary).toEqual([
			expect.objectContaining({
				month: "2026-01",
				projectCount: 60,
				produced: 13043012.15,
				billed: 16581860.18,
			}),
			expect.objectContaining({
				month: "2026-02",
				projectCount: 59,
				expenses: -9732171.34,
			}),
		]);
	});
});
