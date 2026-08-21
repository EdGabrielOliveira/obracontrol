export function monthKey(date: Date): string {
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${date.getUTCFullYear()}-${month}`;
}

export function fillMonthGaps(sortedMonths: string[]): string[] {
	if (sortedMonths.length < 2) return sortedMonths;
	const result: string[] = [sortedMonths[0]];
	for (let i = 1; i < sortedMonths.length; i++) {
		const curr = sortedMonths[i];
		let next = nextMonth(result[result.length - 1]);
		while (next < curr) {
			result.push(next);
			next = nextMonth(next);
		}
		result.push(curr);
	}
	return result;
}

function nextMonth(ym: string): string {
	const [y, m] = ym.split("-").map(Number);
	if (m === 12) return `${y + 1}-01`;
	return `${y}-${String(m + 1).padStart(2, "0")}`;
}
