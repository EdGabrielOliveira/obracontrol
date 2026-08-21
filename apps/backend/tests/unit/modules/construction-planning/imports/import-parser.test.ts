import { describe, expect, it, mock } from "bun:test";
import * as XLSX from "xlsx";
import { createImportStorage } from "../../../../../src/lib/import-storage";
import {
	createImportParser,
	type ImportMemoryBudget,
	type MemoryChecker,
} from "../../../../../src/modules/construction-planning/imports/import-parser";

function workbookBytes(sheets: Record<string, unknown[][]>): Uint8Array {
	const wb = XLSX.utils.book_new();
	for (const [name, rows] of Object.entries(sheets)) {
		XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
	}
	return new Uint8Array(
		XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
	) as Uint8Array;
}

const DEFAULT_LIMITS: ImportMemoryBudget = {
	maxHeapMb: 256,
	maxParseDeltaMb: 192,
	maxFileMb: 25,
};

describe("import-parser", () => {
	it("emite linhas por planilha, na ordem das planilhas e com rowNumber 1-based", async () => {
		const storage = createImportStorage({ directory: undefined });
		void storage;
		const parser = createImportParser({
			storage,
			memoryChecker: mock(async () => undefined),
		});
		const bytes = workbookBytes({
			Orcamento: [
				["Índice", "Descrição"],
				["1", "Serviço A"],
				["1.1", "Serviço B"],
			],
			"Custos Realizados": [
				["Data", "Valor"],
				["2026-01-10", 100],
			],
		});
		const { storageKey } = await storage.put(
			"batch-p1",
			(async function* () {
				yield bytes;
			})(),
			new Date(Date.now() + 60_000),
		);

		const rows: Array<{ sheet: string; rowNumber: number; values: unknown[] }> =
			[];
		for await (const row of parser.rows(storageKey, DEFAULT_LIMITS)) {
			rows.push(row as never);
		}

		expect(rows.map((row) => row.sheet)).toEqual([
			"Orcamento",
			"Orcamento",
			"Custos Realizados",
		]);
		expect(rows.map((row) => row.rowNumber)).toEqual([2, 3, 2]);
		expect(rows[0].values).toEqual(["1", "Serviço A"]);
	});

	it("aborta com IMPORT_MEMORY_LIMIT_EXCEEDED quando o heap excede o teto", async () => {
		const storage = createImportStorage({ directory: undefined });
		void storage;
		const parser = createImportParser({
			storage,
			memoryChecker: mock(async () => {
				throw new Error("heap acima do limite");
			}),
		});
		const bytes = workbookBytes({
			Obra: [
				["Campo", "Valor"],
				["Código da obra", "OBRA-1"],
			],
		});
		const { storageKey } = await storage.put(
			"batch-p2",
			(async function* () {
				yield bytes;
			})(),
			new Date(Date.now() + 60_000),
		);

		await expect(
			(async () => {
				for await (const _row of parser.rows(storageKey, DEFAULT_LIMITS)) {
					void _row;
				}
			})(),
		).rejects.toThrow("heap acima do limite");
	});

	it("rejeita arquivo acima do limite de tamanho antes de parsear", async () => {
		const storage = createImportStorage({ directory: undefined });
		void storage;
		const parser = createImportParser({
			storage,
			memoryChecker: mock(async () => undefined),
		});
		const big = new Uint8Array(2 * 1024 * 1024);
		const { storageKey } = await storage.put(
			"batch-p3",
			(async function* () {
				yield big;
			})(),
			new Date(Date.now() + 60_000),
		);

		await expect(
			(async () => {
				for await (const _row of parser.rows(storageKey, {
					...DEFAULT_LIMITS,
					maxFileMb: 1,
				})) {
					void _row;
				}
			})(),
		).rejects.toThrow("excede o limite de tamanho");
	});

	it("serializa parses com semaphore: um por vez no processo", async () => {
		const storage = createImportStorage({ directory: undefined });
		void storage;
		let concurrent = 0;
		let peak = 0;
		const memoryChecker: MemoryChecker = mock(async () => {
			concurrent += 1;
			peak = Math.max(peak, concurrent);
			await new Promise((resolve) => setTimeout(resolve, 10));
			concurrent -= 1;
		});
		const parser = createImportParser({ storage, memoryChecker });
		const bytes = workbookBytes({
			Obra: [
				["Campo", "Valor"],
				["Código da obra", "OBRA-1"],
			],
		});
		const { storageKey: keyA } = await storage.put(
			"batch-p4a",
			(async function* () {
				yield bytes;
			})(),
			new Date(Date.now() + 60_000),
		);
		const { storageKey: keyB } = await storage.put(
			"batch-p4b",
			(async function* () {
				yield bytes;
			})(),
			new Date(Date.now() + 60_000),
		);

		await Promise.all([
			(async () => {
				for await (const _row of parser.rows(keyA, DEFAULT_LIMITS)) {
					void _row;
				}
			})(),
			(async () => {
				for await (const _row of parser.rows(keyB, DEFAULT_LIMITS)) {
					void _row;
				}
			})(),
		]);

		expect(peak).toBe(1);
	});
});
