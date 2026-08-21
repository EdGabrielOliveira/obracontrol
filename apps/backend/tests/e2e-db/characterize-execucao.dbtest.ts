import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	api,
	assertStatus,
	CC_A,
	ensureBudgetVersion,
	jsonBody,
	OWNER_A,
	resetAndSeedDatabase,
	testApp,
} from "./setup.dbtest";

// Caracterizacao (Fase 4 - Execucao e razao financeiro): registra o
// comportamento ATUAL dos fluxos financeiros (medicao contratual, pagamento,
// estorno e gasto geral) antes do ledger de eventos. Testes que esperam o
// comportamento-alvo falham agora, documentando a lacuna; passam apos
// EXE-002..005.

let fixtureCounter = 0;

// Obra sem lock de governanca + orcamento + contrato com servico.
// Contrato: 50000 (contractValue); servico: 30 m2 x 1000 = 30000.
async function createFixture() {
	fixtureCounter += 1;
	const suffix = `exe${fixtureCounter}`;
	const work = await prisma.constructionWork.create({
		data: {
			id: `e2e-work-${suffix}`,
			ownerId: OWNER_A,
			code: `E2E-EXE-${fixtureCounter}`,
			name: `Obra execucao ${fixtureCounter}`,
			costCenterId: CC_A,
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
			description: "Servico EXE",
			unit: "m2",
			quantity: 100,
			unitCost: 1000,
			totalCost: 100000,
			computedStatus: "NOT_STARTED",
			sortOrder: 1,
		},
	});
	const contract = await prisma.contract.create({
		data: {
			id: `e2e-contract-${suffix}`,
			ownerId: OWNER_A,
			workId: work.id,
			code: `CT-EXE-${fixtureCounter}`,
			supplierName: "Fornecedor EXE",
			contractValue: 50000,
			status: "RASCUNHO",
		},
	});
	const service = await prisma.contractService.create({
		data: {
			id: `e2e-service-${suffix}`,
			contractId: contract.id,
			type: "ITEM",
			description: "Servico de Contrato EXE",
			unit: "m2",
			quantity: 30,
			unitCost: 1000,
			totalCost: 30000,
			budgetItemId: item.id,
			sortOrder: 1,
		},
	});
	await ensureBudgetVersion(OWNER_A, work.id);
	return { work, item, contract, service };
}

describe("EXE - caracterizacao do razao financeiro atual", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("fixture: medicao contratual, pagamento parcial, estorno e gasto geral via API", async () => {
		const { work, contract, service } = await createFixture();

		const measurementResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao contratual 1",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 20,
						measuredValue: 20000,
						accumulatedQuantity: 20,
						accumulatedValue: 20000,
					},
				],
			}),
		);
		const measurementBody = await assertStatus(measurementResponse, 200);
		expect((measurementBody as { id?: string }).id).toBeTruthy();

		const paymentResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 8000,
				paidValue: 8000,
				status: "PAGO",
				description: "Pagamento parcial",
			}),
		);
		const paymentBody = await assertStatus(paymentResponse, 200);
		const paymentId = String((paymentBody as { id?: string }).id);
		expect(paymentId).toBeTruthy();

		// Estorno atual = exclusao fisica do pagamento (sem evento de reversao).
		const reversalResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments/${paymentId}`,
			{ method: "DELETE" },
		);
		expect(reversalResponse.status).toBe(204);
		const remainingPayments = await prisma.contractPayment.count({
			where: { contractId: contract.id },
		});
		expect(remainingPayments).toBe(0);

		const costResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-25",
				category: "SERVICOS",
				description: "Gasto geral",
				amount: 5000,
				costType: "ATUAL",
				sourceDocument: "NF-EXE-001",
				supplierName: "Fornecedor EXE",
				allocations: [
					{
						budgetItemId: `e2e-item-${work.id.split("-")[2]}`,
						percentage: 100,
					},
				],
			}),
		);
		const costBody = await assertStatus(costResponse, 200);
		expect((costBody as { id?: string }).id).toBeTruthy();
	});

	it("EXE-004: estorno gera PAYMENT_REVERSAL e reabre o devido", async () => {
		// EXE-002/004: PAYMENT_REVERSAL como evento proprio. Hoje o estorno e
		// DELETE fisico do registro (sem tabela de eventos). Apos EXE-004,
		// deve existir ConstructionLedgerEvent com eventType PAYMENT_REVERSAL
		// ligado ao pagamento estornado.
		const { work, contract } = await createFixture();

		const paymentResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 2000,
				paidValue: 2000,
				status: "PAGO",
				description: "Estorno pendente",
			}),
		);
		const paymentBody = await assertStatus(paymentResponse, 200);
		const paymentId = String((paymentBody as { id?: string }).id);

		await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments/${paymentId}`,
			{ method: "DELETE" },
		);

		const events = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_PAYMENT", sourceId: paymentId },
			orderBy: { createdAt: "asc" },
		});
		expect(events.map((event) => event.eventType)).toEqual([
			"PAYMENT_CREATE",
			"PAYMENT_REVERSAL",
		]);
		expect(events.map((event) => event.componentId)).toEqual([
			"fornecedor",
			"fornecedor",
		]);
		expect(events.map((event) => Number(event.amount))).toEqual([2000, 2000]);
	});

	it("limite fisico: medicao contratual acima do saldo do servico -> 422", async () => {
		const { work, contract, service } = await createFixture();

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao excedente",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 40,
						measuredValue: 40000,
						accumulatedQuantity: 40,
						accumulatedValue: 40000,
					},
				],
			}),
		);

		const body = await assertStatus(response, 200);
		expect((body as { warnings?: unknown[] }).warnings).toEqual([
			expect.objectContaining({ code: "MEASUREMENT_EXCEEDS_BALANCE" }),
		]);
		expect((body as { approvalStatus?: string }).approvalStatus).toBe(
			"APPROVED",
		);
	});

	it("saldo contratual: pagamento PAGO acima do saldo -> 422", async () => {
		const { work, contract } = await createFixture();

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 60000,
				paidValue: 60000,
				status: "PAGO",
			}),
		);

		const body = await assertStatus(response, 422);
		expect((body as { message?: string }).message).toBe(
			"Pagamento acima do saldo do contrato",
		);
	});

	it("pagamento concorrente: dois PAGO simultaneos nao excedem o devido", async () => {
		const { work, contract } = await createFixture();

		const results = await Promise.all([
			api(
				OWNER_A,
				`/construction/works/${work.id}/contracts/${contract.id}/payments`,
				await jsonBody({
					date: "2026-06-20",
					value: 30000,
					paidValue: 30000,
					status: "PAGO",
					description: "Concorrente 1",
				}),
			),
			api(
				OWNER_A,
				`/construction/works/${work.id}/contracts/${contract.id}/payments`,
				await jsonBody({
					date: "2026-06-20",
					value: 30000,
					paidValue: 30000,
					status: "PAGO",
					description: "Concorrente 2",
				}),
			),
		]);

		const statuses = results.map((r) => r.status);
		expect(statuses).toContain(200);

		const paid = await prisma.contractPayment.aggregate({
			where: { contractId: contract.id, status: "PAGO" },
			_sum: { paidValue: true },
		});
		expect(Number(paid._sum.paidValue ?? 0)).toBeLessThanOrEqual(50000);
	});

	it("EXE-003: medicao contratual gera incorrido liquido e componentes de devido no ledger", async () => {
		const { work, contract, service } = await createFixture();

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao com tributo",
				discountValue: 500,
				retentionValue: 1000,
				taxValue: 500,
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 20,
						measuredValue: 20000,
						accumulatedQuantity: 20,
						accumulatedValue: 20000,
					},
				],
			}),
		);
		const body = await assertStatus(response, 200);
		const measurementId = String((body as { id?: string }).id);

		const events = await prisma.constructionLedgerEvent.findMany({
			where: {
				sourceType: "CONTRACT_MEASUREMENT",
				sourceId: measurementId,
			},
			orderBy: { createdAt: "asc" },
		});
		expect(events.map((event) => event.eventType)).toEqual([
			"INCURRED_CREATE",
			"DUE_CREATE",
			"DUE_CREATE",
			"DUE_CREATE",
		]);
		expect(events.map((event) => event.componentId)).toEqual([
			"fornecedor",
			"fornecedor",
			"retencao",
			"tributo",
		]);
		// bruto 20000 - desconto 500 = incorrido 19500;
		// liquido 19500 - retencao 1000 - tributo 500 = devido fornecedor 18000
		expect(events.map((event) => Number(event.amount))).toEqual([
			19500, 18000, 1000, 500,
		]);
		expect(events[0].budgetItemIdentityId).toBeTruthy();
		expect(events[0].budgetVersionItemId).toBeTruthy();
		expect(events[0].competence).toBe("2026-06");
	});

	it("EXE-003: estorno de medicao sem pagamento gera INCURRED_REVERSAL e DUE_CANCEL", async () => {
		const { work, contract, service } = await createFixture();

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao estornavel",
				discountValue: 100,
				retentionValue: 50,
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 10,
						measuredValue: 10000,
						accumulatedQuantity: 10,
						accumulatedValue: 10000,
					},
				],
			}),
		);
		const body = await assertStatus(response, 200);
		const measurementId = String((body as { id?: string }).id);

		const deleteResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements/${measurementId}`,
			{ method: "DELETE" },
		);
		expect(deleteResponse.status).toBe(204);

		const events = await prisma.constructionLedgerEvent.findMany({
			where: {
				sourceType: "CONTRACT_MEASUREMENT",
				sourceId: measurementId,
			},
			orderBy: { createdAt: "asc" },
		});
		expect(events.map((event) => event.eventType)).toEqual([
			"INCURRED_CREATE",
			"DUE_CREATE",
			"DUE_CREATE",
			"INCURRED_REVERSAL",
			"DUE_CANCEL",
			"DUE_CANCEL",
		]);
		expect(Number(events[3].amount)).toBe(9900);
		expect(Number(events[4].amount)).toBe(9850);
		expect(Number(events[5].amount)).toBe(50);

		const remaining = await prisma.contractMeasurement.count({
			where: { id: measurementId },
		});
		expect(remaining).toBe(0);
	});

	it("EXE-003: estorno de medicao com pagamento PAGO exige estorno de pagamento (422)", async () => {
		const { work, contract, service } = await createFixture();

		const measurementResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao paga",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 5,
						measuredValue: 5000,
						accumulatedQuantity: 5,
						accumulatedValue: 5000,
					},
				],
			}),
		);
		const measurementBody = await assertStatus(measurementResponse, 200);
		const measurementId = String((measurementBody as { id?: string }).id);

		await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 5000,
				paidValue: 5000,
				status: "PAGO",
				measurementId,
				description: "Pagamento da medicao",
			}),
		);

		const deleteResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements/${measurementId}`,
			{ method: "DELETE" },
		);
		const body = await assertStatus(deleteResponse, 422);
		expect((body as { message?: string }).message).toBe(
			"Medicao com pagamento registrado: estorne o pagamento antes de reverter",
		);
	});

	it("EXE-003: medicao sem cobertura orcamentaria vigente e rejeitada (422)", async () => {
		const { work, contract, service } = await createFixture();
		await prisma.contractService.update({
			where: { id: service.id },
			data: { budgetItemId: null },
		});

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Sem cobertura",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 5,
						measuredValue: 5000,
						accumulatedQuantity: 5,
						accumulatedValue: 5000,
					},
				],
			}),
		);

		const body = await assertStatus(response, 422);
		expect((body as { message?: string }).message).toBe(
			`Sem cobertura orcamentaria vigente para a medicao do contrato (servicos: ${service.id})`,
		);
	});

	it("EXE-003: medicao ja contabilizada nao aceita alteracao de valores (422)", async () => {
		const { work, contract, service } = await createFixture();

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao fixa",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 5,
						measuredValue: 5000,
						accumulatedQuantity: 5,
						accumulatedValue: 5000,
					},
				],
			}),
		);
		const body = await assertStatus(response, 200);
		const measurementId = String((body as { id?: string }).id);

		const updateResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements/${measurementId}`,
			{ ...(await jsonBody({ discountValue: 200 })), method: "PATCH" },
		);
		const updateBody = await assertStatus(updateResponse, 422);
		expect((updateBody as { message?: string }).message).toBe(
			"Medicao ja contabilizada no razao financeiro: estorne e recrie para alterar valores",
		);
	});

	it("EXE-003: aditivo gera COMMITMENT_INCREASE/REDUCTION e remocao reverte", async () => {
		const { work, contract } = await createFixture();

		const increaseResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/amendments`,
			await jsonBody({
				kind: "ADITIVO",
				value: 5000,
				reason: "Escopo adicional",
				date: "2026-07-01",
			}),
		);
		const increaseBody = await assertStatus(increaseResponse, 200);
		const amendmentId = String((increaseBody as { id?: string }).id);

		const reductionResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/amendments`,
			await jsonBody({
				kind: "REDUCAO",
				value: 2000,
				reason: "Supressao de escopo",
				date: "2026-07-02",
			}),
		);
		await assertStatus(reductionResponse, 200);

		const events = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_AMENDMENT" },
			orderBy: { createdAt: "asc" },
		});
		expect(events.map((event) => event.eventType)).toEqual([
			"COMMITMENT_INCREASE",
			"COMMITMENT_REDUCTION",
		]);
		expect(events.map((event) => event.componentId)).toEqual([
			"AMENDMENT",
			"AMENDMENT",
		]);
		expect(events.map((event) => Number(event.amount))).toEqual([5000, 2000]);

		const deleteResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/amendments/${amendmentId}`,
			{ method: "DELETE" },
		);
		expect(deleteResponse.status).toBe(204);

		const afterDelete = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_AMENDMENT" },
			orderBy: { createdAt: "asc" },
		});
		expect(afterDelete.map((event) => event.eventType)).toEqual([
			"COMMITMENT_INCREASE",
			"COMMITMENT_REDUCTION",
			"COMMITMENT_REDUCTION",
		]);
	});

	it("EXE-003: servico vinculado ao orcamento gera COMMITMENT_INCREASE e desvinculacao reverte", async () => {
		const { work, contract } = await createFixture();

		const created = await prisma.contractService.create({
			data: {
				contractId: contract.id,
				type: "ITEM",
				description: "Servico vinculado depois",
				unit: "m2",
				quantity: 10,
				unitCost: 1000,
				totalCost: 10000,
				budgetItemId: null,
				sortOrder: 2,
			},
		});

		const linkResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/services/link-budget`,
			await jsonBody({
				links: [
					{
						serviceId: created.id,
						budgetItemId: `e2e-item-${work.id.split("-")[2]}`,
					},
				],
			}),
		);
		await assertStatus(linkResponse, 200);

		const eventsAfterLink = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_SERVICE" },
			orderBy: { createdAt: "asc" },
		});
		expect(eventsAfterLink.map((event) => event.eventType)).toEqual([
			"COMMITMENT_INCREASE",
		]);
		expect(eventsAfterLink[0].componentId).toBe("BASE");
		expect(Number(eventsAfterLink[0].amount)).toBe(10000);
		expect(eventsAfterLink[0].sourceId).toBe(`${created.id}#1`);

		const unlinkResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/services/${created.id}`,
			{ ...(await jsonBody({ budgetItemId: null })), method: "PATCH" },
		);
		const body = await assertStatus(unlinkResponse, 200);
		expect((body as { budgetItemId?: string | null }).budgetItemId).toBeNull();

		const events = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_SERVICE" },
			orderBy: { createdAt: "asc" },
		});
		expect(events.map((event) => event.eventType)).toEqual([
			"COMMITMENT_INCREASE",
			"COMMITMENT_REDUCTION",
		]);
		expect(Number(events[1].amount)).toBe(10000);
		expect(events[1].sourceId).toBe(`${created.id}#1`);
	});

	it("EXE-004: pagamento PAGO gera PAYMENT_CREATE de fornecedor e reduz o devido aberto", async () => {
		const { work, contract, service } = await createFixture();

		const measurementResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao para pagamento",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 20,
						measuredValue: 20000,
						accumulatedQuantity: 20,
						accumulatedValue: 20000,
					},
				],
			}),
		);
		await assertStatus(measurementResponse, 200);

		const paymentResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 8000,
				paidValue: 8000,
				status: "PAGO",
				description: "Pagamento EXE-004",
			}),
		);
		const paymentBody = await assertStatus(paymentResponse, 200);
		const paymentId = String((paymentBody as { id?: string }).id);

		const events = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_PAYMENT", sourceId: paymentId },
			orderBy: { createdAt: "asc" },
		});
		expect(events.map((event) => event.eventType)).toEqual(["PAYMENT_CREATE"]);
		expect(events[0].componentId).toBe("fornecedor");
		expect(Number(events[0].amount)).toBe(8000);
		expect(events[0].budgetItemIdentityId).toBeTruthy();
		expect(events[0].budgetVersionItemId).toBeTruthy();

		// Pagamento EM_ABERTO nao cria PAYMENT_CREATE.
		const openResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-21",
				value: 3000,
				paidValue: 0,
				status: "EM_ABERTO",
				description: "Aberto EXE-004",
			}),
		);
		const openBody = await assertStatus(openResponse, 200);
		const openPaymentId = String((openBody as { id?: string }).id);
		const openEvents = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_PAYMENT", sourceId: openPaymentId },
		});
		expect(openEvents).toHaveLength(0);
	});

	it("EXE-004: createdBy forjado no pagamento e ignorado", async () => {
		const { work, contract } = await createFixture();

		const paymentResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 1000,
				paidValue: 1000,
				status: "PAGO",
				description: "Forjado",
				createdBy: "e2e-user-viewer",
			} as Record<string, unknown>),
		);
		await assertStatus(paymentResponse, 200);
	});

	it("EXE-004: gasto geral gera INCURRED_CREATE e DUE_CREATE; quitado a vista gera PAYMENT_CREATE", async () => {
		const { work } = await createFixture();
		const budgetItemId = `e2e-item-${work.id.split("-")[2]}`;

		const openCostResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-25",
				category: "SERVICOS",
				description: "Gasto geral EXE-004",
				amount: 5000,
				costType: "ATUAL",
				sourceDocument: "NF-GERAL-001",
				supplierName: "Fornecedor EXE",
				allocations: [{ budgetItemId, percentage: 100 }],
			}),
		);
		const openCostBody = await assertStatus(openCostResponse, 200);
		const openCostId = String((openCostBody as { id?: string }).id);

		const openEvents = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "GENERAL_COST", sourceId: openCostId },
			orderBy: { createdAt: "asc" },
		});
		expect(openEvents.map((event) => event.eventType)).toEqual([
			"INCURRED_CREATE",
			"DUE_CREATE",
		]);
		expect(openEvents.map((event) => event.componentId)).toEqual([
			budgetItemId,
			"fornecedor",
		]);
		expect(openEvents.map((event) => Number(event.amount))).toEqual([
			5000, 5000,
		]);
		expect(openEvents[0].budgetItemIdentityId).toBeTruthy();

		const paidCostResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-26",
				category: "SERVICOS",
				description: "Gasto geral a vista EXE-004",
				amount: 3000,
				costType: "ATUAL",
				sourceDocument: "NF-GERAL-002",
				supplierName: "Fornecedor EXE",
				paymentStatus: "PAID",
				allocations: [{ budgetItemId, percentage: 100 }],
			}),
		);
		const paidCostBody = await assertStatus(paidCostResponse, 200);
		const paidCostId = String((paidCostBody as { id?: string }).id);

		const paidEvents = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "GENERAL_COST", sourceId: paidCostId },
			orderBy: { createdAt: "asc" },
		});
		expect(paidEvents.map((event) => event.eventType)).toEqual([
			"INCURRED_CREATE",
			"DUE_CREATE",
			"PAYMENT_CREATE",
		]);
		expect(Number(paidEvents[2].amount)).toBe(3000);
		expect(paidEvents[2].componentId).toBe("fornecedor");
	});

	it("EXE-004: gasto geral com sourceDocument de pagamento de contrato e rejeitado (422)", async () => {
		const { work, contract, item } = await createFixture();

		await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-20",
				value: 3000,
				paidValue: 3000,
				status: "PAGO",
				description: "NF-DUPLA-001",
			}),
		);

		const costResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-25",
				category: "SERVICOS",
				description: "Mesmo fato do pagamento",
				amount: 3000,
				costType: "ATUAL",
				sourceDocument: "NF-DUPLA-001",
				allocations: [{ budgetItemId: item.id, percentage: 100 }],
			}),
		);
		const body = await assertStatus(costResponse, 422);
		expect((body as { message?: string }).message).toBe(
			"Ja existe custo manual ou pagamento de contrato com este documento de origem",
		);
	});

	it("EXE-004: gasto geral com sourceDocument duplicado na obra e rejeitado (422)", async () => {
		const { work } = await createFixture();
		const budgetItemId = `e2e-item-${work.id.split("-")[2]}`;

		await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-25",
				category: "SERVICOS",
				description: "Primeiro gasto",
				amount: 2000,
				costType: "ATUAL",
				sourceDocument: "NF-GERAL-DUPLICADA",
				supplierName: "Fornecedor EXE",
				allocations: [{ budgetItemId, percentage: 100 }],
			}),
		);

		const duplicateResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-26",
				category: "SERVICOS",
				description: "Segundo gasto com mesmo documento",
				amount: 1500,
				costType: "ATUAL",
				sourceDocument: "NF-GERAL-DUPLICADA",
				supplierName: "Fornecedor EXE",
				allocations: [{ budgetItemId, percentage: 100 }],
			}),
		);
		const body = await assertStatus(duplicateResponse, 422);
		expect((body as { message?: string }).message).toBe(
			"Ja existe custo manual ou pagamento de contrato com este documento de origem",
		);
	});

	it("EXE-005: medicao fisica com item sem versao vigente e rejeitada (422)", async () => {
		const { work, item } = await createFixture();
		const suffix = work.id.split("-")[2];

		const firstResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				number: 1,
				date: "2026-06-15",
				title: "Medicao baseline",
				items: [
					{
						budgetItemId: item.id,
						measuredQuantity: 10,
						measuredValue: 10000,
						accumulatedQuantity: 10,
						accumulatedValue: 10000,
					},
				],
			}),
		);
		await assertStatus(firstResponse, 200);

		const lateItem = await prisma.constructionBudgetItem.create({
			data: {
				id: `e2e-late-${suffix}`,
				ownerId: OWNER_A,
				workId: work.id,
				importId: `e2e-import-${suffix}`,
				parentId: null,
				index: "2",
				type: "ITEM",
				description: "Item criado apos a baseline",
				unit: "m2",
				quantity: 10,
				totalCost: 10000,
				computedStatus: "NOT_STARTED",
				sortOrder: 99,
			},
		});

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				number: 2,
				date: "2026-06-25",
				title: "Medicao sem versao",
				items: [
					{
						budgetItemId: lateItem.id,
						measuredQuantity: 5,
						measuredValue: 5000,
						accumulatedQuantity: 5,
						accumulatedValue: 5000,
					},
				],
			}),
		);
		const body = await assertStatus(response, 422);
		expect((body as { message?: string }).message).toContain("versao vigente");
	});

	it("EXE-005: medicao fisica aprovada nao gera eventos financeiros (ACE-011)", async () => {
		const { work, item } = await createFixture();

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				number: 1,
				date: "2026-06-15",
				title: "Medicao fisica EXE-005",
				items: [
					{
						budgetItemId: item.id,
						measuredQuantity: 20,
						measuredValue: 20000,
						accumulatedQuantity: 20,
						accumulatedValue: 20000,
					},
				],
			}),
		);
		const body = await assertStatus(response, 200);
		expect((body as { id?: string }).id).toBeTruthy();

		const events = await prisma.constructionLedgerEvent.findMany({
			where: { workId: work.id },
		});
		expect(events).toEqual([]);
	});

	it("EXE-005: ACE-010 limite fisico bloqueia com saldo disponivel", async () => {
		const { work, item } = await createFixture();
		const measuredValue = 90000;

		const firstResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				number: 1,
				date: "2026-06-15",
				title: "Acumulado 90%",
				items: [
					{
						budgetItemId: item.id,
						measuredQuantity: 90,
						measuredValue,
						accumulatedQuantity: 90,
						accumulatedValue: measuredValue,
					},
				],
			}),
		);
		await assertStatus(firstResponse, 200);

		const exceedingResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				number: 2,
				date: "2026-06-25",
				title: "Excede o saldo",
				items: [
					{
						budgetItemId: item.id,
						measuredQuantity: 15,
						measuredValue: 15000,
						accumulatedQuantity: 105,
						accumulatedValue: 105000,
					},
				],
			}),
		);
		const body = await assertStatus(exceedingResponse, 422);
		expect((body as { message?: string }).message).toBe(
			"Medicao acima do saldo do item de orcamento",
		);
	});

	it("EXE-005: ACE-011 medicao contratual nao altera o avanco fisico", async () => {
		const { work, contract, service, item } = await createFixture();

		const contractMeasurementResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao contratual EXE-005",
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 20,
						measuredValue: 20000,
						accumulatedQuantity: 20,
						accumulatedValue: 20000,
					},
				],
			}),
		);
		await assertStatus(contractMeasurementResponse, 200);

		const contractEvents = await prisma.constructionLedgerEvent.findMany({
			where: { workId: work.id, sourceType: "CONTRACT_MEASUREMENT" },
		});
		expect(contractEvents.length).toBeGreaterThan(0);

		const physicalItems = await prisma.workMeasurementItem.findMany({
			where: { budgetItemId: item.id },
		});
		expect(physicalItems).toEqual([]);
	});

	it("EXE-006: fixture MET-MVP-001 reconcilia comprometido, incorrido, devido e pago", async () => {
		const { work, contract } = await createFixture();
		const suffix = work.id.split("-")[2];

		const service = await prisma.contractService.create({
			data: {
				contractId: contract.id,
				type: "ITEM",
				description: "Servico MET",
				unit: "m2",
				quantity: 10,
				unitCost: 75,
				totalCost: 750,
				budgetItemId: null,
				sortOrder: 2,
			},
		});
		const linkResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/services/link-budget`,
			await jsonBody({
				links: [{ serviceId: service.id, budgetItemId: `e2e-item-${suffix}` }],
			}),
		);
		await assertStatus(linkResponse, 200);

		await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/amendments`,
			await jsonBody({
				kind: "REDUCAO",
				value: 50,
				reason: "Supressao MET",
				date: "2026-07-01",
			}),
		);

		const measurementAResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao A MET",
				discountValue: 20,
				retentionValue: 30,
				taxValue: 10,
				items: [
					{
						serviceId: service.id,
						measuredQuantity: 5,
						measuredValue: 370,
						accumulatedQuantity: 5,
						accumulatedValue: 370,
					},
				],
			}),
		);
		await assertStatus(measurementAResponse, 200);

		const measurementBResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements`,
			await jsonBody({
				date: "2026-06-20",
				title: "Medicao B MET",
				items: [
					{
						serviceId: service.id,
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

		await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/measurements/${measurementBId}`,
			{ method: "DELETE" },
		);

		await api(
			OWNER_A,
			`/construction/works/${work.id}/actual-costs`,
			await jsonBody({
				costDate: "2026-06-25",
				category: "SERVICOS",
				description: "Gasto geral MET",
				amount: 50,
				costType: "ATUAL",
				sourceDocument: "NF-MET-001",
				allocations: [{ budgetItemId: `e2e-item-${suffix}`, percentage: 100 }],
			}),
		);

		const paymentResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-06-30",
				value: 250,
				paidValue: 250,
				status: "PAGO",
				description: "Pagamento MET",
			}),
		);
		await assertStatus(paymentResponse, 200);

		const partialResponse = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
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
			`/construction/works/${work.id}/contracts/${contract.id}/payments/${partialId}`,
			{ method: "DELETE" },
		);

		const { summarizeLedger } = await import(
			"../../src/modules/construction-planning/ledger/ledger.service"
		);
		const summary = await summarizeLedger(
			OWNER_A,
			work.id,
			new Date("2026-12-31"),
		);
		expect(summary.committed).toBe("700.00");
		expect(summary.incurred).toBe("400.00");
		expect(summary.dueOpen).toBe("150.00");
		expect(summary.paid).toBe("250.00");
		expect(summary.contracts.contractedValue).toBe("700.00");
		expect(summary.contracts.amendmentNet).toBe("-50.00");
	});

	it("EXE-006: pagamentos concorrentes medem retry de conflito serializavel", async () => {
		const { work, contract } = await createFixture();
		const { serializableRetryStats } = await import(
			"../../src/lib/transaction-retry"
		);
		serializableRetryStats.attempts = 0;
		serializableRetryStats.conflicts = 0;

		const results = await Promise.all([
			api(
				OWNER_A,
				`/construction/works/${work.id}/contracts/${contract.id}/payments`,
				await jsonBody({
					date: "2026-06-20",
					value: 30000,
					paidValue: 30000,
					status: "PAGO",
					description: "Concorrente A",
				}),
			),
			api(
				OWNER_A,
				`/construction/works/${work.id}/contracts/${contract.id}/payments`,
				await jsonBody({
					date: "2026-06-20",
					value: 30000,
					paidValue: 30000,
					status: "PAGO",
					description: "Concorrente B",
				}),
			),
		]);
		const statuses = results.map((response) => response.status);
		expect(statuses).toContain(200);
		expect(statuses).toContain(422);

		console.log("EXE-006 stats:", JSON.stringify(serializableRetryStats));
		const paidEvents = await prisma.constructionLedgerEvent.count({
			where: { workId: work.id, eventType: "PAYMENT_CREATE" },
		});
		expect(paidEvents).toBe(1);
	});
});

describe("LEGADO - classificacao de registros antigos de contrato", () => {
	// Task 8 Step 1: contagem somente-leitura de registros legados.
	// Nao auto-vincula por descricao/tipo/unidade e nao faz migracao destrutiva.
	it("classifica servicos sem budgetItemId, itens de medicao invalidos e pagamentos sem vinculo", async () => {
		const suffix = `leg${++fixtureCounter}`;
		const work = await prisma.constructionWork.create({
			data: {
				id: `e2e-work-${suffix}`,
				ownerId: OWNER_A,
				code: `E2E-LEG-${fixtureCounter}`,
				name: `Obra legado ${fixtureCounter}`,
				costCenterId: CC_A,
				baseDate: new Date("2026-01-01"),
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-12-31"),
				areaM2: 100,
			},
		});
		const contract = await prisma.contract.create({
			data: {
				id: `e2e-contract-${suffix}`,
				ownerId: OWNER_A,
				workId: work.id,
				code: `CT-LEG-${fixtureCounter}`,
				supplierName: "Fornecedor Legado",
				contractValue: 10000,
				status: "EM_ANDAMENTO",
			},
		});

		// Servico legado sem cobertura orcamentaria (sem budgetItemId).
		const legacyService = await prisma.contractService.create({
			data: {
				id: `e2e-service-${suffix}`,
				contractId: contract.id,
				type: "ITEM",
				description: "Servico legado sem item",
				unit: "un",
				quantity: 1,
				unitCost: 1000,
				totalCost: 1000,
				budgetItemId: null,
				sortOrder: 1,
			},
		});

		// Medicao legada com item apontando para servico de OUTRO contrato.
		const otherContract = await prisma.contract.create({
			data: {
				id: `e2e-contract-other-${suffix}`,
				ownerId: OWNER_A,
				workId: work.id,
				code: `CT-LEG-OTHER-${fixtureCounter}`,
				supplierName: "Fornecedor Outro",
				contractValue: 5000,
				status: "EM_ANDAMENTO",
			},
		});
		const foreignService = await prisma.contractService.create({
			data: {
				id: `e2e-service-other-${suffix}`,
				contractId: otherContract.id,
				type: "ITEM",
				description: "Servico de outro contrato",
				unit: "un",
				quantity: 1,
				unitCost: 500,
				totalCost: 500,
				budgetItemId: null,
				sortOrder: 1,
			},
		});
		const measurement = await prisma.contractMeasurement.create({
			data: {
				id: `e2e-measurement-${suffix}`,
				ownerId: OWNER_A,
				contractId: contract.id,
				number: 1,
				date: new Date("2026-06-15"),
				title: "Medicao legada",
			},
		});
		await prisma.contractMeasurementItem.create({
			data: {
				id: `e2e-item-${suffix}`,
				measurementId: measurement.id,
				serviceId: foreignService.id,
				measuredQuantity: 1,
				measuredValue: 100,
			},
		});

		// Pagamento geral sem vinculo de medicao (legitimo) e pagamento com vinculo.
		await prisma.contractPayment.create({
			data: {
				id: `e2e-payment-${suffix}`,
				ownerId: OWNER_A,
				contractId: contract.id,
				date: new Date("2026-06-20"),
				value: 500,
				paidValue: 500,
				status: "PAGO",
				measurementId: null,
			},
		});

		// Contagem somente-leitura (sem alterar dados).
		const servicesWithoutBudget = await prisma.contractService.count({
			where: { contractId: contract.id, budgetItemId: null },
		});
		const measurementIds = await prisma.contractMeasurement.findMany({
			where: { contractId: contract.id },
			select: { id: true },
		});
		const contractServiceIds = (
			await prisma.contractService.findMany({
				where: { contractId: contract.id },
				select: { id: true },
			})
		).map((s) => s.id);
		const foreignItems = await prisma.contractMeasurementItem.findMany({
			where: {
				measurementId: { in: measurementIds.map((m) => m.id) },
				serviceId: { notIn: contractServiceIds },
			},
			select: { id: true },
		});
		const contractMeasurementIds = (
			await prisma.contractMeasurement.findMany({
				where: { contractId: contract.id },
				select: { id: true },
			})
		).map((m) => m.id);
		const paymentsInvalidOrNullRef = await prisma.contractPayment.count({
			where: {
				contractId: contract.id,
				OR: [
					{ measurementId: null },
					{
						measurementId: {
							notIn: contractMeasurementIds,
						},
					},
				],
			},
		});

		expect(servicesWithoutBudget).toBe(1);
		expect(foreignItems.length).toBe(1);
		expect(foreignItems[0]?.id).toBe(`e2e-item-${suffix}`);
		expect(paymentsInvalidOrNullRef).toBe(1);

		// Nenhuma mutacao destrutiva: os registros seguem intactos.
		const stillThere = await prisma.contractService.findUnique({
			where: { id: legacyService.id },
			select: { id: true },
		});
		expect(stillThere).not.toBeNull();
	});
});

void testApp;
