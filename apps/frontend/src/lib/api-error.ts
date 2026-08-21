export function apiErrorStatus(error: unknown): number | undefined {
	if (typeof error === "object" && error !== null && "response" in error) {
		const response = (error as { response?: { status?: number } }).response;
		return response?.status;
	}
	return undefined;
}
