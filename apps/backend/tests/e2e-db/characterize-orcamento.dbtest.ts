import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	api,
	jsonBody,
	OWNER_A,
	resetAndSeedDatabase,
	WORK_A,
	WORK_B,
} from "./setup.dbtest";

// Caracterizacao (Fase 2 - Orcamento e Planejamento): estes testes registram
// o comportamento ATUAL da arvore de orcamento e das versoes (baseline de
// cronograma e replanejamento) antes da implementacao do plano. Servem como
// base para os testes de regressao das tasks 2-6.

const IMPORT_A2 = "e2e-import-a2";
const IMPORT_A3 = "e2e-import-a3";
const ITEM_A1 = "e2e-item-a1";
const WM_A1 = "e2e-wm-a1";

describe("ORC - caracterizacao da arvore e versoes atuais", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("mantem multiplas importacoes na obra com somente a ativa apontada", async () => {
		await prisma.constructionImport.create({
			data: {
				id: IMPORT_A2,
				ownerId: OWNER_A,
				workId: WORK_A,
				fileName: "orc-a-v1.xlsx",
				sheetName: "orc-a-v1.xlsx",
				rowCount: 1,
				importedSections: ["Orcamento"],
				status: "IMPORTED",
			},
		});
		await prisma.constructionImport.create({
			data: {
				id: IMPORT_A3,
				ownerId: OWNER_A,
				workId: WORK_A,
				fileName: "orc-a-v2.xlsx",
				sheetName: "orc-a-v2.xlsx",
				rowCount: 1,
				importedSections: ["Orcamento"],
				status: "IMPORTED",
			},
		});

		const [count, work] = await Promise.all([
			prisma.constructionImport.count({
				where: { ownerId: OWNER_A, workId: WORK_A },
			}),
			prisma.constructionWork.findUnique({
				where: { id: WORK_A },
				select: { activeImportId: true },
			}),
		]);

		expect(count).toBeGreaterThanOrEqual(3);
		expect(work?.activeImportId).toBe("e2e-import-a");
	});

	it("regressao: recriar a baseline apaga revisoes e fatos vinculados a importacao", async () => {
		const baseline = await prisma.constructionBaselineSchedule.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_B,
				importId: IMPORT_A2,
				budgetItemId: ITEM_A1,
				index: "1.1",
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-03-31"),
				plannedWeight: 1,
			},
		});
		await prisma.constructionScheduleRevision.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_B,
				importId: IMPORT_A2,
				budgetItemId: ITEM_A1,
				rowNumber: null,
				index: "1.1",
				version: "R1",
				replannedStart: new Date("2026-03-01"),
				replannedEnd: new Date("2026-06-30"),
				revisionDate: new Date("2026-02-15"),
				reason: "Replanejamento caracterizacao",
				createdBy: OWNER_A,
			},
		});

		// A rota de recriacao da baseline (createSchedule) faz deleteMany por
		// importId ATIVO e cria de novo: revisoes de outras importacoes
		// permanecem no historico (nao sao apagadas).
		const response = await api(
			OWNER_A,
			`/construction/works/${WORK_B}/schedule`,
			await jsonBody({
				items: [
					{
						index: "1.1",
						plannedStart: "2026-02-01",
						plannedEnd: "2026-04-30",
						plannedWeight: 1,
					},
				],
			}),
		);

		const [baselines, revisions] = await Promise.all([
			prisma.constructionBaselineSchedule.findMany({
				where: { ownerId: OWNER_A, workId: WORK_B, importId: IMPORT_A2 },
			}),
			prisma.constructionScheduleRevision.findMany({
				where: { ownerId: OWNER_A, workId: WORK_B, importId: IMPORT_A2 },
			}),
		]);

		expect(baseline.id).toBeTruthy();
		expect(response.status).toBe(200);
		// Baselines/revisoes de outras importacoes permanecem (historico);
		// o deleteMany so atinge a importacao ativa.
		expect(baselines.length).toBe(1);
		expect(revisions.length).toBe(1);
	});

	it("replanejamento adiciona versao nova contando revisoes da importacao ativa", async () => {
		// A versao e calculada sobre as revisoes da importacao ATIVA
		// (resolveActiveImportId do WORK_B e IMPORT_B); revisoes de outras
		// importacoes nao contam para o proximo numero de versao.
		const revision = await prisma.constructionScheduleRevision.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_B,
				importId: "e2e-import-b",
				budgetItemId: ITEM_A1,
				rowNumber: null,
				index: "1.1",
				version: "R1",
				replannedStart: new Date("2026-03-01"),
				replannedEnd: new Date("2026-06-30"),
				revisionDate: new Date("2026-02-15"),
				reason: "Replanejamento caracterizacao",
				createdBy: OWNER_A,
			},
		});

		// addScheduleRevision adiciona sem apagar o historico (o deleteMany
		// so ocorre no import de replanejamento).
		const response = await api(
			OWNER_A,
			`/construction/works/${WORK_B}/schedule/revisions`,
			await jsonBody({
				index: "1.1",
				replannedStart: "2026-04-01",
				replannedEnd: "2026-07-31",
				revisionDate: "2026-03-01",
				reason: "Nova revisao",
			}),
		);

		const stored = await prisma.constructionScheduleRevision.findMany({
			where: { ownerId: OWNER_A, workId: WORK_B },
		});
		expect(revision.id).toBeTruthy();
		expect(response.status).toBe(200);
		expect(stored.some((row) => row.version === "R2")).toBe(true);
	});
	it("regressao: excluir item de orcamento cascata fatos de medicao (perda silenciosa)", async () => {
		const measurementItemsBefore = await prisma.workMeasurementItem.count({
			where: { budgetItemId: ITEM_A1 },
		});
		expect(measurementItemsBefore).toBeGreaterThan(0);

		// Exclusao direta (fora da governanca) revela a FK onDelete: Cascade:
		// a medicao vinculada e apagada junto, sem bloqueio nem aviso.
		await prisma.constructionBudgetItem.delete({
			where: { id: ITEM_A1 },
		});

		const [item, measurementItemsAfter, measurement] = await Promise.all([
			prisma.constructionBudgetItem.findUnique({ where: { id: ITEM_A1 } }),
			prisma.workMeasurementItem.count({
				where: { budgetItemId: ITEM_A1 },
			}),
			prisma.workMeasurement.findUnique({ where: { id: WM_A1 } }),
		]);

		expect(item).toBeNull();
		expect(measurementItemsAfter).toBe(0);
		expect(measurement).not.toBeNull();
	});

	it("ACE-009: replanejamento sem mudanca de valor nao cria versao de orcamento", async () => {
		const versionsBefore = await prisma.budgetVersion.count({
			where: { workId: WORK_B },
		});

		const response = await api(
			OWNER_A,
			`/construction/works/${WORK_B}/schedule/revisions`,
			await jsonBody({
				index: "1.1",
				replannedStart: "2026-04-01",
				replannedEnd: "2026-07-31",
				revisionDate: "2026-03-01",
				reason: "Deslocamento sem mudanca de valor",
			}),
		);

		const versionsAfter = await prisma.budgetVersion.count({
			where: { workId: WORK_B },
		});

		expect(response.status).toBe(200);
		expect(versionsAfter).toBe(versionsBefore);
	});
});
