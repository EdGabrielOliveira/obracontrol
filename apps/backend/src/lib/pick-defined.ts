export function pickDefined<T extends Record<string, unknown>>(
	source: Partial<T>,
	keys: (keyof T)[],
): Partial<T> {
	const result: Partial<T> = {};
	for (const key of keys) {
		if (source[key] !== undefined) {
			result[key] = source[key];
		}
	}
	return result;
}
