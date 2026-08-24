import { QueryClient } from "@tanstack/react-query";
import { queryCacheDuration } from "@/lib/query-cache";

export function shouldRetryQuery(
	failureCount: number,
	error: unknown,
): boolean {
	if (failureCount >= 2) return false;
	const responseStatus = (error as { response?: { status?: unknown } } | null)
		?.response?.status;
	if (typeof responseStatus === "number") {
		return (
			responseStatus === 502 || responseStatus === 503 || responseStatus === 504
		);
	}
	if (error instanceof TypeError) return true;
	return Boolean(
		error &&
			typeof error === "object" &&
			"request" in error &&
			!("response" in error),
	);
}

export function queryRetryDelay(attemptIndex: number): number {
	return Math.min(250 * 2 ** attemptIndex, 2_000);
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: queryCacheDuration.defaultStale,
			gcTime: queryCacheDuration.inactiveGc,
			refetchOnWindowFocus: false,
			retry: shouldRetryQuery,
			retryDelay: queryRetryDelay,
		},
	},
});
