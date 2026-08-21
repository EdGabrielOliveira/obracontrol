import { queryOptions } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { authQueryKeys, queryCacheDuration } from "@/lib/query-cache";

export function sessionQueryOptions() {
	return queryOptions({
		queryKey: authQueryKeys.session,
		queryFn: () => authClient.getSession(),
		staleTime: queryCacheDuration.sessionStale,
	});
}
