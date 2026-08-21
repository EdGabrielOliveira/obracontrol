import * as XLSX from "xlsx";
import { ConstructionError } from "../../../lib/errors";
import { type ImportStorage, importStorage } from "../../../lib/import-storage";

const MB = 1024 * 1024;

export type ImportMemoryBudget = {
	maxHeapMb: number;

	maxParseDeltaMb: number;

	maxFileMb: number;
};

export const DEFAULT_IMPORT_MEMORY_BUDGET: ImportMemoryBudget = {
	maxHeapMb: 256,
	maxParseDeltaMb: 192,
	maxFileMb: 25,
};

export type ImportRawRow = {
	sheet: string;
	rowNumber: number;
	values: unknown[];
};

export type MemoryChecker = (limits: ImportMemoryBudget) => Promise<void>;

export class ImportParseSemaphore {
	private busy = false;
	private readonly waiters: Array<() => void> = [];

	async acquire(): Promise<void> {
		if (!this.busy) {
			this.busy = true;
			return;
		}
		await new Promise<void>((resolve) => this.waiters.push(resolve));
	}

	release(): void {
		const next = this.waiters.shift();
		if (next) {
			next();
			return;
		}
		this.busy = false;
	}
}

export const importParseSemaphore = new ImportParseSemaphore();

export function defaultMemoryChecker(): MemoryChecker {
	let baselineHeap: number | null = null;
	return async (limits) => {
		const heap = process.memoryUsage().heapUsed;
		if (baselineHeap === null) baselineHeap = heap;
		const delta = heap - baselineHeap;
		if (heap > limits.maxHeapMb * MB || delta > limits.maxParseDeltaMb * MB) {
			throw new ConstructionError(
				"IMPORT_MEMORY_LIMIT_EXCEEDED",
				"Importacao excede o limite de memoria do processo",
				422,
			);
		}
	};
}

export type ImportParserOptions = {
	storage?: ImportStorage;
	memoryChecker?: MemoryChecker;
};

export function createImportParser(options: ImportParserOptions = {}): {
	rows(
		storageKey: string,
		limits: ImportMemoryBudget,
	): AsyncIterable<ImportRawRow>;
} {
	const storage = options.storage ?? importStorage;
	const memoryChecker = options.memoryChecker ?? defaultMemoryChecker();

	return {
		async *rows(storageKey, limits) {
			const buffer = await readAllChunks(storage, storageKey);
			if (buffer.byteLength > limits.maxFileMb * MB) {
				throw new ConstructionError(
					"IMPORT_FILE_TOO_LARGE",
					`Arquivo excede o limite de tamanho de ${limits.maxFileMb} MB`,
					413,
				);
			}

			await importParseSemaphore.acquire();
			try {
				const workbook = XLSX.read(buffer, { type: "buffer" });
				for (const sheetName of workbook.SheetNames) {
					await memoryChecker(limits);
					const sheet = workbook.Sheets[sheetName];
					const rows = XLSX.utils.sheet_to_json(sheet, {
						header: 1,
						raw: true,
						defval: null,
						blankrows: false,
					}) as unknown[][];
					for (const [index, row] of rows.entries()) {
						if (index === 0) continue;
						if (isEmptyRow(row)) continue;
						yield { sheet: sheetName, rowNumber: index + 1, values: row };
					}
				}
			} finally {
				importParseSemaphore.release();
			}
		},
	};
}

export const importParser = createImportParser();

async function readAllChunks(
	storage: ImportStorage,
	storageKey: string,
): Promise<Uint8Array> {
	const parts: Uint8Array[] = [];
	let total = 0;
	for await (const part of storage.chunks(storageKey)) {
		parts.push(part);
		total += part.length;
	}
	const joined = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.length;
	}
	return joined;
}

function isEmptyRow(row: unknown[]): boolean {
	return row.every(
		(cell) => cell === null || cell === undefined || cell === "",
	);
}
