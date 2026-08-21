import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import {
	BarChart3,
	FileSpreadsheet,
	FileText,
	Pencil,
	Plus,
} from "lucide-react";
import { getCostCenterById } from "@/api/organizations";
import { costCenterKeys, workKeys } from "@/api/query-keys";
import { listWorks } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { PageHeader } from "@/components/atoms/page-header";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { WorkTable } from "@/organisms/works/work-table";
import { paginationSchema } from "@/schemas/pagination";
import type { PaginationMeta } from "@/types/shared";
import { getPaginationMeta } from "@/utils/pagination";

const ccWorksSearchSchema = paginationSchema;

export const Route = createFileRoute("/app/centros-de-custo/$ccId/")({
	validateSearch: ccWorksSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps }) => {
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: costCenterKeys.globalDetail(params.ccId),
				queryFn: () => getCostCenterById(params.ccId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.list({ costCenterId: params.ccId, ...deps.search }),
				queryFn: () => listWorks({ costCenterId: params.ccId, ...deps.search }),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Centro de Custo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { ccId } = useParams({
		from: "/app/centros-de-custo/$ccId/",
	});
	const { role } = useAuth();
	const canViewManagement = role !== "SUPERVISOR";
	const searchParams = useSearch({ from: Route.id });
	const navigate = Route.useNavigate();

	const {
		data: cc,
		isLoading: ccLoading,
		error: ccError,
	} = useQuery({
		queryKey: costCenterKeys.globalDetail(ccId),
		queryFn: () => getCostCenterById(ccId),
	});

	const {
		data: worksPage,
		isLoading: worksLoading,
		error: worksError,
	} = useQuery({
		queryKey: workKeys.list({ costCenterId: ccId, ...searchParams }),
		queryFn: () => listWorks({ costCenterId: ccId, ...searchParams }),
	});

	if (ccLoading || worksLoading)
		return <LoadingSpinner title="Carregando..." />;
	if (ccError || worksError) return <ErrorFeedback />;

	const works = worksPage?.data ?? [];
	const orgId = cc?.organization?.id ?? "";
	const workRows = works.map((work) => ({
		...work,
		orgId,
		ccId,
		organizationName: "",
		costCenterName: cc?.name ?? "",
	}));
	const hasWorks = workRows.length > 0;
	const paginationMeta: PaginationMeta | null = worksPage
		? getPaginationMeta(worksPage)
		: null;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Centro de Custo"
				title={cc?.name ?? ""}
				description="Obras"
				actions={
					<>
						<Link to="/app/centros-de-custo/$ccId/edit" params={{ ccId }}>
							<Button variant="outline">
								<Pencil className="mr-2 h-4 w-4" />
								Editar
							</Button>
						</Link>
						{canViewManagement ? (
							<Link
								to="/app/centros-de-custo/$ccId/relatorios"
								params={{ ccId }}
							>
								<Button variant="outline">
									<FileText className="mr-2 h-4 w-4" />
									Relatórios
								</Button>
							</Link>
						) : null}
						{canViewManagement ? (
							<Link
								to="/app/centros-de-custo/$ccId/multiobras"
								params={{ ccId }}
							>
								<Button variant="outline">
									<BarChart3 className="mr-2 h-4 w-4" />
									MultiObras
								</Button>
							</Link>
						) : null}
						<Link to="/app/centros-de-custo/new">
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Novo Centro
							</Button>
						</Link>
					</>
				}
			/>
			{!hasWorks ? (
				<EmptyStateCard
					icon={FileSpreadsheet}
					title="Nenhuma obra ainda"
					description="Cadastre sua primeira obra manualmente para começar."
					variant="dashed"
					actions={
						<Link to="/app/obras/new">
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Cadastrar obra
							</Button>
						</Link>
					}
				/>
			) : (
				<>
					<WorkTable works={workRows} />
					{paginationMeta && (
						<PaginationBar
							meta={paginationMeta}
							onPageChange={(page) =>
								navigate({ search: (prev) => ({ ...prev, page }) })
							}
						/>
					)}
				</>
			)}
		</PageContainer>
	);
}
