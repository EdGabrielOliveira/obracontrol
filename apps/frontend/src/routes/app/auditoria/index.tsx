import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import { z } from "zod";
import { listAdminUsers } from "@/api/admin-users";
import { listAuditLogs } from "@/api/audit";
import { listCompanies } from "@/api/companies";
import { listAllCostCenters, listOrganizations } from "@/api/organizations";
import { auditKeys } from "@/api/query-keys";
import { listWorks } from "@/api/works";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { DataTable } from "@/components/atoms/data-table";
import { PageHeader } from "@/components/atoms/page-header";
import {
	AUDIT_ACTION_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { auditEntityLabel } from "@/lib/audit-labels";
import { queryClient } from "@/lib/query-client";
import { paginationSchema } from "@/schemas/pagination";
import type { AuditLogEntry } from "@/types/audit";
import type { PaginationMeta } from "@/types/shared";
import { formatDate } from "@/utils/format";
import { getPaginationMeta } from "@/utils/pagination";

const auditFilterSchema = z
	.object({
		entityType: z.string().optional(),
		action: z.string().optional(),
		userId: z.string().optional(),
		companyId: z.string().optional(),
		organizationId: z.string().optional(),
		costCenterId: z.string().optional(),
		workId: z.string().optional(),
	})
	.merge(paginationSchema);

type AuditFilter = z.infer<typeof auditFilterSchema>;

const _ENTITY_LABELS: Record<string, string> = {
	WORK_MEASUREMENT: "Medição de Obra",
	BUDGET_ITEM: "Item de Orçamento",
	ACTUAL_COST: "Custo Real",
	ORGANIZATION: "Organização",
	COST_CENTER: "Centro de Custo",
	WORK: "Obra",
	CONTRACT: "Contrato",
	CONTRACT_MEASUREMENT: "Medição de Contrato",
	WORK_MEMBERSHIP: "Membros da Obra",
	CONSTRUCTION_MEASUREMENT: "Medição (Legado)",
};

const auditColumnHelper = createColumnHelper<AuditLogEntry>();

export const Route = createFileRoute("/app/auditoria/")({
	validateSearch: auditFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps }) => {
		void queryClient.prefetchQuery({
			queryKey: auditKeys.list(deps.search as Record<string, unknown>),
			queryFn: () => listAuditLogs(deps.search as Record<string, unknown>),
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Auditoria - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const searchParams = useSearch({ from: Route.id }) as AuditFilter;
	const navigate = useNavigate({ from: Route.id });

	const { data, isLoading, error } = useQuery({
		queryKey: auditKeys.list(searchParams as Record<string, unknown>),
		queryFn: () => listAuditLogs(searchParams as Record<string, unknown>),
	});
	const { data: users } = useQuery({
		queryKey: ["audit-filter-users"],
		queryFn: () => listAdminUsers({ limit: 100 }),
	});
	const { data: companies } = useQuery({
		queryKey: ["audit-filter-companies"],
		queryFn: listCompanies,
	});
	const { data: organizations } = useQuery({
		queryKey: ["audit-filter-organizations"],
		queryFn: () => listOrganizations({ limit: 100 }),
	});
	const { data: costCenters } = useQuery({
		queryKey: ["audit-filter-cost-centers"],
		queryFn: () => listAllCostCenters({ limit: 100 }),
	});
	const { data: works } = useQuery({
		queryKey: ["audit-filter-works"],
		queryFn: () => listWorks({ limit: 100 }),
	});

	const handlePageChange = (page: number) => {
		navigate({ search: (prev) => ({ ...prev, page }) });
	};
	const setFilter = (key: keyof AuditFilter, value: string) => {
		navigate({
			search: (prev) => ({ ...prev, [key]: value || undefined, page: 1 }),
		});
	};

	if (isLoading) return <LoadingSpinner title="Carregando logs..." />;
	if (error) return <ErrorFeedback />;

	const logList = data?.data ?? [];
	const userOptions = users?.data ?? [];
	const companyOptions = companies ?? [];
	const organizationOptions = organizations?.data ?? [];
	const costCenterOptions = costCenters?.data ?? [];
	const workOptions = works?.data ?? [];
	const paginationMeta: PaginationMeta | null = data
		? getPaginationMeta(data)
		: null;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração"
				title="Auditoria"
				description="Registro de alterações feitas no sistema."
			/>
			<div className="mb-6 flex gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				<Select
					value={searchParams.userId ?? "all"}
					onValueChange={(v) => setFilter("userId", v === "all" ? "" : v)}
				>
					<SelectTrigger>
						<SelectValue placeholder="Usuário" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos os usuários</SelectItem>
						{userOptions.map((user) => (
							<SelectItem key={user.id} value={user.id}>
								{user.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={searchParams.companyId ?? "all"}
					onValueChange={(v) => setFilter("companyId", v === "all" ? "" : v)}
				>
					<SelectTrigger>
						<SelectValue placeholder="Empresa" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todas as empresas</SelectItem>
						{companyOptions.map((company) => (
							<SelectItem key={company.id} value={company.id}>
								{company.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={searchParams.organizationId ?? "all"}
					onValueChange={(v) =>
						setFilter("organizationId", v === "all" ? "" : v)
					}
				>
					<SelectTrigger>
						<SelectValue placeholder="Organização" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todas as organizações</SelectItem>
						{organizationOptions.map((organization) => (
							<SelectItem key={organization.id} value={organization.id}>
								{organization.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={searchParams.costCenterId ?? "all"}
					onValueChange={(v) => setFilter("costCenterId", v === "all" ? "" : v)}
				>
					<SelectTrigger>
						<SelectValue placeholder="Centro de custo" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos os centros</SelectItem>
						{costCenterOptions.map((center) => (
							<SelectItem key={center.id} value={center.id}>
								{center.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={searchParams.workId ?? "all"}
					onValueChange={(v) => setFilter("workId", v === "all" ? "" : v)}
				>
					<SelectTrigger>
						<SelectValue placeholder="Obra" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todas as obras</SelectItem>
						{workOptions.map((work) => (
							<SelectItem key={work.id} value={work.id}>
								{work.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{logList.length === 0 ? (
				<EmptyState
					icon={<FileSearch className="h-12 w-12" />}
					title="Nenhum registro encontrado"
					description="Nenhuma alteração foi registrada com os filtros atuais."
				/>
			) : (
				<div>
					<DataTable
						columns={[
							auditColumnHelper.accessor("createdAt", {
								header: "Data/Hora",
								cell: ({ getValue }) => formatDate(getValue()),
							}),
							auditColumnHelper.display({
								id: "user",
								header: "Usuário",
								cell: ({ row }) =>
									row.original.user.name || row.original.user.email,
							}),
							auditColumnHelper.accessor("action", {
								header: "Ação",
								cell: ({ getValue }) => (
									<StatusBadge
										status={getValue()}
										map={AUDIT_ACTION_STATUS_MAP}
									/>
								),
							}),
							auditColumnHelper.accessor("entityType", {
								header: "Entidade",
								cell: ({ getValue }) => auditEntityLabel(getValue()),
							}),
							auditColumnHelper.display({
								id: "description",
								header: "Descrição",
								cell: ({ row }) =>
									row.original.entityDescription || row.original.entityId,
							}),
						]}
						data={logList}
						searchPlaceholder="Buscar auditoria..."
						emptyMessage="Nenhum registro encontrado."
					/>

					{paginationMeta && (
						<PaginationBar
							meta={paginationMeta}
							onPageChange={handlePageChange}
						/>
					)}
				</div>
			)}
		</PageContainer>
	);
}
