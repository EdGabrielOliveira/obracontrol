import { createFileRoute } from "@tanstack/react-router";
import { workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { WorkGovernancePage } from "@/components/organisms/works/work-governance-page";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";

export const Route = createFileRoute("/app/obras/$workId/aprovacoes/")({
	beforeLoad: () => requireAuthorizationCapability("canDecideSupervisorRequests"),
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.detail(params.workId),
				queryFn: () => getWork(params.workId),
			}),
		]);
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Aprovações - ObraControl" },
		],
	}),
	component: () => <WorkGovernancePage mode="aprovacoes" />,
});
