export function requestPath(request: Request): string {
	// Elysia hooks can receive a relative URL from adapters or malformed scanner
	// traffic. Supplying an internal base keeps observability hooks non-throwing.
	return new URL(request.url, "http://internal.invalid").pathname;
}
