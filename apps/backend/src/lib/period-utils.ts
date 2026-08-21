export type SchedulePeriod = "daily" | "monthly" | "biweekly" | "weekly";

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function monthParts(key: string): { year: number; month: number } {
	const [year, month] = key.split("-").map(Number);
	if (!Number.isInteger(year) || !Number.isInteger(month)) {
		throw new Error(`Invalid period key: ${key}`);
	}
	return { year, month };
}

export function periodKeyOf(date: Date, period: SchedulePeriod): string {
	const year = date.getUTCFullYear();
	const month = pad2(date.getUTCMonth() + 1);
	const day = pad2(date.getUTCDate());

	if (period === "daily") {
		return `${year}-${month}-${day}`;
	}

	if (period === "monthly") {
		return `${year}-${month}`;
	}

	const dayOfMonth = date.getUTCDate();

	if (period === "biweekly") {
		return `${year}-${month}-${dayOfMonth <= 15 ? 1 : 2}`;
	}

	return `${year}-${month}-${Math.min(5, Math.ceil(dayOfMonth / 7))}`;
}

export function nextPeriodKey(key: string, period: SchedulePeriod): string {
	const { year, month } = monthParts(key);

	if (period === "daily") {
		const date = new Date(`${key}T00:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() + 1);
		return periodKeyOf(date, "daily");
	}

	if (period === "monthly") {
		return month === 12 ? `${year + 1}-01` : `${year}-${pad2(month + 1)}`;
	}

	const suffix = key.split("-")[2];
	if (!suffix) throw new Error(`Invalid period key: ${key}`);

	if (period === "biweekly") {
		return suffix === "1"
			? `${year}-${pad2(month)}-2`
			: month === 12
				? `${year + 1}-01-1`
				: `${year}-${pad2(month + 1)}-1`;
	}

	const week = Number(suffix);
	if (!Number.isInteger(week)) throw new Error(`Invalid period key: ${key}`);

	if (week < 5) {
		return `${year}-${pad2(month)}-${week + 1}`;
	}
	return month === 12 ? `${year + 1}-01-1` : `${year}-${pad2(month + 1)}-1`;
}

export function fillPeriodGaps(
	sortedKeys: string[],
	period: SchedulePeriod,
): string[] {
	if (sortedKeys.length < 2) return sortedKeys;
	const result: string[] = [sortedKeys[0]];
	for (let i = 1; i < sortedKeys.length; i++) {
		const curr = sortedKeys[i];
		let next = nextPeriodKey(result[result.length - 1], period);
		while (next < curr) {
			result.push(next);
			next = nextPeriodKey(next, period);
		}
		result.push(curr);
	}
	return result;
}
