import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as XLSX from "xlsx";
import { TEST_OWNER, TEST_WORK_ID } from "./setup";

const getSessionUser = mock(async () => ({
	id: TEST_OWNER,
	email: "teste@obra.bi",
	name: "Usuario Teste",
	role: "GERENTE",
}));

mock.module("../../../src/lib/auth-middleware", () => ({ getSessionUser }));

const auditLogCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "audit-export-1",
		...args.data,
	}),
);

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		auditLog: { create: auditLogCreate },
		user: { findUnique: mock(async () => ({ role: "GERENTE" })) },
		constructionWork: {
			findUnique: mock(async () => ({
				id: TEST_WORK_ID,
				costCenterId: "cc-1",
			})),
		},
		costCenter: {
			findUnique: mock(async () => ({
				id: "cc-1",
				organizationId: "org-1",
			})),
		},
		organization: {
			findUnique: mock(async () => ({
				id: "org-1",
				ownerId: TEST_OWNER,
			})),
		},
		organizationMembership: {
			findMany: mock(async () => [{ organizationId: "org-1" }]),
		},
		costCenterMembership: {
			findMany: mock(async () => [{ costCenterId: "cc-1" }]),
		},
		workMembership: {
			findMany: mock(async () => []),
		},
	},
}));

const getBudgetItems = mock(
	async (): Promise<Array<Record<string, unknown>>> => [
		{
			index: "1.1",
			type: "ITEM",
			description: "Item E2E",
			unit: "m2",
			quantity: 100,
			unitCost: 50,
			totalCost: 5000,
			completionPercentage: 0.5,
			computedStatus: "IN_PROGRESS",
		},
	],
);
const getBudgetVersions = mock(async () => []);
const getBaselineSchedules = mock(async () => []);
const getMeasurements = mock(async () => []);
const getMeasurementsSimple = mock(async () => []);
const getActualCosts = mock(async () => []);
const getContracts = mock(async () => []);
const getContractsSimple = mock(async () => []);
const getWorkInfo = mock(
	async (): Promise<Record<string, unknown>> => ({
		code: "E2E-001",
		name: "Obra E2E Teste",
	}),
);
const resolveExportSource = mock(
	async (): Promise<Record<string, unknown>> => ({
		mode: "LIVE",
		persisted: null,
	}),
);

mock.module(
	"../../../src/modules/construction-planning/export.repository",
	() => ({
		getBudgetItemsForExport: getBudgetItems,
		getBudgetVersionsForExport: getBudgetVersions,
		getBaselineSchedulesForExport: getBaselineSchedules,
		getMeasurementsWithBudgetItemForExport: getMeasurements,
		getMeasurementsForExport: getMeasurementsSimple,
		getActualCostsForExport: getActualCosts,
		getContractsWithDetailsForExport: getContracts,
		getContractsSimpleForExport: getContractsSimple,
		getWorkInfoForExport: getWorkInfo,
		resolveExportSource,
	}),
);

async function exportRequest(path: string): Promise<Response> {
	const { constructionPlanningController } = await import(
		"../../../src/modules/construction-planning/routes"
	);
	return constructionPlanningController.handle(
		new Request(`http://localhost/construction${path}`),
	);
}

function metadadosValue(wb: XLSX.WorkBook, campo: string): string {
	const row = XLSX.utils
		.sheet_to_json<Record<string, string>>(wb.Sheets.Metadados)
		.find((r) => r.Campo === campo);
	return String(row?.Valor ?? "");
}

beforeEach(() => {
	getSessionUser.mockImplementation(async () => ({
		id: TEST_OWNER,
		email: "teste@obra.bi",
		name: "Usuario Teste",
		role: "GERENTE",
	}));
	resolveExportSource.mockImplementation(async () => ({
		mode: "LIVE",
		persisted: null,
	}));
	auditLogCreate.mockClear();
	getBudgetItems.mockClear();
	getBaselineSchedules.mockClear();
	getMeasurements.mockClear();
	getMeasurementsSimple.mockClear();
	getActualCosts.mockClear();
	getContracts.mockClear();
	getContractsSimple.mockClear();
	getWorkInfo.mockClear();
});

describe("Export E2E", () => {
	it("GET /works/:workId/export/orcamento - xlsx com Metadados e audit", async () => {
		const response = await exportRequest(
			`/works/${TEST_WORK_ID}/export/orcamento`,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("spreadsheetml");

		const wb = XLSX.read(await response.arrayBuffer(), { type: "array" });
		expect(wb.SheetNames).toContain("Metadados");
		expect(wb.SheetNames).toContain("Guia");
		expect(wb.SheetNames).toContain("Orcamento");
		expect(metadadosValue(wb, "Obra")).toBe("Obra E2E Teste");
		expect(metadadosValue(wb, "Codigo da Obra")).toBe("E2E-001");
		expect(metadadosValue(wb, "Fonte")).toBe("LIVE");
		expect(metadadosValue(wb, "Usuario ID")).toBe(TEST_OWNER);
		expect(metadadosValue(wb, "Usuario Nome")).toBe("Usuario Teste");

		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			wb.Sheets.Orcamento,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			Descrição: "Item E2E",
			Quantidade: 100,
			Tipo: "ITEM",
			Situação: "IN_PROGRESS",
		});

		expect(auditLogCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					action: "EXPORT",
					entityType: "EXPORT",
					entityId: TEST_WORK_ID,
					newState: expect.objectContaining({
						kind: "orcamento",
						sourceMode: "LIVE",
						fileName: "orcamento.xlsx",
					}),
				}),
			}),
		);
	});

	it("GET export/cronograma foi removido em favor do workbook completo", async () => {
		const response = await exportRequest(
			`/works/${TEST_WORK_ID}/export/cronograma?asOfDate=2026-01-15`,
		);

		expect(response.status).toBe(404);
	});

	it("GET export/orcamento com formato invalido - 400", async () => {
		const response = await exportRequest(
			`/works/${TEST_WORK_ID}/export/orcamento?asOfDate=01/01/2026`,
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toContain("Formato de data invalido");
	});

	it("GET export/orcamento com data de corte futura - 422", async () => {
		const tomorrow = new Date(Date.now() + 86_400_000)
			.toISOString()
			.slice(0, 10);

		const response = await exportRequest(
			`/works/${TEST_WORK_ID}/export/orcamento?asOfDate=${tomorrow}`,
		);

		expect(response.status).toBe(422);
		const body = await response.json();
		expect(body.message).toBe("Data de corte futura nao permitida");
	});

	it("SUPERVISOR consegue exportar (permicao de leitura)", async () => {
		getSessionUser.mockImplementation(async () => ({
			id: TEST_OWNER,
			email: "leitura@obra.bi",
			name: "Leitura",
			role: "SUPERVISOR",
		}));

		const response = await exportRequest(
			`/works/${TEST_WORK_ID}/export/orcamento`,
		);

		expect(response.status).toBe(200);
	});

	it("exporta sempre da fonte LIVE (fonte unica de exportacao)", async () => {
		resolveExportSource.mockImplementation(async () => ({
			mode: "LIVE",
			persisted: null,
		}));

		const response = await exportRequest(
			`/works/${TEST_WORK_ID}/export/orcamento`,
		);

		expect(response.status).toBe(200);
		const wb = XLSX.read(await response.arrayBuffer(), { type: "array" });
		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			wb.Sheets.Orcamento,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			Descrição: "Item E2E",
			Quantidade: 100,
		});
		expect(metadadosValue(wb, "Fonte")).toBe("LIVE");
	});
});
