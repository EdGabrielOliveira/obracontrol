import { createFileRoute, Outlet } from "@tanstack/react-router";
import { workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { queryClient } from "@/lib/query-client";

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/obras/$workId")({
	loader: ({ params }) => {
		const { workId } = params;
		if (UUID_REGEX.test(workId)) {
			void queryClient.prefetchQuery({
				queryKey: workKeys.detail(workId),
				queryFn: () => getWork(workId),
			});
		}
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Obra - ObraControl" },
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
