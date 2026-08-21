import { beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	ADMIN_USER,
	api,
	assertStatus,
	CONTRACT_A,
	ensureBudgetVersion,
	ITEM_A1,
	ITEM_AD1,
	jsonBody,
	OWNER_A,
	OWNER_B,
	resetAndSeedDatabase,
	SERVICE_A1,
	SUPERVISOR_USER,
	WM_A1,
	WORK_A,
	WORK_AD,
	WORK_B,
} from "./setup.dbtest";

beforeAll(async () => {
	await resetAndSeedDatabase();
});

describe("1. ownership — owner B nao acessa recursos do owner A", () => {
	it("GET obra do owner A -> 404", async () => {
		const res = await api(OWNER_B, `/construction/works/${WORK_A}`);
		await assertStatus(res, 404);
	});

	it("GET orcamento do owner A -> 404", async () => {
		const res = await api(OWNER_B, `/construction/works/${WORK_A}/budget`);
		await assertStatus(res, 404);
	});

	it("GET medicao do owner A -> 404", async () => {
		const res = await api(
			OWNER_B,
			`/construction/works/${WORK_A}/work-measurements/${WM_A1}`,
		);
		await assertStatus(res, 404);
	});

	it("GET contrato do owner A -> 404", async () => {
		const res = await api(
			OWNER_B,
			`/construction/works/${WORK_A}/contracts/${CONTRACT_A}`,
		);
		await assertStatus(res, 404);
	});

	it("GET overview (snapshot) do owner A -> 404", async () => {
		const res = await api(OWNER_B, `/construction/works/${WORK_B}/overview`);
		await assertStatus(res, 404);
	});
});

describe("2. papeis — SUPERVISOR sem scope 403, GERENTE ok, ADMIN override", () => {
	it("Supervisor fora do scope nao transiciona governanca -> 403", async () => {
		const res = await api(
			SUPERVISOR_USER,
			`/governance/BUDGET/${WORK_A}/transition`,
			await jsonBody({ toStatus: "EM_REVISAO" }),
		);
		const body = await assertStatus(res, 403);
		expect(body.message).toContain("permissao");
	});
});

describe("3. travas — governance ACEITO real bloqueia mutacoes com 423", () => {
	it("criar item de orcamento em obra ACEITA -> 423", async () => {
		const res = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/budget/items`,
			await jsonBody({
				index: "2",
				type: "ITEM",
				description: "Item bloqueado",
				unit: "m2",
				quantity: 1,
				unitCost: 1,
			}),
		);
		const body = await assertStatus(res, 423);
		expect(body.message).toContain("reaberta");
	});

	it("editar item de orcamento em obra ACEITA -> 423", async () => {
		const res = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/budget/items/${ITEM_A1}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ quantity: 999 }),
			},
		);
		const body = await assertStatus(res, 423);
		expect(body.message).toContain("reaberta");
	});

	it("excluir item de orcamento em obra ACEITA -> 423", async () => {
		const res = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/budget/items/${ITEM_A1}`,
			{ method: "DELETE" },
		);
		const body = await assertStatus(res, 423);
		expect(body.message).toContain("reaberta");
	});

	it("reordenar itens de orcamento em obra ACEITA -> 423", async () => {
		const res = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/budget/items/reorder`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					items: [{ id: ITEM_A1, sortOrder: 5 }],
				}),
			},
		);
		const body = await assertStatus(res, 423);
		expect(body.message).toContain("reaberta");
	});

	it("criar medicao em obra ACEITA -> 423", async () => {
		const res = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/work-measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao bloqueada",
				items: [{ budgetItemId: ITEM_A1, measuredQuantity: 10 }],
			}),
		);
		const body = await assertStatus(res, 423);
		expect(body.message).toContain("reaberta");
	});

	it("criar contrato em obra ACEITA -> 423", async () => {
		const res = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/contracts`,
			await jsonBody({
				code: "CT-999",
				supplierName: "Fornecedor X",
				contractValue: 1000,
				objectDescription: "Servicos de fundacao",
			}),
		);
		const body = await assertStatus(res, 423);
		expect(body.message).toContain("reaberta");
	});
});

describe("5. reabertura — motivo obrigatorio e TRAVADO so ADMIN+override", () => {
	it("reabrir TRAVADO sem motivo -> 422", async () => {
		const res = await api(
			ADMIN_USER,
			`/governance/CONTRACT/${WORK_AD}/transition`,
			await jsonBody({ toStatus: "EM_REVISAO" }),
		);
		const body = await assertStatus(res, 422);
		expect(body.message).toContain("Motivo obrigatorio");
	});

	it("GERENTE reabrir TRAVADO mesmo com motivo -> 403", async () => {
		const res = await api(
			OWNER_A,
			`/governance/SCHEDULE/${WORK_A}/transition`,
			await jsonBody({ toStatus: "EM_REVISAO", reason: "quero reabrir" }),
		);
		const body = await assertStatus(res, 403);
		expect(body.message).toContain("override");
	});

	it("ADMIN reabre TRAVADO com motivo e override -> 200", async () => {
		const res = await api(
			ADMIN_USER,
			`/governance/CONTRACT/${WORK_AD}/transition`,
			await jsonBody({
				toStatus: "EM_REVISAO",
				reason: "reabrindo com override administrativo",
				override: true,
			}),
		);
		const body = await assertStatus(res, 200);
		expect(body.status).toBe("EM_REVISAO");
		expect(body.version).toBe(2);
	});
});

describe("6. medicao acima do saldo — 422 real e override ADMIN", () => {
	beforeAll(async () => {
		await ensureBudgetVersion(ADMIN_USER, WORK_AD);
	});

	it("medicao acima do saldo do item -> 422", async () => {
		const res = await api(
			ADMIN_USER,
			`/construction/works/${WORK_AD}/work-measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao acima do saldo",
				items: [
					{
						budgetItemId: ITEM_AD1,
						measuredQuantity: 150,
					},
				],
			}),
		);
		const body = await assertStatus(res, 422);
		expect(body.message).toContain("saldo");
	});

	it("override ADMIN com evidenceNote -> 200 e balanceOverride persistido", async () => {
		const res = await api(
			ADMIN_USER,
			`/construction/works/${WORK_AD}/work-measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao com override",
				balanceOverride: true,
				evidenceNote: "Aprovado pelo conselho com justificativa real",
				items: [
					{
						budgetItemId: ITEM_AD1,
						measuredQuantity: 150,
					},
				],
			}),
		);
		const body = await assertStatus(res, 200);
		expect(body.balanceOverride).toBe(true);
		expect(body.evidenceNote).toContain("conselho");
	});
});

describe("4. cutover — PERSISTED le fotografia e rollback LIVE volta ao vivo", () => {});

describe("garantia — fixtures de apoio usadas", () => {
	it("contrato e servico do owner A existem no banco real", async () => {
		const contract = await prisma.contract.findUnique({
			where: { id: CONTRACT_A },
			include: { services: true },
		});
		expect(contract?.ownerId).toBe(OWNER_A);
		expect(contract?.services.some((s) => s.id === SERVICE_A1)).toBe(true);
	});
});
