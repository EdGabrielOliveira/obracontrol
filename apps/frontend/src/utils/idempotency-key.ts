export function createIdempotencyKey(prefix = "request"): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	const suffix =
		uuid ??
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

	return `${prefix}-${suffix}`;
}
