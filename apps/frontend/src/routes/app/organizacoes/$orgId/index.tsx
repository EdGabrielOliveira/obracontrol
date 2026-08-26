import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { BarChart3, FileText, Pencil, Plus } from "lucide-react";
import { getOrganization, listCostCenters } from "@/api/organizations";
import { costCenterKeys, organizationKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient as prefetchClient } from "@/lib/query-client";
import { CostCenterTable } from "@/organisms/organizations/cost-center-table";
import { paginationSchema } from "@/schemas/pagination";
import type { PaginationMeta } from "@/types/shared";
import { getPaginationMeta } from "@/utils/pagination";

const orgCostCentersSearchSchema = paginationSchema;

export const Route = createFileRoute("/app/organizacoes/$orgId/")({
	validateSearch: orgCostCentersSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps }) => {
		await Promise.all([
			prefetchClient.prefetchQuery({
				queryKey: organizationKeys.detail(params.orgId),
				queryFn: () => getOrganization(params.orgId),
			}),
			prefetchClient.prefetchQuery({
				queryKey: costCenterKeys.list(params.orgId, deps.search),
				queryFn: () => listCostCenters(params.orgId, deps.search),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Órgão - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { orgId } = useParams({ from: "/app/organizacoes/$orgId/" });
	const { role, capabilities } = useAuth();
	const canEditOrganization =
		role === "ADMIN" || capabilities?.canAdministerCompanies === true;
	const canViewManagement = role !== "SUPERVISOR";
	const searchParams = useSearch({ from: Route.id });
	const navigate = Route.useNavigate();

	const {
		data: org,
		isLoading: orgLoading,
		error: orgError,
	} = useQuery({
		queryKey: organizationKeys.detail(orgId),
		queryFn: () => getOrganization(orgId),
	});

	const {
		data: centers,
		isLoading: centersLoading,
		error: centersError,
	} = useQuery({
		queryKey: costCenterKeys.list(orgId, searchParams),
		queryFn: () => listCostCenters(orgId, searchParams),
	});

	if (orgLoading || centersLoading)
		return <LoadingSpinner title="Carregando..." />;
	if (orgError || centersError) return <ErrorFeedback />;

	const centerList = centers?.data ?? [];
	const paginationMeta: PaginationMeta | null = centers
		? getPaginationMeta(centers)
		: null;

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					eyebrow="Órgão"
					title={org?.name ?? ""}
					description={
						role === "ADMIN" && org?.company?.name
							? `Empresa: ${org.company.name}`
							: "Centros de custo e obras"
					}
					actions={
						<>
							{canEditOrganization ? (
								<Link to="/app/organizacoes/$orgId/edit" params={{ orgId }}>
									<Button variant="outline" size="sm">
										<Pencil className="mr-2 h-4 w-4" />
										Editar
									</Button>
								</Link>
							) : null}
							{canViewManagement ? (
								<>
									<Link
										to="/app/organizacoes/$orgId/relatorios"
										params={{ orgId }}
									>
										<Button variant="outline" size="sm">
											<FileText className="mr-2 h-4 w-4" />
											Relatórios
										</Button>
									</Link>
									<Link
										to="/app/organizacoes/$orgId/multicentros"
										params={{ orgId }}
									>
										<Button variant="outline" size="sm">
											<BarChart3 className="mr-2 h-4 w-4" />
											MultiCentros
										</Button>
									</Link>
								</>
							) : null}
							<Link
								to="/app/centros-de-custo/new"
								search={{ organizationId: orgId }}
							>
								<Button size="sm">
									<Plus className="mr-2 h-4 w-4" />
									Novo Centro
								</Button>
							</Link>
						</>
					}
				/>
			}
		>
			<CostCenterTable costCenters={centerList} />
			{paginationMeta && (
				<PaginationBar
					meta={paginationMeta}
					onPageChange={(page) =>
						navigate({ search: (prev) => ({ ...prev, page }) })
					}
				/>
			)}
		</PageContainer>
	);
}
