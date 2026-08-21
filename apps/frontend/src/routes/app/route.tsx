import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { AppShell } from "@/components/organisms/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { sessionQueryOptions } from "@/lib/session-query";
import { safeRedirectPath } from "@/utils/safeRedirectPath";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ location }) => {
		const session = await queryClient.fetchQuery(sessionQueryOptions());
		if (!session.data?.session) {
			const redirectTo = safeRedirectPath(
				`${location.pathname}${location.searchStr}`,
			);
			throw redirect({
				to: "/auth/login",
				search: { redirect: redirectTo },
			});
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
