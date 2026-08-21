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

export interface RateLimitStore {
	check(
		key: string,
		clientId: string,
		options: { windowMs: number; max: number },
	): Promise<{
		allowed: boolean;
		remaining: number;
		resetAt: number;
		retryAfter?: number;
	}>;
}

export class MemoryRateLimitStore implements RateLimitStore {
	async check(
		key: string,
		clientId: string,
		options: { windowMs: number; max: number },
	) {
		const store = getStore(key);
		const now = Date.now();
		let timestamps = store.get(clientId) ?? [];
		timestamps = pruneTimestamps(timestamps, options.windowMs);

		const resetAt = now + options.windowMs;

		if (timestamps.length >= options.max) {
			const oldest = timestamps[0];
			const retryAfter = Math.ceil((oldest + options.windowMs - now) / 1000);
			return {
				allowed: false,
				remaining: 0,
				resetAt: oldest + options.windowMs,
				retryAfter,
			};
		}

		timestamps.push(now);
		store.set(clientId, timestamps);

		return {
			allowed: true,
			remaining: options.max - timestamps.length,
			resetAt,
		};
	}
}

setInterval(
	() => {
		const cutoff = Date.now() - 30 * 60 * 1000;
		for (const store of stores.values()) {
			for (const [key, timestamps] of store) {
				const pruned = timestamps.filter((t) => t > cutoff);
				if (pruned.length === 0) {
					store.delete(key);
				} else {
					store.set(key, pruned);
				}
			}
		}
	},
	10 * 60 * 1000,
);

export function resetRateLimitStores(): void {
	stores.clear();
}
