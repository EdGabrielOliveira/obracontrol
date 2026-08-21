export function parseBrazilianDate(value: string): Date | null {
	const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	if (day < 1 || day > 31 || month < 1 || month > 12) return null;

	return new Date(Date.UTC(year, month - 1, day));
}

export function looksLikeDescriptiveHeader(value: string): boolean {
	return value.includes("|") || value.toLowerCase().includes("obra fict");
}

export function slugWorkCode(value: string): string {
	const normalized = value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);

	return normalized || "OBRA-IMPORTADA";
}

export function parseDescriptiveHeader(value: string) {
	const parts = value
		.split("|")
		.map((part) => part.trim())
		.filter(Boolean);
	const firstPart = parts[0] ?? value;
	const name = firstPart.replace(/^obra\s+fict[ií]cia\s*:/i, "").trim();
	const referencePart = parts.find((part) =>
		/data de refer[eê]ncia simulada/i.test(part),
	);

	return {
		name: name || value.trim(),
		baseDate: referencePart
			? parseBrazilianDate(referencePart)
			: parseBrazilianDate(value),
	};
}

export function deriveWorkIdentity(input: {
	code?: string | null;
	name?: string | null;
	baseDate?: Date | null;
}) {
	const rawCode = input.code?.trim() ?? "";
	const rawName = input.name?.trim() ?? "";

	if (rawCode && looksLikeDescriptiveHeader(rawCode)) {
		const parsed = parseDescriptiveHeader(rawCode);
		const name = rawName || parsed.name;

		return {
			code: slugWorkCode(name),
			name,
			baseDate: input.baseDate ?? parsed.baseDate,
		};
	}

	const name = rawName || rawCode;

	return {
		code: rawCode || slugWorkCode(name),
		name,
		baseDate: input.baseDate ?? null,
	};
}
