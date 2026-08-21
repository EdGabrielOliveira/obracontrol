import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { BarChart3, ScatterChart as ScatterChartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { getOrganization, getOrganizationBI } from "@/api/organizations";
import { biKeys, organizationKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { DataSection } from "@/components/atoms/data-section";
import { PageHeader } from "@/components/atoms/page-header";
import { CriticalAlerts } from "@/components/organisms/bi/critical-alerts";
import { HealthCards } from "@/components/organisms/bi/health-cards";
import {
	CustoPorObraChart,
	SpiCpiScatterChart,
} from "@/components/organisms/bi/portfolio-charts";
import { Rankings } from "@/components/organisms/bi/rankings";
import { WorksHealthTable } from "@/components/organisms/bi/works-health-table";
import { Breadcrumb } from "@/components/organisms/layout/breadcrumb";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";
import { useBreadcrumb } from "@/lib/use-breadcrumb";

export const Route = createFileRoute("/app/organizacoes/$orgId/multicentros/")({
	beforeLoad: requireManagementAccess,
	loader: async ({ params }) => {
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: organizationKeys.detail(params.orgId),
				queryFn: () => getOrganization(params.orgId),
			}),
			queryClient.prefetchQuery({
				queryKey: biKeys.overview(params.orgId),
				queryFn: () => getOrganizationBI(params.orgId),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Análise da Organização - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { orgId } = useParams({
		from: "/app/organizacoes/$orgId/multicentros/",
	});
	const [selectedWorks, setSelectedWorks] = useState<Set<string>>(new Set());
	const selectedWorkIds = useMemo(
		() => Array.from(selectedWorks),
		[selectedWorks],
	);
	const filter = useMemo(
		() => (selectedWorkIds.length > 0 ? { workIds: selectedWorkIds } : {}),
		[selectedWorkIds],
	);

	const { data: allData, isLoading: isAllLoading } = useQuery({
		queryKey: biKeys.overview(orgId),
		queryFn: () => getOrganizationBI(orgId),
	});

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: biKeys.overview(orgId, filter),
		queryFn: () => getOrganizationBI(orgId, filter),
	});

	const { data: org } = useQuery({
		queryKey: organizationKeys.detail(orgId),
		queryFn: () => getOrganization(orgId),
	});

	const breadcrumbItems = useBreadcrumb({
		orgName: org?.name,
		orgId,
		section: "Análise Multi-Centros",
	});

	if (isLoading || isAllLoading)
		return <LoadingSpinner title="Carregando análise..." />;
	if (error)
		return (
			<ErrorFeedback
				message="Erro ao carregar BI multi-centros."
				onRetry={() => refetch()}
			/>
		);
	if (!data) return null;
	const works = allData?.works ?? [];
	const allWorkIds = works.map((work) => work.workId);
	const toggleWork = (workId: string) => {
		setSelectedWorks((current) => {
			const next = new Set(current);
			if (next.has(workId)) next.delete(workId);
			else next.add(workId);
			return next;
		});
	};
	const toggleAll = () => {
		setSelectedWorks((current) =>
			current.size === allWorkIds.length ? new Set() : new Set(allWorkIds),
		);
	};

	return (
		<PageContainer>
			<Breadcrumb items={breadcrumbItems} />
			<PageHeader
				eyebrow="Estatísticas"
				title="Análise da Organização"
				description="Indicadores das obras selecionadas nesta organização."
			/>
			<div className="space-y-6">
				<HealthCards cards={data.cards} works={data.works ?? []} />
				<CriticalAlerts works={works} />
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
					<DataSection
						title="Custo por Obra"
						icon={BarChart3}
						description="Planejado vs agregado vs real por obra"
						className="min-w-0 h-full"
					>
						<CustoPorObraChart data={data.portfolioChart} />
					</DataSection>
					<DataSection
						title="SPI × CPI"
						icon={ScatterChartIcon}
						description="Posicionamento de cada obra por SPI e CPI"
						className="min-w-0 h-full"
					>
						<SpiCpiScatterChart works={works} />
					</DataSection>
				</div>
				<Rankings rankings={data.rankings} />
				{works.length > 0 && (
					<WorksHealthTable
						works={works}
						selected={selectedWorks}
						allSelected={selectedWorks.size === allWorkIds.length}
						onToggle={toggleWork}
						onToggleAll={toggleAll}
					/>
				)}
			</div>
		</PageContainer>
	);
}
