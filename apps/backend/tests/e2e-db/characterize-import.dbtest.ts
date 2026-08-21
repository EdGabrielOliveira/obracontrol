import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import * as XLSX from "xlsx";
import { prisma } from "../../src/lib/prisma";
import { resetRateLimitStores } from "../../src/lib/rate-limit-store";
import {
	api,
	assertStatus,
	jsonBody,
	OWNER_A,
	resetAndSeedDatabase,
	WORK_A,
} from "./setup.dbtest";

// Caracterizacao do Plano 5 (Excel transacional): staging em ImportBatch/
// ImportRow com SHA-256, preview paginado, confirmacao atomica e
// reprocessamento. Testes que esperam o comportamento-alvo falham agora e
// passam apos XLS-001..004.

function workbookBytes(sheets: Record<string, unknown[][]>): Uint8Array {
	const wb = XLSX.utils.book_new();
	for (const [name, rows] of Object.entries(sheets)) {
		XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
	}
	return new Uint8Array(
		XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
	) as Uint8Array;
}

function obraCompletaBytes(
	options: { invalidRow?: boolean; code?: string } = {},
): Uint8Array {
	const custosRows: unknown[][] = [
		[
			"Data do lançamento",
			"Índice apropriado",
			"Categoria",
			"Descrição",
			"Valor realizado",
			"Tipo",
			"Documento origem",
		],
		["2026-01-10", "1.1", "MATERIAL", "Cimento", 500, "Atual", "NF-001"],
	];
	if (options.invalidRow) {
		custosRows.push([
			"2026-01-11",
			"9.9",
			"MATERIAL",
			"Sem indice",
			100,
			"Atual",
			"NF-002",
		]);
	}
	return workbookBytes({
		Obra: [
			["Campo", "Valor"],
			["Código da obra", options.code ?? "XLS-OBRA"],
			["Nome da obra", "Obra XLS"],
			["Cliente/Empreendimento", "Cliente XLS"],
			["Data base", "2026-01-01"],
			["Início planejado original", "2026-01-01"],
			["Fim planejado original", "2026-12-31"],
			["Área m²", 500],
		],
		Orçamento: [
			["Índice", "Tipo", "Descrição", "Unidade", "Quantidade"],
			["1.1", "ITEM", "Serviço XLS", "m2", 100],
		],
		"Cronograma Original": [
			["Índice", "Início previsto", "Fim previsto"],
			["1.1", "2026-01-01", "2026-12-31"],
		],
		Replanejamento: [
			["Índice", "Versão do replanejamento", "Início replanejado"],
		],
		"Medições Obra": [["Índice", "Data da medição"]],
		"Custos Realizados": custosRows,
	});
}

async function uploadBatch(
	bytes: Uint8Array,
	fileName: string,
	extra: Record<string, string> = {},
) {
	const form = new FormData();
	form.append(
		"file",
		new File([new Uint8Array(bytes)], fileName, {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		}),
	);
	for (const [key, value] of Object.entries(extra)) {
		form.append(key, value);
	}
	return api(OWNER_A, `/construction/works/${WORK_A}/import-batches`, {
		method: "POST",
		body: form,
	});
}

describe("XLS - caracterizacao do excel transacional", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	beforeEach(() => {
		resetRateLimitStores();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("XLS-001: upload cria batch READY com sha256, resumo e linhas por planilha", async () => {
		const response = await uploadBatch(obraCompletaBytes(), "obra-1.xlsx");
		const body = await assertStatus(response, 201);

		expect((body as { batchId?: string }).batchId).toBeTruthy();
		expect((body as { fileSha256?: string }).fileSha256).toMatch(
			/^[0-9a-f]{64}$/,
		);

		const batch = await prisma.importBatch.findUnique({
			where: { id: String((body as { batchId?: string }).batchId) },
		});
		expect(batch?.status).toBe("READY");
		expect(batch?.fileName).toBe("obra-1.xlsx");
		expect(batch?.rowCount).toBeGreaterThan(0);
		expect(batch?.validCount).toBeGreaterThan(0);
		expect(batch?.expiresAt.getTime()).toBeGreaterThan(Date.now());

		const rows = await prisma.importRow.findMany({
			where: { batchId: batch?.id },
			orderBy: [{ sheet: "asc" }, { rowNumber: "asc" }],
		});
		expect(rows.length).toBe(batch?.rowCount ?? 0);
		expect(new Set(rows.map((row) => row.sheet))).toContain(
			"Custos Realizados",
		);
		expect(rows.every((row) => row.status === "VALID")).toBe(true);
	});

	it("XLS-001: arquivo repetido (mesmo sha256) e rejeitado com 409 IMPORT_FILE_DUPLICATE", async () => {
		const bytes = obraCompletaBytes({ code: "XLS-REPETIDO" });
		const first = await uploadBatch(bytes, "repetido.xlsx");
		await assertStatus(first, 201);

		const second = await uploadBatch(bytes, "repetido.xlsx");
		const body = await assertStatus(second, 409);
		expect((body as { message?: string }).message).toContain(
			"arquivo ja foi importado",
		);
	});

	it("XLS-001: workbook com mais de 20 planilhas e rejeitado (422)", async () => {
		const sheets: Record<string, unknown[][]> = {};
		for (let index = 0; index < 21; index++) {
			sheets[`Aba ${index}`] = [
				["A", "B"],
				["1", "2"],
			];
		}
		const response = await uploadBatch(
			workbookBytes(sheets),
			"muitas-abas.xlsx",
		);
		const body = await assertStatus(response, 422);
		expect((body as { message?: string }).message).toContain("planilhas");
	});

	it("XLS-002: preview pagina retorna no maximo 500 linhas e pagina 2 consulta o staging", async () => {
		const custosRows: unknown[][] = [
			[
				"Data do lançamento",
				"Índice apropriado",
				"Categoria",
				"Descrição",
				"Valor realizado",
				"Tipo",
				"Documento origem",
			],
		];
		for (let index = 0; index < 620; index++) {
			custosRows.push([
				`2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
				"1.1",
				"MATERIAL",
				`Custo ${index}`,
				index + 1,
				"Atual",
				`NF-${index}`,
			]);
		}
		const bytes = workbookBytes({
			Obra: [
				["Campo", "Valor"],
				["Código da obra", "XLS-PAGINA"],
			],
			Orçamento: [
				["Índice", "Tipo", "Descrição"],
				["1.1", "ITEM", "Item"],
			],
			"Cronograma Original": [["Índice", "Início previsto", "Fim previsto"]],
			Replanejamento: [["Índice", "Versão"]],
			"Medições Obra": [["Índice", "Data da medição"]],
			"Custos Realizados": custosRows,
		});
		const uploadResponse = await uploadBatch(bytes, "paginas.xlsx");
		const uploadBody = await assertStatus(uploadResponse, 201);
		const batchId = String((uploadBody as { batchId?: string }).batchId);

		const page1Response = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}?page=1&pageSize=500`,
		);
		const page1 = await assertStatus(page1Response, 200);
		expect((page1.rows as unknown[]).length).toBe(500);
		expect((page1.summary as { total?: number }).total ?? 0).toBeGreaterThan(
			500,
		);

		const page2Response = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}?page=2&pageSize=500`,
		);
		const page2 = await assertStatus(page2Response, 200);
		expect((page2.rows as unknown[]).length).toBeGreaterThan(0);
		expect((page2.rows as unknown[]).length).toBeLessThanOrEqual(500);
	});

	it("XLS-002: preview com linha invalida marca INVALID com issues e nao cria dados operacionais", async () => {
		const workCountBefore = await prisma.constructionWork.count();
		const importsBefore = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		const response = await uploadBatch(
			obraCompletaBytes({ invalidRow: true, code: "XLS-INVALIDA" }),
			"invalida.xlsx",
		);
		const body = await assertStatus(response, 201);

		const batchId = String((body as { batchId?: string }).batchId);
		const invalidRows = await prisma.importRow.findMany({
			where: { batchId, status: "INVALID" },
		});
		expect(invalidRows.length).toBeGreaterThan(0);
		expect(
			(invalidRows[0].issues as Array<{ code: string }>)[0]?.code,
		).toBeTruthy();

		const workCount = await prisma.constructionWork.count();
		expect(workCount).toBe(workCountBefore);
		const imports = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		expect(imports).toBe(importsBefore);
	});

	it("XLS-002: upload VALIDO no staging nao cria dados operacionais antes da confirmacao", async () => {
		const workCountBefore = await prisma.constructionWork.count();
		const importsBefore = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		const budgetItemsBefore = await prisma.constructionBudgetItem.count();

		const response = await uploadBatch(
			obraCompletaBytes({ code: "XLS-STAGING-ONLY" }),
			"staging-only.xlsx",
		);
		const body = await assertStatus(response, 201);
		expect(String((body as { batchId?: string }).batchId)).toBeTruthy();

		// Apenas staging (ImportBatch/ImportRow) existe; obra, import e itens
		// de orcamento nao foram criados.
		const workCount = await prisma.constructionWork.count();
		expect(workCount).toBe(workCountBefore);
		const imports = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		expect(imports).toBe(importsBefore);
		const budgetItems = await prisma.constructionBudgetItem.count();
		expect(budgetItems).toBe(budgetItemsBefore);
	});

	async function uploadAndConfirmAll(bytes: Uint8Array, fileName: string) {
		const uploadResponse = await uploadBatch(bytes, fileName);
		const uploadBody = await assertStatus(uploadResponse, 201);
		const batchId = String((uploadBody as { batchId?: string }).batchId);
		const pageResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}?page=1&pageSize=500`,
		);
		const page = await assertStatus(pageResponse, 200);
		const rowIds = (page.rows as Array<{ id: string; status: string }>)
			.filter((row) => row.status === "VALID" || row.status === "WARNING")
			.map((row) => row.id);
		const confirmResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}/confirm`,
			await jsonBody({
				expectedBatchVersion: (page as { batchVersion?: number }).batchVersion,
				selectedRowIds: rowIds,
				idempotencyKey: `key-${fileName}`,
			}),
		);
		return { batchId, confirmResponse, page };
	}

	it("XLS-003: confirmacao cria dados operacionais de forma atomica e idempotente", async () => {
		const importsBefore = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		const { batchId, confirmResponse } = await uploadAndConfirmAll(
			obraCompletaBytes({ code: "XLS-CONFIRMA" }),
			"confirma.xlsx",
		);
		const body = await assertStatus(confirmResponse, 200);
		expect((body as { status?: string }).status).toBe("APPROVED");
		expect((body as { importId?: string | null }).importId).toBeTruthy();

		const batch = await prisma.importBatch.findUnique({
			where: { id: batchId },
		});
		expect(batch?.status).toBe("CONFIRMED");
		expect(batch?.confirmedImportId).toBe(
			(body as { importId?: string }).importId,
		);
		expect(batch?.confirmedAt).toBeTruthy();

		const imports = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		expect(imports).toBe(importsBefore + 1);

		const confirmAgain = await uploadBatch(
			obraCompletaBytes({ code: "XLS-CONFIRMA" }),
			"confirma.xlsx",
		);
		await assertStatus(confirmAgain, 409);
	});

	it("XLS-003: confirmacao com versao divergente retorna 409 IMPORT_BATCH_CONFLICT", async () => {
		const uploadResponse = await uploadBatch(
			obraCompletaBytes({ code: "XLS-VERSAO" }),
			"versao.xlsx",
		);
		const uploadBody = await assertStatus(uploadResponse, 201);
		const batchId = String((uploadBody as { batchId?: string }).batchId);
		const pageResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}?page=1&pageSize=500`,
		);
		const page = await assertStatus(pageResponse, 200);
		const rowIds = (page.rows as Array<{ id: string }>).map((row) => row.id);

		const confirmResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}/confirm`,
			await jsonBody({
				expectedBatchVersion: 999,
				selectedRowIds: rowIds,
				idempotencyKey: "key-versao",
			}),
		);
		const body = await assertStatus(confirmResponse, 409);
		expect((body as { message?: string }).message).toContain("Versao do lote");
	});

	it("XLS-003: selecao com linha invalida e recusada (422) e nada operacional muda", async () => {
		const importsBefore = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		const uploadResponse = await uploadBatch(
			obraCompletaBytes({ invalidRow: true, code: "XLS-SELECAO" }),
			"selecao.xlsx",
		);
		const uploadBody = await assertStatus(uploadResponse, 201);
		const batchId = String((uploadBody as { batchId?: string }).batchId);
		const pageResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}?page=1&pageSize=500`,
		);
		const page = await assertStatus(pageResponse, 200);
		const invalidRow = (
			page.rows as Array<{ id: string; status: string }>
		).find((row) => row.status === "INVALID");
		expect(invalidRow).toBeTruthy();

		const confirmResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}/confirm`,
			await jsonBody({
				expectedBatchVersion: (page as { batchVersion?: number }).batchVersion,
				selectedRowIds: [String(invalidRow?.id)],
				idempotencyKey: "key-selecao",
			}),
		);
		await assertStatus(confirmResponse, 422);

		const imports = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		expect(imports).toBe(importsBefore);
	});

	it("XLS-003: falha na aplicacao faz rollback total (lote segue READY, sem dados)", async () => {
		const importsBefore = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		const bytes = workbookBytes({
			Obra: [
				["Campo", "Valor"],
				["Nome da obra", "Sem codigo"],
			],
			Orçamento: [
				["Índice", "Tipo", "Descrição"],
				["1.1", "ITEM", "Item sem obra"],
			],
			"Cronograma Original": [["Índice", "Início previsto", "Fim previsto"]],
			Replanejamento: [["Índice", "Versão"]],
			"Medições Obra": [["Índice", "Data da medição"]],
			"Custos Realizados": [["Data", "Valor"]],
		});
		const uploadResponse = await uploadBatch(bytes, "rollback.xlsx");
		const uploadBody = await assertStatus(uploadResponse, 201);
		const batchId = String((uploadBody as { batchId?: string }).batchId);
		const pageResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}?page=1&pageSize=500`,
		);
		const page = await assertStatus(pageResponse, 200);
		const rowIds = (page.rows as Array<{ id: string }>).map((row) => row.id);

		const confirmResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}/confirm`,
			await jsonBody({
				expectedBatchVersion: (page as { batchVersion?: number }).batchVersion,
				selectedRowIds: rowIds,
				idempotencyKey: "key-rollback",
			}),
		);
		expect(confirmResponse.status).toBeGreaterThanOrEqual(400);

		const batch = await prisma.importBatch.findUnique({
			where: { id: batchId },
		});
		expect(batch?.status).toBe("READY");
		const imports = await prisma.constructionImport.count({
			where: { ownerId: OWNER_A },
		});
		expect(imports).toBe(importsBefore);
	});

	it("XLS-004: reprocessamento exige motivo e reprocessOfId da mesma obra; cadeia preserva lote anterior", async () => {
		const { batchId } = await uploadAndConfirmAll(
			obraCompletaBytes({ code: "XLS-REPROC" }),
			"reproc-1.xlsx",
		);
		const originalBatch = await prisma.importBatch.findUnique({
			where: { id: batchId },
		});
		const originalImportId = originalBatch?.confirmedImportId;
		expect(originalImportId).toBeTruthy();

		const semMotivo = await uploadBatch(
			obraCompletaBytes({ code: "XLS-REPROC" }),
			"reproc-2.xlsx",
			{ reprocessOfId: String(originalImportId) },
		);
		const semMotivoBody = await assertStatus(semMotivo, 422);
		expect((semMotivoBody as { message?: string }).message).toContain("Motivo");

		const reprocessamento = await uploadBatch(
			obraCompletaBytes({ code: "XLS-REPROC" }),
			"reproc-2.xlsx",
			{
				reprocessOfId: String(originalImportId),
				reason: "Revisao de escopo",
			},
		);
		const reprocessBody = await assertStatus(reprocessamento, 201);
		const reprocessBatchId = String(
			(reprocessBody as { batchId?: string }).batchId,
		);

		const reprocessBatch = await prisma.importBatch.findUnique({
			where: { id: reprocessBatchId },
		});
		expect(reprocessBatch?.reprocessOfId).toBe(originalImportId);
		expect(reprocessBatch?.status).toBe("READY");

		const pageResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${reprocessBatchId}?page=1&pageSize=500`,
		);
		const page = await assertStatus(pageResponse, 200);
		const rowIds = (page.rows as Array<{ id: string }>).map((row) => row.id);
		const confirmResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${reprocessBatchId}/confirm`,
			await jsonBody({
				expectedBatchVersion: (page as { batchVersion?: number }).batchVersion,
				selectedRowIds: rowIds,
				idempotencyKey: "key-reproc",
			}),
		);
		const confirmBody = await assertStatus(confirmResponse, 200);
		expect((confirmBody as { status?: string }).status).toBe("APPROVED");

		const confirmedImport = await prisma.constructionImport.findUnique({
			where: {
				id: String((confirmBody as { importId?: string }).importId),
			},
		});
		expect(confirmedImport?.reprocessOfId).toBe(originalImportId);
		expect(confirmedImport?.status).toBe("IMPORTED");

		const originalStillThere = await prisma.importBatch.findUnique({
			where: { id: batchId },
		});
		expect(originalStillThere?.status).toBe("CONFIRMED");
	});

	it("XLS-004: reprocessOfId de outra obra e recusado (422)", async () => {
		const response = await uploadBatch(
			obraCompletaBytes({ code: "XLS-OUTRA" }),
			"outra.xlsx",
			{ reprocessOfId: "import-inexistente", reason: "Motivo" },
		);
		const body = await assertStatus(response, 422);
		expect((body as { message?: string }).message).toContain("reprocessamento");
	});

	it("XLS-004: listagem paginada de batches da obra", async () => {
		const listResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches?page=1&pageSize=10`,
		);
		const list = await assertStatus(listResponse, 200);
		expect(Array.isArray(list.data)).toBe(true);
		expect((list.data as unknown[]).length).toBeGreaterThan(0);
		expect((list as { total?: number }).total ?? 0).toBeGreaterThan(0);
	});

	it("XLS-004: export de rejeitados devolve XLSX com diagnostico", async () => {
		const uploadResponse = await uploadBatch(
			obraCompletaBytes({ invalidRow: true, code: "XLS-REJEITADOS" }),
			"rejeitados.xlsx",
		);
		const uploadBody = await assertStatus(uploadResponse, 201);
		const batchId = String((uploadBody as { batchId?: string }).batchId);

		const rejectedResponse = await api(
			OWNER_A,
			`/construction/works/${WORK_A}/import-batches/${batchId}/rejected`,
		);
		expect(rejectedResponse.status).toBe(200);
		const bytes = new Uint8Array(await rejectedResponse.arrayBuffer());
		const workbook = XLSX.read(bytes, { type: "buffer" });
		const sheetNames = workbook.SheetNames;
		expect(sheetNames.length).toBeGreaterThan(0);
		const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]], {
			header: 1,
		}) as unknown[][];
		const flattened = sheetRows.flat().map((value) => String(value));
		expect(flattened.some((value) => value.includes("NF-002"))).toBe(true);
	});
});

void jsonBody;
