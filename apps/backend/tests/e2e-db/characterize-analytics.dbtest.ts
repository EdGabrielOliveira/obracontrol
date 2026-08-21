import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	api,
	assertStatus,
	ensureBudgetVersion,
	jsonBody,
	OWNER_A,
	resetAndSeedDatabase,
} from "./setup.dbtest";

// Plano 6 (BI-001): fixture canonica MET-MVP-001 montada via API e os
// valores canonicos assertados no envelope do BI da obra (overview).
// O ledger do Plano 4 deve alimentar committed/amendmentNet/dueOpen/paid.

let fixtureCounter = 0;

async function createMetFixture() {
	fixtureCounter += 1;
	const suffix = `bi${fixtureCounter}`;
	const work = await prisma.constructionWork.create({
		data: {
			id: `e2e-work-${suffix}`,
			ownerId: OWNER_A,
			code: `E2E-BI-${fixtureCounter}`,
			name: `Obra BI ${fixtureCounter}`,
			costCenterId: "e2e-cc-a",
			baseDate: new Date("2026-01-01"),
			plannedStart: new Date("2026-01-01"),
			plannedEnd: new Date("2026-12-31"),
			areaM2: 100,
		},
	});
	const importRow = await prisma.constructionImport.create({
		data: {
			id: `e2e-import-${suffix}`,
			ownerId: OWNER_A,
			workId: work.id,
			fileName: `${suffix}.xlsx`,
			sheetName: `${suffix}.xlsx`,
			rowCount: 1,
			importedSections: ["Orcamento"],
			status: "IMPORTED",
		},
	});
	await prisma.constructionWork.update({
		where: { id: work.id },
		data: { activeImportId: importRow.id },
	});
	const item = await prisma.constructionBudgetItem.create({
		data: {
			id: `e2e-item-${suffix}`,
			ownerId: OWNER_A,
			workId: work.id,
			importId: importRow.id,
			parentId: null,
			index: "1",
			type: "ITEM",
			description: "Item MET",
			unit: "m2",
			quantity: 100,
			unitCost: 10,
			totalCost: 1000,
			computedStatus: "NOT_STARTED",
			sortOrder: 1,
		},
	});
	const contract = await prisma.contract.create({
		data: {
			id: `e2e-contract-${suffix}`,
			ownerId: OWNER_A,
			workId: work.id,
			code: `CT-BI-${fixtureCounter}`,
			supplierName: "Fornecedor MET",
			contractValue: 750,
			status: "RASCUNHO",
		},
	});
	const service = await prisma.contractService.create({
		data: {
			id: `e2e-service-${suffix}`,
			contractId: contract.id,
			type: "ITEM",
			description: "Servico MET",
			unit: "m2",
			quantity: 10,
			unitCost: 75,
			totalCost: 750,
			budgetItemId: null,
			sortOrder: 1,
		},
	});
	await ensureBudgetVersion(OWNER_A, work.id);
	return { work, item, contract, service };
}

describe("BI - fixture canonica MET-MVP-001 (paridade)", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	// Monta os eventos atomicos da fixture MET-MVP-001 via API (Plano 4) e
	// realoca o occurredAt dos eventos sem data explicita para o dia do corte.
	async function mountMetEvents(
		workId: string,
		contractId: string,
		serviceId: string,
	) {
		const itemId = `e2e-item-${workId.split("-")[2]}`;

		// 1. servico vinculado ao orcamento -> COMMITMENT_INCREASE 750
		const linkResponse = await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/services/link-budget`,
			await jsonBody({ links: [{ serviceId, budgetItemId: itemId }] }),
		);
		await assertStatus(linkResponse, 200);

		// 2. aditivo de reducao 50 -> COMMITMENT_REDUCTION
		await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/amendments`,
			await jsonBody({
				kind: "REDUCAO",
				value: 50,
				reason: "Supressao MET",
				date: "2026-07-01",
			}),
		);

		// 3-4. medicao contratual A: bruto 370, desconto 20, retencao 30, tributo 10
		const measurementAResponse = await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao A MET",
				discountValue: 20,
				retentionValue: 30,
				taxValue: 10,
				items: [
					{
						serviceId,
						measuredQuantity: 5,
						measuredValue: 370,
						accumulatedQuantity: 5,
						accumulatedValue: 370,
					},
				],
			}),
		);
		await assertStatus(measurementAResponse, 200);

		// 5. medicao contratual B: 10
		const measurementBResponse = await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/measurements`,
			await jsonBody({
				date: "2026-06-20",
				title: "Medicao B MET",
				items: [
					{
						serviceId,
						measuredQuantity: 1,
						measuredValue: 10,
						accumulatedQuantity: 1,
						accumulatedValue: 10,
					},
				],
			}),
		);
		const measurementBBody = await assertStatus(measurementBResponse, 200);
		const measurementBId = String((measurementBBody as { id?: string }).id);

		// 6. cancelamento da medicao B
		await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/measurements/${measurementBId}`,
			{ method: "DELETE" },
		);

		// 7. gasto geral 50
		await api(
			OWNER_A,
			`/construction/works/${workId}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-25",
				category: "SERVICOS",
				description: "Gasto geral MET",
				amount: 50,
				costType: "ATUAL",
				sourceDocument: "NF-MET-001",
				allocations: [{ budgetItemId: itemId, percentage: 100 }],
			}),
		);

		// 8. pagamento 250 + estorno de 20 (pagamento 20 excluido)
		await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/payments`,
			await jsonBody({
				date: "2026-06-30",
				value: 250,
				paidValue: 250,
				status: "PAGO",
				description: "Pagamento MET",
			}),
		);
		const partialResponse = await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/payments`,
			await jsonBody({
				date: "2026-07-01",
				value: 20,
				paidValue: 20,
				status: "PAGO",
				description: "Pagamento estornavel MET",
			}),
		);
		const partialBody = await assertStatus(partialResponse, 200);
		const partialId = String((partialBody as { id?: string }).id);
		await api(
			OWNER_A,
			`/construction/works/${workId}/contracts/${contractId}/payments/${partialId}`,
			{ method: "DELETE" },
		);

		// 9. avancu fisico 50%
		await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements`,
			await jsonBody({
				number: 1,
				date: "2026-06-15",
				title: "Medicao fisica MET",
				items: [
					{
						budgetItemId: itemId,
						measuredQuantity: 50,
						measuredValue: 500,
						accumulatedQuantity: 50,
						accumulatedValue: 500,
					},
				],
			}),
		);

		// Eventos de ledger sem data explicita (link do servico, reversoes)
		// recebem occurredAt de hoje; realoca para o dia do corte para que a
		// fixture inteira fique dentro da janela analitica.
		await prisma.constructionLedgerEvent.updateMany({
			where: {
				workId,
				occurredAt: { gt: new Date("2026-07-31T00:00:00.000Z") },
			},
			data: { occurredAt: new Date("2026-07-31T00:00:00.000Z") },
		});
	}

	it("BI-001: overview da obra reproduz os valores canonicos da fixture MET-MVP-001", async () => {
		const { work, contract, service } = await createMetFixture();
		await mountMetEvents(work.id, contract.id, service.id);

		// Overview do BI (fonte LIVE, corte no fim do periodo)
		const overviewResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/overview?asOfDate=2026-07-31`,
		);
		const body = await assertStatus(overviewResponse, 200);
		const summary = body.summary as Record<string, number | null>;
		const ledgerSummary = body.ledgerSummary as Record<string, number> | null;

		// Avanco fisico: 500 / 1000 = 0,5
		expect(summary.measuredPercentage ?? 0).toBeCloseTo(0.5, 6);
		// EV = 500 (progresso x orcamento ativo)
		expect(summary.executedValue ?? 0).toBeCloseTo(500, 2);

		// Ledger (Plano 4) alimentando o BI: valores canonicos do MET
		expect(ledgerSummary).not.toBeNull();
		expect(ledgerSummary?.committed ?? 0).toBeCloseTo(700, 2);
		expect(ledgerSummary?.amendmentNet ?? 0).toBeCloseTo(-50, 2);
		expect(ledgerSummary?.incurred ?? 0).toBeCloseTo(400, 2);
		expect(ledgerSummary?.dueOpen ?? 0).toBeCloseTo(150, 2);
		expect(ledgerSummary?.paid ?? 0).toBeCloseTo(250, 2);
	});

	it("BI-003: ausencia nao vira zero; denominador zero fica indisponivel com issue (ACE-019)", async () => {
		const { work } = await createMetFixture();

		const overviewResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/overview`,
		);
		const body = await assertStatus(overviewResponse, 200);
		const summary = body.summary as Record<string, number | null>;
		const qualityIssues = body.qualityIssues as Array<{ code: string }> | null;

		// Sem baseline e sem medicoes: indices indisponiveis (null), nunca zero.
		expect(summary.schedulePerformanceIndex).toBeNull();
		expect(summary.costPerformanceIndex).toBeNull();
		expect(summary.plannedPercentage).toBeNull();

		// Ausencia sinalizada por issues de qualidade, nao por numero falso.
		const codes = new Set((qualityIssues ?? []).map((issue) => issue.code));
		expect(codes.has("MISSING_BASELINE_SCHEDULE")).toBe(true);
		expect(codes.has("MISSING_MEASUREMENTS")).toBe(true);
		expect(codes.has("MISSING_ACTUAL_COSTS")).toBe(true);

		// Valor absoluto sem fonte: zero conhecido + issue de ausencia.
		expect(summary.measuredPercentage ?? -1).toBe(0);
		expect(summary.executedValue ?? -1).toBe(0);
	});
});
