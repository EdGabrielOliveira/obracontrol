import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";

export type ImportStorageOptions = {
	directory?: string;
};

export type StoredImportFile = {
	storageKey: string;
	sha256: string;
};

export type ImportStorage = {
	put(
		batchId: string,
		input: AsyncIterable<Uint8Array>,
		expiresAt: Date,
	): Promise<StoredImportFile>;
	chunks(storageKey: string): AsyncIterable<Uint8Array>;
	remove(storageKey: string): Promise<void>;
};

function resolveDirectory(options: ImportStorageOptions): string {
	return (
		options.directory ??
		process.env.IMPORT_TMP_DIR ??
		join(tmpdir(), "obracontrol-imports")
	);
}

export function createImportStorage(
	options: ImportStorageOptions = {},
): ImportStorage {
	function resolvePath(storageKey: string): string {
		const directory = resolveDirectory(options);
		const safeName = basename(storageKey);
		if (safeName !== storageKey || safeName === "." || safeName === "..") {
			throw new Error(`storageKey invalida: ${storageKey}`);
		}
		return join(directory, safeName);
	}

	return {
		async put(batchId, input, expiresAt) {
			void expiresAt;
			await mkdir(resolveDirectory(options), { recursive: true });
			const safeBatchId = basename(batchId);
			if (safeBatchId !== batchId) {
				throw new Error(`batchId invalida: ${batchId}`);
			}
			const storageKey = `${safeBatchId}.xlsx`;
			const hash = createHash("sha256");
			await pipeline(
				(async function* () {
					for await (const part of input) {
						hash.update(part);
						yield part;
					}
				})(),
				createWriteStream(resolvePath(storageKey)),
			);
			return { storageKey, sha256: hash.digest("hex") };
		},

		chunks(storageKey) {
			const path = resolvePath(storageKey);
			return {
				async *[Symbol.asyncIterator]() {
					const readStream = createReadStream(path, {
						highWaterMark: 64 * 1024,
					});
					try {
						for await (const part of readStream) {
							yield part as Uint8Array;
						}
					} finally {
						readStream.destroy();
					}
				},
			};
		},

		async remove(storageKey) {
			await rm(resolvePath(storageKey), { force: true });
		},
	};
}

const importStorageContext = new AsyncLocalStorage<ImportStorage>();
let configuredImportStorage: ImportStorage = createImportStorage();

function getActiveImportStorage(): ImportStorage {
	return importStorageContext.getStore() ?? configuredImportStorage;
}

export function runWithImportStorage<T>(
	storage: ImportStorage,
	callback: () => T,
): T {
	return importStorageContext.run(storage, callback);
}

export function configureImportStorage(storage: ImportStorage): void {
	configuredImportStorage = storage;
}

export const importStorage: ImportStorage = {
	put: (...args) => getActiveImportStorage().put(...args),
	chunks: (...args) => getActiveImportStorage().chunks(...args),
	remove: (...args) => getActiveImportStorage().remove(...args),
};
