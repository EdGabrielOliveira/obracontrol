import { ConstructionError } from "./errors";

const AS_OF_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

export function parseAsOfDate(raw: string | undefined): Date | undefined {
	if (raw == null || raw === "") return undefined;

	const match = AS_OF_DATE_PATTERN.exec(raw);
	if (!match) {
		throw new ConstructionError(
			"INVALID_AS_OF_DATE",
			"Formato de data invalido, use YYYY-MM-DD",
			400,
		);
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		throw new ConstructionError(
			"INVALID_AS_OF_DATE",
			"Data de corte invalida",
			400,
		);
	}

	const today = startOfUtcDay(new Date());
	if (date.getTime() > today.getTime()) {
		throw new ConstructionError(
			"INVALID_AS_OF_DATE",
			"Data de corte futura nao permitida",
			422,
		);
	}

	return date;
}
