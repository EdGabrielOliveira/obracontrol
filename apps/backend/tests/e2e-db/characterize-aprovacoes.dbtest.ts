import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	ADMIN_USER,
	api,
	assertStatus,
	CC_A,
	ensureBudgetVersion,
	jsonBody,
	ORG_A,
	OWNER_A,
	resetAndSeedDatabase,
	testApp,
	WORK_A,
} from "./setup.dbtest";

// Caracterizacao (Fase 3 - Aprovacoes e Notificacoes): registra o comportamento
// ATUAL da governanca (GovernanceRecord sem alçadas, sem solicitações de
// decisão) antes da implementacao do plano. Todos devem FALHAR agora e PASSAR
// apos as tasks 2-6, exceto onde anotado.

let unlockedCounter = 0;

// Prova que a mutacao gera solicitacao de aprovacao registrada (APR-004):
// criacoes deferidas usam resourceId nulo e commandId/idempotencyKey
// especificos do comando.
async function expectApprovalRequestCount(resourceId: string) {
	const approvalCount = await prisma.approvalRequest.count({
		where: {
			OR: [
				{ resourceId },
				{ idempotencyKey: { startsWith: "contract-create-" } },
			],
		},
	});
	expect(approvalCount).toBe(1);
}

async function createUnlockedWork() {
	unlockedCounter += 1;
	const suffix = `sl${unlockedCounter}`;
	const work = await prisma.constructionWork.create({
		data: {
			id: `e2e-work-${suffix}`,
			ownerId: OWNER_A,
			code: `E2E-${suffix.toUpperCase()}`,
			name: `Obra sem lock ${unlockedCounter}`,
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
	await prisma.constructionBudgetItem.create({
		data: {
			id: `e2e-item-${suffix}`,
			ownerId: OWNER_A,
			workId: work.id,
			importId: importRow.id,
			parentId: null,
			index: "1",
			type: "ITEM",
			description: "Servico sem lock",
			unit: "m2",
			quantity: 100,
			unitCost: 1000,
			totalCost: 100000,
			computedStatus: "NOT_STARTED",
			sortOrder: 1,
		},
	});
	return work;
}

describe("APR - caracterizacao da governanca atual", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("medição de obra acontece sem decisão especifica (efeito direto)", async () => {
		const work = await createUnlockedWork();
		await ensureBudgetVersion(OWNER_A, work.id);
		const response = await api(
			ADMIN_USER,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao sem aprovacao",
				items: [
					{
						budgetItemId: `e2e-item-${work.id.split("-")[2]}`,
						measuredQuantity: 10,
					},
				],
			}),
		);

		const body = await assertStatus(response, 200);
		expect((body as { id?: string }).id).toBeTruthy();

		// Hoje nao existe ApprovalRequest: a mutacao nao gera solicitacao.
		// Apos APR-002, deve existir exatamente 1 solicitacao para a acao.
		await expectApprovalRequestCount(String((body as { id?: string }).id));
	});

	it("contrato é criado sem decisão especifica (efeito direto)", async () => {
		const work = await createUnlockedWork();
		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts`,
			await jsonBody({
				code: "CT-SEM-APROVACAO",
				supplierName: "Fornecedor Direto",
				contractValue: 1000,
				objectDescription: "Servicos de fundacao",
			}),
		);

		const body = await assertStatus(response, 200);
		// DEC-005: GERENTE executa direto e a resposta e CommandResult EXECUTED.
		expect(body.status).toBe("EXECUTED");
		const data = body.data as { id?: string };
		expect(data.id).toBeTruthy();

		await expectApprovalRequestCount(String(data.id));
	});

	it("pagamento é registrado sem decisão especifica", async () => {
		const work = await createUnlockedWork();
		const contract = await prisma.contract.create({
			data: {
				id: "e2e-contract-sem-aprov",
				ownerId: OWNER_A,
				workId: work.id,
				code: "CT-SEM-APROV-2",
				supplierName: "Fornecedor Direto",
				contractValue: 10000,
				status: "RASCUNHO",
			},
		});

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/contracts/${contract.id}/payments`,
			await jsonBody({
				date: "2026-07-01",
				value: 100,
				paidValue: 100,
				status: "PAGO",
			}),
		);

		const body = await assertStatus(response, 200);
		expect((body as { id?: string }).id).toBeTruthy();
	});

	it("autoaprovação do owner (efetiva sem alçada)", async () => {
		const response = await api(
			OWNER_A,
			`/governance/WORK/${WORK_A}/transition`,
			await jsonBody({
				toStatus: "EM_REVISAO",
				reason: "Caracterizacao de governanca",
			}),
		);

		const body = await assertStatus(response, 200);
		expect((body as { status?: string }).status).toBe("EM_REVISAO");
	});

	it("membro delegado muta obra sem decisão de superior (sem lock de governanca)", async () => {
		const work = await createUnlockedWork();
		await ensureBudgetVersion(OWNER_A, work.id);
		const itemId = `e2e-item-${work.id.split("-")[2]}`;

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				date: "2026-06-16",
				title: "Medicao de membro",
				items: [
					{
						budgetItemId: itemId,
						measuredQuantity: 10,
					},
				],
			}),
		);

		const body = await assertStatus(response, 200);
		expect((body as { id?: string }).id).toBeTruthy();
	});

	it("APR-005: TRAVADO continua bloqueando mutacao (lock antigo)", async () => {
		await prisma.governanceRecord.upsert({
			where: {
				ownerId_entityType_entityId: {
					ownerId: OWNER_A,
					entityType: "SCHEDULE",
					entityId: WORK_A,
				},
			},
			create: {
				ownerId: OWNER_A,
				entityType: "SCHEDULE",
				entityId: WORK_A,
				status: "TRAVADO",
				version: 1,
				changedBy: OWNER_A,
			},
			update: { status: "TRAVADO" },
		});

		const response = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/schedule/revisions`,
			await jsonBody({
				index: "1.1",
				replannedStart: "2026-04-01",
				replannedEnd: "2026-07-31",
				revisionDate: "2026-03-01",
				reason: "Deve ser bloqueado",
			}),
		);

		expect(response.status).toBe(423);
	});

	it("APR-005: solicitacao pendente bloqueia mutacao ate a decisao", async () => {
		const work = await createUnlockedWork();
		await ensureBudgetVersion(OWNER_A, work.id);
		await prisma.approvalRequest.create({
			data: {
				ownerId: OWNER_A,
				actorId: OWNER_A,
				actorRole: "GERENTE",
				organizationId: ORG_A,
				costCenterId: CC_A,
				resourceType: "WORK",
				resourceId: work.id,
				effectAction: "WORK_MEASUREMENT_APPROVE",
				payloadJson: { workId: work.id },
				payloadHash: "hash-pendente",
				expectedVersion: 1,
				idempotencyKey: "key-pendente",
				requiredApproverRole: "GERENTE",
				status: "PENDING",
			},
		});

		const response = await api(
			OWNER_A,
			`/construction/works/${work.id}/work-measurements`,
			await jsonBody({
				date: "2026-06-17",
				title: "Medicao bloqueada por pendencia",
				items: [
					{
						budgetItemId: `e2e-item-${work.id.split("-")[2]}`,
						measuredQuantity: 5,
					},
				],
			}),
		);

		expect(response.status).toBe(423);
	});
});

describe("APR - ciclo completo de estouro orcamentario (BUDGET_IMPACT_APPROVE)", () => {
	// Regra de confianca: o dono do recurso (GERENTE) executa a acao
	// automaticamente; o estouro e auto-aprovado e consome saldo sem fila.
	// O fluxo MANUAL (PENDING + decide) permanece coberto por unit tests de
	// approval.service e budget-control.
	it("estouro de servico de contrato com dono confiavel e auto-aprovado e consome saldo", async () => {
		const work = await createUnlockedWork();
		await ensureBudgetVersion(OWNER_A, work.id);
		const itemId = `e2e-item-${work.id.split("-")[2]}`;

		const contract = await assertStatus(
			await api(
				OWNER_A,
				`/construction/works/${work.id}/contracts`,
				await jsonBody({
					code: "CT-OVERFLOW",
					supplierName: "Fornecedor X",
					contractValue: 1000,
					objectDescription: "Servicos de fundacao",
				}),
			),
			200,
		);

		// Servico 150 x 1000 = 150.000 > limite do item (100.000): estouro.
		const service = await assertStatus(
			await api(
				OWNER_A,
				`/construction/works/${work.id}/contracts/${(contract.data as { id?: string }).id}/services`,
				await jsonBody({
					type: "ITEM",
					description: "Servico Overflow",
					unit: "m2",
					quantity: 150,
					unitCost: 1000,
					budgetItemId: itemId,
				}),
			),
			200,
		);
		const serviceId = (service as { id?: string }).id;
		expect(serviceId).toBeTruthy();

		const impact = await prisma.constructionBudgetImpact.findFirst({
			where: { workId: work.id, sourceType: "CONTRACT_SERVICE" },
		});
		if (!impact) throw new Error("Impacto de estouro nao encontrado");
		expect(impact.status).toBe("APPROVED");

		const pending = (await assertStatus(
			await api(OWNER_A, `/governance/approvals/pending?workId=${work.id}`),
			200,
		)) as unknown as Array<{
			effectAction: string;
			resourceId: string;
		}>;
		expect(
			pending.some(
				(row) =>
					row.effectAction === "BUDGET_IMPACT_APPROVE" &&
					row.resourceId === work.id,
			),
		).toBe(false);

		const events = await prisma.constructionLedgerEvent.findMany({
			where: { sourceType: "CONTRACT_SERVICE", sourceId: impact.sourceId },
		});
		expect(
			events.some((event) => event.eventType === "COMMITMENT_INCREASE"),
		).toBe(true);
	});
});

void testApp;
void CC_A;
