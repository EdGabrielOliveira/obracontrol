import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { AppShell } from "@/components/organisms/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { authClient } from "@/lib/auth-client";
import { authorizationSessionQueryOptions } from "@/lib/authorization-session-query";
import { queryClient } from "@/lib/query-client";
import { authQueryKeys } from "@/lib/query-cache";
import { sessionQueryOptions } from "@/lib/session-query";
import { safeRedirectPath } from "@/utils/safeRedirectPath";
import type { AuthorizationSession } from "@/types/authorization";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ location }) => {
		const session =
			queryClient.getQueryData<Awaited<ReturnType<typeof authClient.getSession>>>(
				authQueryKeys.session,
			) ??
			(await queryClient.fetchQuery(sessionQueryOptions()));
		if (!session.data?.session) {
			const redirectTo = safeRedirectPath(
				`${location.pathname}${location.searchStr}`,
			);
			throw redirect({
				to: "/auth/login",
				search: { redirect: redirectTo },
			});
		}

		// The session alone is not enough to enter the application. Resolve the
		// authorization payload before TanStack Router starts child loaders and
		// renders the shell; otherwise role-dependent UI can briefly use null
		// permissions and appear as if the user were a low-privilege user.
		if (!queryClient.getQueryData<AuthorizationSession>(authQueryKeys.authorization)) {
			await queryClient.fetchQuery(authorizationSessionQueryOptions());
		}
	},
	component: AppLayout,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "App - ObraControl" },
		],
	}),
});

function AppLayout() {
	const { loading } = useAuth();

	if (loading) {
		return <LoadingSpinner title="Carregando seu acesso..." />;
	}

	return <AppShell />;
}
