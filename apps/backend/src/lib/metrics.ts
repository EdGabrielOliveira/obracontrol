export type TimingSummary = {
	count: number;
	sum: number;
	min: number;
	max: number;
	last: number;
	avg: number;
};

export type MetricsSnapshot = {
	counters: Record<string, number>;
	timings: Record<string, TimingSummary>;
};

const counters = new Map<string, number>();
const timings = new Map<string, TimingSummary>();

export const metrics = {
	increment(name: string, by = 1): void {
		counters.set(name, (counters.get(name) ?? 0) + by);
	},
	timing(name: string, ms: number): void {
		const current = timings.get(name);
		if (!current) {
			timings.set(name, {
				count: 1,
				sum: ms,
				min: ms,
				max: ms,
				last: ms,
				avg: ms,
			});
			return;
		}
		current.count += 1;
		current.sum += ms;
		current.min = Math.min(current.min, ms);
		current.max = Math.max(current.max, ms);
		current.last = ms;
		current.avg = current.sum / current.count;
	},
	snapshot(): MetricsSnapshot {
		return {
			counters: Object.fromEntries(counters),
			timings: Object.fromEntries(
				[...timings.entries()].map(([name, timing]) => [name, { ...timing }]),
			),
		};
	},
	reset(): void {
		counters.clear();
		timings.clear();
	},
};
