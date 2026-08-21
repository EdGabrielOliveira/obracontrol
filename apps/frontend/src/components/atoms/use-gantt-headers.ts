import { useMemo } from "react";

export interface TimelineHeader {
	label: string;
	start: Date;
	end: Date;
}

const MONTH_NAMES = [
	"Jan",
	"Fev",
	"Mar",
	"Abr",
	"Mai",
	"Jun",
	"Jul",
	"Ago",
	"Set",
	"Out",
	"Nov",
	"Dez",
];

function generateTimelineHeaders(
	rangeStart: Date,
	rangeEnd: Date,
): TimelineHeader[] {
	const headers: TimelineHeader[] = [];
	const current = new Date(rangeStart);
	current.setDate(1);

	while (current <= rangeEnd) {
		const monthStart = new Date(current);
		const monthEnd = new Date(current);
		monthEnd.setMonth(monthEnd.getMonth() + 1);
		monthEnd.setDate(0);

		const displayStart = monthStart < rangeStart ? rangeStart : monthStart;
		const displayEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;

		headers.push({
			label: `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`,
			start: displayStart,
			end: displayEnd,
		});

		current.setMonth(current.getMonth() + 1);
	}

	return headers;
}

export function useGanttHeaders(
	timelineStart: Date,
	timelineEnd: Date,
): TimelineHeader[] {
	return useMemo(
		() => generateTimelineHeaders(timelineStart, timelineEnd),
		[timelineStart, timelineEnd],
	);
}
