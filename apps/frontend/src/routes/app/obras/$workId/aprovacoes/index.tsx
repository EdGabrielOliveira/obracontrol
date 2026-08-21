import { createFileRoute } from "@tanstack/react-router";
import { listPendingApprovals } from "@/api/governance";
import { governanceKeys, workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { WorkGovernancePage } from "@/components/organisms/works/work-governance-page";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/obras/$workId/aprovacoes/")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.detail(params.workId),
				queryFn: () => getWork(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: governanceKeys.pendingApprovals(params.workId),
				queryFn: () => listPendingApprovals(params.workId),
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
