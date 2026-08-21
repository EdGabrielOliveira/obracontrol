import { AsyncLocalStorage } from "node:async_hooks";

export type ObjectStorage = {
	put(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
	get(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
};

function validateKey(key: string): void {
	if (!key || key.startsWith("/") || key.includes("..")) {
		throw new Error(`storage key invalida: ${key}`);
	}
}

class MemoryObjectStorage implements ObjectStorage {
	private readonly values = new Map<string, Uint8Array>();

	async put(key: string, bytes: Uint8Array): Promise<void> {
		validateKey(key);
		this.values.set(key, new Uint8Array(bytes));
	}

	async get(key: string): Promise<Uint8Array | null> {
		validateKey(key);
		const value = this.values.get(key);
		return value ? new Uint8Array(value) : null;
	}

	async delete(key: string): Promise<void> {
		validateKey(key);
		this.values.delete(key);
	}
}

const objectStorageContext = new AsyncLocalStorage<ObjectStorage>();
let configuredStorage: ObjectStorage = new MemoryObjectStorage();

function getActiveStorage(): ObjectStorage {
	return objectStorageContext.getStore() ?? configuredStorage;
}

export function runWithObjectStorage<T>(
	storage: ObjectStorage,
	callback: () => T,
): T {
	return objectStorageContext.run(storage, callback);
}

export function configureObjectStorage(storage: ObjectStorage): void {
	configuredStorage = storage;
}

export const objectStorage: ObjectStorage = {
	put: (...args) => getActiveStorage().put(...args),
	get: (...args) => getActiveStorage().get(...args),
	delete: (...args) => getActiveStorage().delete(...args),
};
