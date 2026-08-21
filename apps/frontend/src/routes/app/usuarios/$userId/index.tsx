import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { Pencil, ShieldCheck, ShieldX, UserRound } from "lucide-react";
import { useState } from "react";
import { getAdminUser } from "@/api/admin-users";
import { listAuditLogs } from "@/api/audit";
import { adminUserKeys, auditKeys } from "@/api/query-keys";
import { AccessDenied } from "@/atoms/access-denied";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { AuditEntryDetail } from "@/components/organisms/works/audit-entry-detail";
import {
	type AuditFilters,
	AuditLogTable,
} from "@/components/organisms/works/audit-log-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import type { AuditLogEntry } from "@/types/audit";
import { ROLE_LABELS } from "@/types/authorization";
import { formatDate } from "@/utils/format";

type HistoryView = "all" | "approvals" | "rejections";

export const Route = createFileRoute("/app/usuarios/$userId/")({
	beforeLoad: () => requireAuthorizationCapability("canManageUsers"),
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: adminUserKeys.detail(params.userId),
				queryFn: () => getAdminUser(params.userId),
			}),
			queryClient.prefetchQuery({
				queryKey: auditKeys.list({ userId: params.userId, page: 1, limit: 50 }),
				queryFn: () =>
					listAuditLogs({ userId: params.userId, page: 1, limit: 50 }),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Usuários - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { userId } = useParams({ from: "/app/usuarios/$userId/" });
	const navigate = useNavigate({ from: Route.id });
	const { capabilities, loading } = useAuth();
	const [auditFilters, setAuditFilters] = useState<AuditFilters>({ userId });
	const [auditPage, setAuditPage] = useState(1);
	const [auditDetail, setAuditDetail] = useState<AuditLogEntry | null>(null);
	const [historyView, setHistoryView] = useState<HistoryView>("all");
	const userQuery = useQuery({
		queryKey: adminUserKeys.detail(userId),
		queryFn: () => getAdminUser(userId),
	});
	const auditQuery = useQuery({
		queryKey: auditKeys.list({ ...auditFilters, page: auditPage, limit: 50 }),
		queryFn: () =>
			listAuditLogs({ ...auditFilters, page: auditPage, limit: 50 }),
	});

	if (loading) return <LoadingSpinner title="Carregando autorização..." />;
	if (!capabilities?.canManageUsers) return <AccessDenied />;
	if (userQuery.isLoading)
		return <LoadingSpinner title="Carregando usuário..." />;
	if (userQuery.error || !userQuery.data) return <ErrorFeedback />;

	const user = userQuery.data;
	const hasDecisionHistory = user.role === "GESTOR" || user.role === "GERENTE";
	const handleFiltersChange = (filters: AuditFilters) => {
		setAuditFilters({ ...filters, userId });
		setAuditPage(1);
	};
	const handleHistoryViewChange = (view: HistoryView) => {
		setHistoryView(view);
		setAuditFilters({
			userId,
			action:
				view === "approvals"
					? "APPROVE"
					: view === "rejections"
						? "REJECT"
						: undefined,
		});
		setAuditPage(1);
	};
	const handleNavigation = (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => {
		if (target.path.startsWith("/app/")) navigate({ to: target.path as never });
	};

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração / Usuários"
				title={user.name}
				description={user.email}
				actions={
					<div className="flex gap-2">
						<Link to="/app/usuarios/$userId/edit" params={{ userId }}>
							<Button>
								<Pencil className="mr-2 h-4 w-4" /> Editar usuário
							</Button>
						</Link>
						<Link to="/app/usuarios">
							<Button variant="outline">Voltar</Button>
						</Link>
					</div>
				}
			/>

			<Card>
				<CardHeaderWithIcon
					icon={UserRound}
					title="Dados do usuário"
					description="Papel, status e vínculos ativos."
				/>
				<CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-xs text-muted-foreground">Papel</p>
						<Badge variant="secondary">
							{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
						</Badge>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Status do e-mail</p>
						<Badge variant={user.emailVerified ? "default" : "secondary"}>
							{user.emailVerified ? (
								<>
									<ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verificado
								</>
							) : (
								<>
									<ShieldX className="mr-1 h-3.5 w-3.5" /> Não verificado
								</>
							)}
						</Badge>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Criado em</p>
						<p className="font-medium">{formatDate(user.createdAt)}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Vínculos ativos</p>
						<p className="font-medium">
							{
								user.organizationMemberships.filter((item) => !item.revokedAt)
									.length
							}{" "}
							organizações ·{" "}
							{
								user.costCenterMemberships.filter((item) => !item.revokedAt)
									.length
							}{" "}
							centros ·{" "}
							{user.workMemberships.filter((item) => !item.revokedAt).length}{" "}
							obras
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={ShieldCheck}
					title="Histórico de atividades"
					description="Ações registradas para este usuário."
				/>
				<CardContent>
					<Tabs
						value={historyView}
						onValueChange={(value) =>
							handleHistoryViewChange(value as HistoryView)
						}
					>
						<TabsList className="mb-4">
							<TabsTrigger value="all">Todas as ações</TabsTrigger>
							{hasDecisionHistory && (
								<>
									<TabsTrigger value="approvals">Aprovações</TabsTrigger>
									<TabsTrigger value="rejections">Rejeições</TabsTrigger>
								</>
							)}
						</TabsList>
						<TabsContent value={historyView}>
							{auditQuery.error ? (
								<ErrorFeedback onRetry={() => auditQuery.refetch()} />
							) : (
								<AuditLogTable
									rows={auditQuery.data?.data ?? []}
									total={auditQuery.data?.total ?? 0}
									page={auditPage}
									limit={50}
									filters={auditFilters}
									onFiltersChange={handleFiltersChange}
									onPageChange={setAuditPage}
									onOpenDetail={setAuditDetail}
									onOpenNavigationTarget={handleNavigation}
									showUserFilter={false}
								/>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
			<AuditEntryDetail
				entry={auditDetail}
				onOpenChange={(open) => {
					if (!open) setAuditDetail(null);
				}}
				onOpenNavigationTarget={handleNavigation}
			/>
		</PageContainer>
	);
}
