export function parseBIWorkIds(value?: string): string[] {
	return (value ?? "")
		.split(",")
		.map((workId) => workId.trim())
		.filter(Boolean);
}

export function serializeBIWorkIds(
	workIds: readonly string[],
): string | undefined {
	const normalized = Array.from(
		new Set(workIds.map((workId) => workId.trim()).filter(Boolean)),
	);
	return normalized.length > 0 ? normalized.join(",") : undefined;
}
