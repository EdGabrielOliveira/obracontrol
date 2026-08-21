import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { ObjectStorage } from "./object-storage";

export function createLocalObjectStorage(directory: string): ObjectStorage {
	function resolvePath(key: string): string {
		const parts = key.split("/");
		if (
			!key ||
			parts.some(
				(part) =>
					!part || part === "." || part === ".." || basename(part) !== part,
			)
		) {
			throw new Error(`storage key invalida: ${key}`);
		}
		return join(directory, ...parts);
	}

	return {
		async put(key, bytes) {
			const path = resolvePath(key);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, bytes);
		},
		async get(key) {
			try {
				return new Uint8Array(await readFile(resolvePath(key)));
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
				throw error;
			}
		},
		async delete(key) {
			await rm(resolvePath(key), { force: true });
		},
	};
}
