export type SchedulePeriod = "daily" | "monthly" | "biweekly" | "weekly";

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
	month: "long",
	timeZone: "UTC",
});

function monthLabel(key: string): string {
	const [year, month] = key.split("-").map(Number);
	const label = monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
	return `${label}/${year}`;
}

export function formatPeriodLabel(key: string, period: SchedulePeriod): string {
	if (period === "daily") {
		const [year, month, day] = key.split("-");
		return `${day}/${month}/${year}`;
	}
	if (period === "monthly") {
		return monthLabel(key);
	}

	const suffix = key.split("-")[2];

	if (period === "biweekly") {
		return `${suffix === "1" ? "1ª" : "2ª"} quinzena ${monthLabel(key)}`;
	}

	return `${suffix}ª semana ${monthLabel(key)}`;
}
