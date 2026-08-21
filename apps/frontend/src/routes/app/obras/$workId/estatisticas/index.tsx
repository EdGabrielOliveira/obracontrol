import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { getWorkBI } from "@/api/bi";
import { getWorkManagement } from "@/api/management";
import { workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { StatisticsTab } from "@/components/organisms/works/statistics-tab";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";

export const Route = createFileRoute("/app/obras/$workId/estatisticas/")({
	beforeLoad: requireManagementAccess,
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.detail(params.workId),
				queryFn: () => getWork(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.bi(params.workId),
				queryFn: () => getWorkBI(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.management(params.workId),
				queryFn: () => getWorkManagement(params.workId),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Estatísticas - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({ from: "/app/obras/$workId/estatisticas/" });
	const workQuery = useQuery({
		queryKey: workKeys.detail(workId),
		queryFn: () => getWork(workId),
	});
	const biQuery = useQuery({
		queryKey: workKeys.bi(workId),
		queryFn: () => getWorkBI(workId),
	});
	const managementQuery = useQuery({
		queryKey: workKeys.management(workId),
		queryFn: () => getWorkManagement(workId),
	});

	if (workQuery.isLoading) return <LoadingSpinner title="Carregando obra..." />;
	if (workQuery.error || !workQuery.data) {
		return (
			<ErrorFeedback
				message="Obra não encontrada."
				onRetry={() => workQuery.refetch()}
			/>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title={`Estatísticas — ${workQuery.data.name}`}
				description="Indicadores detalhados, saúde, fornecedores e movimentações por período."
			/>
			<StatisticsTab
				workId={workId}
				bi={biQuery.data}
				mgmt={managementQuery.data}
				loading={biQuery.isLoading || managementQuery.isLoading}
				error={biQuery.error ?? managementQuery.error}
				onRetry={() => {
					void biQuery.refetch();
					void managementQuery.refetch();
				}}
			/>
		</PageContainer>
	);
}
