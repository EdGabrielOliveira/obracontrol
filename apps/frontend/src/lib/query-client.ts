import { MutationCache, QueryClient } from "@tanstack/react-query";
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

/**
 * Builds the application's query client.
 *
 * Any successful mutation may affect more than the resource it directly
 * changes (for example, a measurement also affects dashboards and reports).
 * Mark every cached query as stale so active screens refetch immediately and
 * inactive screens refresh when they are visited again. Feature-specific
 * invalidations can still be kept for narrowly scoped cache updates.
 */
export function createQueryClient() {
	let client: QueryClient | undefined;
	const mutationCache = new MutationCache({
		onSuccess: () => {
			void client?.invalidateQueries();
		},
	});

	client = new QueryClient({
		mutationCache,
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

	return client;
}

export const queryClient = createQueryClient();
