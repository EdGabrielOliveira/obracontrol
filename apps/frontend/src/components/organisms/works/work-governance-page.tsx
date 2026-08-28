import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getWorkAudit } from "@/api/audit";
import { decideApproval, listPendingApprovals } from "@/api/governance";
import { auditKeys, governanceKeys, workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { AccessDenied } from "@/atoms/access-denied";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { AprovacoesSection } from "@/components/organisms/works/approvals-section";
import { AuditEntryDetail } from "@/components/organisms/works/audit-entry-detail";
import type { AuditFilters } from "@/components/organisms/works/audit-log-table";
import { HistoryTab } from "@/components/organisms/works/history-tab";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { canDecideSupervisorRequests } from "@/lib/role-permissions";
import type { AuditLogEntry } from "@/types/audit";
import { getErrorMessage } from "@/utils/api-error";

type WorkGovernancePageProps = {
	mode: "historico" | "aprovacoes";
};

export function WorkGovernancePage({ mode }: WorkGovernancePageProps) {
	const { workId } = useParams({ strict: false });
	const navigate = useNavigate();
	const { user, role, capabilities } = useAuth();
	const canViewHistory =
		capabilities?.canReviewExecutedSupervisorRequests ?? role === "GERENTE";
	const canAccessGovernance = canViewHistory || role === "GESTOR";
	const canApprove =
		canAccessGovernance && canDecideSupervisorRequests(capabilities);
	const [auditFilters, setAuditFilters] = useState<AuditFilters>({});
	const [auditPage, setAuditPage] = useState(1);
	const [auditDetail, setAuditDetail] = useState<AuditLogEntry | null>(null);

	const workQuery = useQuery({
		queryKey: workKeys.detail(workId ?? ""),
		queryFn: () => getWork(workId ?? ""),
		enabled: Boolean(workId),
	});

	const auditQuery = useQuery({
		queryKey: auditKeys.work(workId ?? "", {
			...auditFilters,
			page: auditPage,
			limit: 50,
		}),
		queryFn: () =>
			getWorkAudit(workId ?? "", {
				...auditFilters,
				page: auditPage,
				limit: 50,
			}),
		enabled: mode === "historico" && canViewHistory && Boolean(workId),
	});

	const approvalsQuery = useQuery({
		queryKey: governanceKeys.pendingApprovals(workId ?? ""),
		queryFn: () => listPendingApprovals(workId ?? ""),
		enabled: mode === "aprovacoes" && canApprove && Boolean(workId),
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
				queryKey: governanceKeys.pendingApprovals(workId ?? ""),
			});
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao registrar decisão."));
		},
	});

	if (workQuery.isLoading) return <LoadingSpinner title="Carregando obra..." />;
	if (workQuery.error || !workQuery.data) {
		return <ErrorFeedback onRetry={() => workQuery.refetch()} />;
	}
	if (mode === "aprovacoes" && !canApprove) return <AccessDenied />;

	const work = workQuery.data;
	const parentContext = [work.organizationName, work.costCenterName]
		.filter(Boolean)
		.join(" / ");

	const handleAuditNavigation = (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => {
		if (target.path.startsWith("/app/")) navigate({ to: target.path as never });
	};

	return (
		<PageContainer>
			<PageHeader
				eyebrow={parentContext || "Obra"}
				title={work.name}
				description={
					mode === "historico"
						? "Histórico de alterações da obra."
						: "Solicitações pendentes de aprovação da obra."
				}
			/>
			{mode === "historico" ? (
				<HistoryContent
					workId={workId ?? ""}
					rows={auditQuery.data?.data ?? []}
					total={auditQuery.data?.total ?? 0}
					page={auditPage}
					loading={auditQuery.isLoading}
					error={auditQuery.error}
					filters={auditFilters}
					onRetry={() => auditQuery.refetch()}
					onFiltersChange={(filters) => {
						setAuditFilters(filters);
						setAuditPage(1);
					}}
					onPageChange={setAuditPage}
					onOpenDetail={setAuditDetail}
					onOpenNavigationTarget={handleAuditNavigation}
					canView={canViewHistory}
				/>
			) : (
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
			)}

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

function HistoryContent({
	canView,
	...props
}: {
	workId: string;
	canView: boolean;
	rows: AuditLogEntry[];
	total: number;
	page: number;
	limit?: number;
	loading: boolean;
	error: Error | null;
	filters: AuditFilters;
	onRetry: () => void;
	onFiltersChange: (filters: AuditFilters) => void;
	onPageChange: (page: number) => void;
	onOpenDetail: (row: AuditLogEntry) => void;
	onOpenNavigationTarget: (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => void;
}) {
	if (!canView)
		return (
			<ErrorFeedback message="Você não tem permissão para acessar esta tela." />
		);
	return (
		<HistoryTab
			workId={props.workId}
			canViewHistory
			rows={props.rows}
			total={props.total}
			page={props.page}
			limit={props.limit ?? 50}
			loading={props.loading}
			error={props.error}
			onRetry={props.onRetry}
			filters={props.filters}
			onFiltersChange={props.onFiltersChange}
			onPageChange={props.onPageChange}
			onOpenDetail={props.onOpenDetail}
			onOpenNavigationTarget={props.onOpenNavigationTarget}
		/>
	);
}
