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
} from "./setup.dbtest";

// MED-003: validar mapa e relatorio contra itens de orcamento. Fluxo real:
// obra desbloqueada com orcamento (item 100 m2 x 1000 = 100000), medicao
// fisica via API, mapa e relatorios refletem orcado/medido/acumulado/saldo.

let workId = "";
let stageId = "";
let itemId = "";

type MapItem = {
	id?: string;
	measuredCurrent?: { value?: number; percentage?: number };
	measuredAccumulated?: { value?: number; percentage?: number };
	balanceToMeasure?: { value?: number };
	children?: MapItem[];
};

function findNode(items: MapItem[], id: string): MapItem | undefined {
	for (const node of items) {
		if (node.id === id) return node;
		const found = findNode(node.children ?? [], id);
		if (found) return found;
	}
	return undefined;
}

async function createFixture() {
	const work = await prisma.constructionWork.create({
		data: {
			id: `e2e-work-med003`,
			ownerId: OWNER_A,
			code: "E2E-MED003",
			name: "Obra MED-003",
			costCenterId: CC_A,
			baseDate: new Date("2026-01-01"),
			plannedStart: new Date("2026-01-01"),
			plannedEnd: new Date("2026-12-31"),
			areaM2: 100,
		},
	});
	const importRow = await prisma.constructionImport.create({
		data: {
			id: "e2e-import-med003",
			ownerId: OWNER_A,
			workId: work.id,
			fileName: "med003.xlsx",
			sheetName: "med003.xlsx",
			rowCount: 2,
			importedSections: ["Orcamento"],
			status: "IMPORTED",
		},
	});
	await prisma.constructionWork.update({
		where: { id: work.id },
		data: { activeImportId: importRow.id },
	});
	const stage = await prisma.constructionBudgetItem.create({
		data: {
			id: "e2e-stage-med003",
			ownerId: OWNER_A,
			workId: work.id,
			importId: importRow.id,
			parentId: null,
			index: "1",
			type: "STAGE",
			description: "Etapa MED-003",
			totalCost: 100000,
			computedStatus: "NOT_STARTED",
			sortOrder: 1,
		},
	});
	const item = await prisma.constructionBudgetItem.create({
		data: {
			id: "e2e-item-med003",
			ownerId: OWNER_A,
			workId: work.id,
			importId: importRow.id,
			parentId: stage.id,
			index: "1.1",
			type: "ITEM",
			description: "Servico MED-003",
			unit: "m2",
			quantity: 100,
			unitCost: 1000,
			totalCost: 100000,
			computedStatus: "NOT_STARTED",
			sortOrder: 2,
		},
	});
	await ensureBudgetVersion(OWNER_A, work.id);
	return { work, stage, item };
}

describe("MED-003 - mapa e relatorio refletem itens de orcamento", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
		const fixture = await createFixture();
		workId = fixture.work.id;
		stageId = fixture.stage.id;
		itemId = fixture.item.id;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("mapa lista todos os itens de orcamento antes de qualquer medicao (saldo = orcado)", async () => {
		const response = await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements/map`,
		);
		const body = (await assertStatus(response, 200)) as {
			items?: MapItem[];
			totals?: { budgeted?: number; measured?: number; balance?: number };
		};

		const item = findNode(body.items ?? [], itemId);
		expect(item).toBeTruthy();
		expect(item?.measuredAccumulated?.value).toBe(0);
		expect(item?.measuredAccumulated?.percentage).toBe(0);
		expect(item?.balanceToMeasure?.value).toBe(100000);
		expect(body.totals?.budgeted).toBe(100000);
		expect(body.totals?.measured).toBe(0);
		expect(body.totals?.balance).toBe(100000);
	});

	it("medicao fisica via API atualiza o mapa (medido e saldo)", async () => {
		const response = await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements`,
			await jsonBody({
				number: 1,
				date: "2026-06-15",
				title: "Medicao MED-003",
				items: [{ budgetItemId: itemId, measuredQuantity: 25 }],
			}),
		);
		await assertStatus(response, 200);

		const mapResponse = await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements/map`,
		);
		const mapBody = (await assertStatus(mapResponse, 200)) as {
			items?: MapItem[];
			totals?: { budgeted?: number; measured?: number; balance?: number };
		};

		// 25 m2 x 1000 = 25000 medido; saldo 75000; percentual 25 pontos.
		const item = findNode(mapBody.items ?? [], itemId);
		expect(item?.measuredAccumulated?.value).toBe(25000);
		expect(item?.measuredAccumulated?.percentage).toBe(25);
		expect(item?.balanceToMeasure?.value).toBe(75000);
		expect(mapBody.totals?.measured).toBe(25000);
		expect(mapBody.totals?.balance).toBe(75000);
	});

	it("etapa agrega os valores dos filhos (orcado = soma dos filhos)", async () => {
		const response = await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements/map`,
		);
		const body = (await assertStatus(response, 200)) as {
			items?: MapItem[];
		};

		const stage = findNode(body.items ?? [], stageId);
		expect(stage).toBeTruthy();
		expect(stage?.children?.some((child) => child.id === itemId)).toBe(true);
		expect(stage?.measuredAccumulated?.value).toBe(25000);
	});

	it("relatorios de obra refletem itens de orcamento com orcado e medido", async () => {
		const response = await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements/reports`,
		);
		const body = (await assertStatus(response, 200)) as {
			measurementByStage?: Array<{
				stage?: string;
				budgeted?: number;
				measured?: number;
				percentage?: number;
			}>;
		};

		const stage = body.measurementByStage?.find(
			(entry) => entry.stage === "Etapa MED-003",
		);
		expect(stage).toBeTruthy();
		expect(stage?.budgeted).toBe(100000);
		expect(stage?.measured).toBe(25000);
		expect(stage?.percentage).toBe(0.25);
	});

	it("relatorio individual da medicao referencia item do orcamento com valores", async () => {
		const measurement = await prisma.workMeasurement.findFirst({
			where: { workId },
		});
		expect(measurement).toBeTruthy();

		const response = await api(
			OWNER_A,
			`/construction/works/${workId}/work-measurements/${measurement?.id}/report`,
		);
		const body = (await assertStatus(response, 200)) as {
			measurement?: { totalMeasuredValue?: number };
			items?: Array<{ id?: string; measuredAccumulated?: { value?: number } }>;
		};

		expect(body.measurement?.totalMeasuredValue).toBe(25000);
		const item = findNode((body.items as unknown as MapItem[]) ?? [], itemId);
		expect(item).toBeTruthy();
		expect(item?.measuredAccumulated?.value).toBe(25000);
	});
});
