import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { decideApproval, listPendingApprovals } from "@/api/governance";
import { governanceKeys } from "@/api/query-keys";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { ApprovalsTab } from "@/components/organisms/works/approvals-tab";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";

export const Route = createFileRoute("/app/aprovacoes/")({
	beforeLoad: () => requireAuthorizationCapability("canDecideSupervisorRequests"),
	loader: () => {
		void queryClient.prefetchQuery({
			queryKey: governanceKeys.pendingApprovals(),
			queryFn: () => listPendingApprovals(),
		});
	},
	component: GlobalApprovalsPage,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Aprovações - ObraControl" },
		],
	}),
});

function GlobalApprovalsPage() {
	const { user, role } = useAuth();
	const query = useQuery({
		queryKey: governanceKeys.pendingApprovals(),
		queryFn: () => listPendingApprovals(),
	});
	const mutation = useMutation({
		mutationFn: decideApproval,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: governanceKeys.all });
		},
	});

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Governança"
				title="Aprovações"
				description="Solicitações pendentes em todas as organizações e obras do seu escopo."
			/>
			<ApprovalsTab
				rows={query.data ?? []}
				loading={query.isLoading}
				error={query.error as Error | null}
				onRetry={() => query.refetch()}
				onDecide={(requestId, decision, reason) =>
					mutation.mutate({ requestId, decision, reason })
				}
				requiresDecisionReason={role === "GESTOR" || role === "ADMIN"}
				currentUserId={user?.id}
				decidingId={
					mutation.isPending ? (mutation.variables?.requestId ?? null) : null
				}
			/>
		</PageContainer>
	);
}
