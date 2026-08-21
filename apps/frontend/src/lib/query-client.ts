import { QueryClient } from "@tanstack/react-query";
import { queryCacheDuration } from "@/lib/query-cache";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: queryCacheDuration.defaultStale,
			gcTime: queryCacheDuration.inactiveGc,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
