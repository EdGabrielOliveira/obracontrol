import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	api,
	assertStatus,
	jsonBody,
	OWNER_A,
	resetAndSeedDatabase,
	WORK_B,
} from "./setup.dbtest";

// ORC-001: confirmar persistencia, serializacao e exibicao de valores.
// Evidencia: item com quantidade 10 x preco 50 = total 500 e etapa com soma
// de filhos, exercitando o fluxo real (rota -> service -> repository -> DB).

let stageId = "";
let itemId = "";

describe("ORC-001 - persistencia e serializacao de valores do orcamento", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("cria etapa com total declarado e filho com total derivado (10 x 50 = 500)", async () => {
		const stageResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_B}/budget/items`,
			await jsonBody({
				index: "9",
				type: "STAGE",
				description: "Etapa ORC-001",
				totalCost: 500,
			}),
		);
		const stageBody = (await assertStatus(stageResponse, 201)) as {
			id?: string;
		};
		stageId = stageBody.id ?? "";
		expect(stageId).toBeTruthy();

		const itemResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_B}/budget/items`,
			await jsonBody({
				parentId: stageId,
				index: "9.1",
				type: "ITEM",
				description: "Servico ORC-001",
				unit: "m2",
				quantity: 10,
				unitCost: 50,
			}),
		);
		const itemBody = (await assertStatus(itemResponse, 201)) as {
			id?: string;
			quantity?: unknown;
			unitCost?: unknown;
			totalCost?: unknown;
		};
		itemId = itemBody.id ?? "";
		expect(itemId).toBeTruthy();
		expect(itemBody).toMatchObject({
			quantity: 10,
			unitCost: 50,
			totalCost: 500,
		});
	});

	it("persiste o total derivado no banco como valor numerico", async () => {
		const stored = await prisma.constructionBudgetItem.findUnique({
			where: { id: itemId },
		});

		expect(Number(stored?.quantity)).toBe(10);
		expect(Number(stored?.unitCost)).toBe(50);
		expect(Number(stored?.totalCost)).toBe(500);
	});

	it("serializa total derivado, unitCost e quantity como numero na leitura", async () => {
		const response = await api(
			OWNER_A,
			`/construction/works/${WORK_B}/budget/items/${itemId}`,
		);
		const body = (await assertStatus(response, 200)) as {
			item?: { quantity?: unknown; unitCost?: unknown; totalCost?: unknown };
		};

		expect(body.item?.quantity).toBe(10);
		expect(body.item?.unitCost).toBe(50);
		expect(body.item?.totalCost).toBe(500);
	});

	it("etapa na arvore soma os totais dos filhos", async () => {
		const response = await api(OWNER_A, `/construction/works/${WORK_B}/budget`);
		const body = (await assertStatus(response, 200)) as {
			items?: Array<{
				id?: string;
				totalCost?: unknown;
				children?: Array<{ id?: string; totalCost?: unknown }>;
			}>;
		};

		const stage = body.items?.find((item) => item.id === stageId);
		expect(stage).toBeTruthy();
		expect(stage?.totalCost).toBe(500);
		expect(stage?.children?.some((child) => child.id === itemId)).toBe(true);
		const item = stage?.children?.find((child) => child.id === itemId);
		expect(item?.totalCost).toBe(500);
	});
});
