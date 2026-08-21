import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "@/lib/query-client";
import { sessionQueryOptions } from "@/lib/session-query";
import { safeRedirectPath } from "@/utils/safeRedirectPath";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "ObraControl" },
		],
	}),
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
		throw redirect({ to: "/app" });
	},
});
