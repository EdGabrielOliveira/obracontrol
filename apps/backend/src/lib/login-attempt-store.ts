export interface LoginAttemptRecord {
	count: number;
	allowed: boolean;
	retryAfter?: number;
}

export interface LoginAttemptPeek {
	count: number;
	retryAfter?: number;
}

export interface LoginAttemptStore {
	record(
		key: string,
		clientId: string,
		windowMs: number,
		max: number,
	): Promise<LoginAttemptRecord>;
	peek(
		key: string,
		clientId: string,
		windowMs: number,
	): Promise<LoginAttemptPeek>;
	clear(key: string, clientId: string): Promise<void>;
}

const stores = new Map<string, Map<string, number[]>>();

function getStore(key: string): Map<string, number[]> {
	let store = stores.get(key);
	if (!store) {
		store = new Map<string, number[]>();
		stores.set(key, store);
	}
	return store;
}

function pruneTimestamps(timestamps: number[], windowMs: number): number[] {
	const cutoff = Date.now() - windowMs;
	const firstValid = timestamps.findIndex((t) => t > cutoff);
	return firstValid === -1 ? [] : timestamps.slice(firstValid);
}

export class MemoryLoginAttemptStore implements LoginAttemptStore {
	async record(
		key: string,
		clientId: string,
		windowMs: number,
		max: number,
	): Promise<LoginAttemptRecord> {
		const store = getStore(key);
		const now = Date.now();
		const timestamps = pruneTimestamps(store.get(clientId) ?? [], windowMs);

		const oldest = timestamps[0];
		if (oldest !== undefined && timestamps.length >= max) {
			return {
				count: timestamps.length,
				allowed: false,
				retryAfter: Math.ceil((oldest + windowMs - now) / 1000),
			};
		}

		timestamps.push(now);
		store.set(clientId, timestamps);

		return {
			count: timestamps.length,
			allowed: true,
			retryAfter:
				oldest === undefined
					? undefined
					: Math.ceil((oldest + windowMs - now) / 1000),
		};
	}

	async peek(
		key: string,
		clientId: string,
		windowMs: number,
	): Promise<LoginAttemptPeek> {
		const store = getStore(key);
		const now = Date.now();
		const timestamps = pruneTimestamps(store.get(clientId) ?? [], windowMs);
		const oldest = timestamps[0];
		return {
			count: timestamps.length,
			retryAfter:
				oldest === undefined
					? undefined
					: Math.ceil((oldest + windowMs - now) / 1000),
		};
	}

	async clear(key: string, clientId: string): Promise<void> {
		const store = getStore(key);
		store.delete(clientId);
	}
}

setInterval(
	() => {
		const cutoff = Date.now() - 30 * 60 * 1000;
		for (const store of stores.values()) {
			for (const [clientId, timestamps] of store) {
				const pruned = timestamps.filter((t) => t > cutoff);
				if (pruned.length === 0) {
					store.delete(clientId);
				} else {
					store.set(clientId, pruned);
				}
			}
		}
	},
	10 * 60 * 1000,
);

export function resetLoginAttemptStores(): void {
	stores.clear();
}
