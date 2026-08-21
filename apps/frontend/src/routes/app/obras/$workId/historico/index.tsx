import { createFileRoute } from "@tanstack/react-router";
import { getWorkAudit } from "@/api/audit";
import { getImportBatches } from "@/api/import";
import { auditKeys, importBatchKeys, workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { WorkGovernancePage } from "@/components/organisms/works/work-governance-page";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/obras/$workId/historico/")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.detail(params.workId),
				queryFn: () => getWork(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: auditKeys.work(params.workId, { page: 1, limit: 50 }),
				queryFn: () => getWorkAudit(params.workId, { page: 1, limit: 50 }),
			}),
			queryClient.prefetchQuery({
				queryKey: importBatchKeys.list(params.workId, 1, 20),
				queryFn: () => getImportBatches(params.workId, 1, 20),
			}),
		]);
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Histórico - ObraControl" },
		],
	}),
	component: () => <WorkGovernancePage mode="historico" />,
});
