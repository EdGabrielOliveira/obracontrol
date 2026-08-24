import { queryOptions } from "@tanstack/react-query";
import { fetchAuthorizationSession } from "@/lib/auth-client";
import { authQueryKeys, queryCacheDuration } from "@/lib/query-cache";

export function authorizationSessionQueryOptions() {
	return queryOptions({
		queryKey: authQueryKeys.authorization,
		queryFn: fetchAuthorizationSession,
		staleTime: queryCacheDuration.sessionStale,
	});
}
