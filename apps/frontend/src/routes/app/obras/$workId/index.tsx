import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getWorkAudit } from "@/api/audit";
import { getWorkBI } from "@/api/bi";
import {
	decideApproval,
	getGovernanceRecord,
	listPendingApprovals,
} from "@/api/governance";
import { getWorkManagement } from "@/api/management";
import {
	auditKeys,
	budgetVersionKeys,
	governanceKeys,
	workKeys,
} from "@/api/query-keys";
import { getSchedule } from "@/api/schedule";
import { getWork } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	GovernanceStatusBadge,
	GovernanceStatusModal,
} from "@/components/organisms/governance/governance-status-modal";
import { AprovacoesSection } from "@/components/organisms/works/approvals-section";
import { AuditEntryDetail } from "@/components/organisms/works/audit-entry-detail";
import type { AuditFilters } from "@/components/organisms/works/audit-log-table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { canDecideSupervisorRequests } from "@/lib/role-permissions";
import { WorkDetailHeader } from "@/organisms/works/work-detail-header";
import { WorkHub } from "@/organisms/works/work-hub";
import { workHubSearchSchema } from "@/schemas/work-hub";
import type { AuditLogEntry } from "@/types/audit";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/obras/$workId/")({
	validateSearch: workHubSearchSchema,
	beforeLoad: ({ params, search }) => {
		if (search.tab === "acoes") {
			throw redirect({
				to: "/app/obras/$workId/historico",
				params,
			});
		}
	},
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ params, deps }) => {
		void queryClient.prefetchQuery({
			queryKey: workKeys.detail(params.workId),
			queryFn: () => getWork(params.workId),
		});
		if (deps.search.tab === "resumo") {
			void Promise.all([
				queryClient.prefetchQuery({
					queryKey: workKeys.bi(params.workId, deps.search.asOfDate),
					queryFn: () => getWorkBI(params.workId, deps.search.asOfDate),
				}),
				queryClient.prefetchQuery({
					queryKey: workKeys.management(params.workId, deps.search.asOfDate),
					queryFn: () => getWorkManagement(params.workId, deps.search.asOfDate),
				}),
				queryClient.prefetchQuery({
					queryKey: workKeys.schedule(params.workId),
					queryFn: () => getSchedule(params.workId),
				}),
			]);
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
	const { workId } = useParams({ from: "/app/obras/$workId/" });
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate({ from: Route.id });
	const { user, role, capabilities } = useAuth();
	const canAccessGovernance =
		capabilities?.canReviewExecutedSupervisorRequests ?? role === "GERENTE";
	const canApprove = canDecideSupervisorRequests(capabilities);

	const tab = search.tab;
	const asOfDate = search.asOfDate;

	const [auditFilters, setAuditFilters] = useState<AuditFilters>({});
	const [auditPage, setAuditPage] = useState(1);
	const [auditDetail, setAuditDetail] = useState<AuditLogEntry | null>(null);
	const [governanceOpen, setGovernanceOpen] = useState(false);
	const governanceQuery = useQuery({
		queryKey: governanceKeys.detail("WORK_STATUS", workId),
		queryFn: () => getGovernanceRecord("WORK_STATUS", workId),
	});

	const handleAuditFiltersChange = (filters: AuditFilters) => {
		setAuditFilters(filters);
		setAuditPage(1);
	};

	const {
		data: work,
		isLoading: workLoading,
		error: workError,
		refetch: refetchWork,
	} = useQuery({
		queryKey: workKeys.detail(workId),
		queryFn: () => getWork(workId),
	});

	const biQuery = useQuery({
		queryKey: workKeys.bi(workId, asOfDate),
		queryFn: () => getWorkBI(workId, asOfDate),
		enabled: tab === "resumo",
	});

	const mgmtQuery = useQuery({
		queryKey: workKeys.management(workId, asOfDate),
		queryFn: () => getWorkManagement(workId, asOfDate),
		enabled: tab === "resumo",
	});

	const scheduleQuery = useQuery({
		queryKey: workKeys.schedule(workId),
		queryFn: () => getSchedule(workId),
		enabled: tab === "resumo",
		staleTime: 60_000,
	});

	const auditQuery = useQuery({
		queryKey: auditKeys.work(workId, {
			...auditFilters,
			page: auditPage,
			limit: 50,
		}),
		queryFn: () =>
			getWorkAudit(workId, { ...auditFilters, page: auditPage, limit: 50 }),
		enabled: canAccessGovernance && tab === "historico",
	});

	const approvalsQuery = useQuery({
		queryKey: governanceKeys.pendingApprovals(workId),
		queryFn: () => listPendingApprovals(workId),
		enabled: canApprove,
	});

	const decideMutation = useMutation({
		mutationFn: (input: {
			requestId: string;
			decision: "APPROVE" | "REJECT";
			reason?: string;
		}) => decideApproval(input),
		onSuccess: () => {
			toast.success("Decisão registrada.");
			queryClient.invalidateQueries({
				queryKey: governanceKeys.pendingApprovals(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.budget(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.budgetVersion(workId),
			});
			queryClient.invalidateQueries({
				queryKey: budgetVersionKeys.history(workId),
			});
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao registrar decisão."));
		},
	});

	if (workLoading) return <LoadingSpinner title="Carregando obra..." />;
	if (workError)
		return (
			<ErrorFeedback
				message="Não foi possível carregar a obra."
				onRetry={() => void refetchWork()}
			/>
		);
	if (!work) return <ErrorFeedback message="Obra não encontrada." />;

	const parentContext = [work.organizationName, work.costCenterName]
		.filter(Boolean)
		.join(" / ");

	const hasNoBudget = !work.activeBudget && !work.lastImportAt;

	const handleAsOfDateChange = (value: string | undefined) => {
		navigate({ search: (previous) => ({ ...previous, asOfDate: value }) });
	};

	const handleAuditNavigation = (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => {
		if (!target.path.startsWith("/app/")) return;
		navigate({ to: target.path as never });
	};

	return (
		<PageContainer>
			<PageHeader
				eyebrow={parentContext || "Obra"}
				title={work.name}
				description={`Código: ${work.code}`}
				actions={
					<>
						<GovernanceStatusBadge
							record={governanceQuery.data}
							loading={governanceQuery.isLoading}
							error={governanceQuery.isError}
						/>
						{role !== "SUPERVISOR" && (
							<Button
								size="sm"
								variant="outline"
								disabled={governanceQuery.isLoading || governanceQuery.isError}
								onClick={() => setGovernanceOpen(true)}
							>
								Alterar status
							</Button>
						)}
						{role !== "SUPERVISOR" && (
							<Link to="/app/obras/$workId/configuracoes" params={{ workId }}>
								<Button size="sm">
									<Settings className="mr-2 h-4 w-4" />
									Configurações
								</Button>
							</Link>
						)}
					</>
				}
			/>
			<GovernanceStatusModal
				open={governanceOpen}
				onOpenChange={setGovernanceOpen}
				entityType="WORK_STATUS"
				entityId={workId}
				current={governanceQuery.data}
				onChanged={() => governanceQuery.refetch()}
			/>
			<WorkDetailHeader work={work} />
			<WorkHub
				workId={workId}
				canAccessGovernance={canAccessGovernance}
				activeTab={tab}
				bi={biQuery.data}
				biLoading={biQuery.isLoading}
				biError={biQuery.error}
				onBiRetry={() => biQuery.refetch()}
				mgmt={mgmtQuery.data}
				mgmtLoading={mgmtQuery.isLoading}
				mgmtError={mgmtQuery.error}
				onMgmtRetry={() => mgmtQuery.refetch()}
				schedule={scheduleQuery.data}
				asOfDate={asOfDate}
				onAsOfDateChange={handleAsOfDateChange}
				hasNoBudget={hasNoBudget}
				onGoToBudget={() =>
					navigate({ to: "/app/obras/$workId/orcamento", params: { workId } })
				}
				auditRows={auditQuery.data?.data ?? []}
				auditTotal={auditQuery.data?.total ?? 0}
				auditPage={auditPage}
				auditLimit={50}
				auditLoading={auditQuery.isLoading}
				auditError={auditQuery.error}
				auditFilters={auditFilters}
				onAuditRetry={() => auditQuery.refetch()}
				onAuditFiltersChange={handleAuditFiltersChange}
				onAuditPageChange={setAuditPage}
				onOpenAuditDetail={setAuditDetail}
				onOpenAuditNavigationTarget={handleAuditNavigation}
				aprovacoes={
					canApprove ? (
						<AprovacoesSection
							rows={approvalsQuery.data ?? []}
							loading={approvalsQuery.isLoading}
							error={approvalsQuery.error}
							onRetry={() => approvalsQuery.refetch()}
							onDecide={(requestId, decision, reason) =>
								decideMutation.mutate({ requestId, decision, reason })
							}
							decidingId={
								decideMutation.isPending
									? (decideMutation.variables?.requestId ?? null)
									: null
							}
							requiresDecisionReason={role === "ADMIN" || role === "GESTOR"}
							currentUserId={user?.id}
						/>
					) : undefined
				}
			/>
			<AuditEntryDetail
				entry={auditDetail}
				onOpenNavigationTarget={handleAuditNavigation}
				onOpenChange={(open) => {
					if (!open) setAuditDetail(null);
				}}
			/>
		</PageContainer>
	);
}
