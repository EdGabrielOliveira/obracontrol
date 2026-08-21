import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { BarChart3, ScatterChart as ScatterChartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { getCostCenterBI, getCostCenterById } from "@/api/organizations";
import { biKeys, costCenterKeys } from "@/api/query-keys";
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

export const Route = createFileRoute("/app/centros-de-custo/$ccId/multiobras/")(
	{
		beforeLoad: requireManagementAccess,
		loader: async ({ params }) => {
			const cc = await queryClient.fetchQuery({
				queryKey: costCenterKeys.globalDetail(params.ccId),
				queryFn: () => getCostCenterById(params.ccId),
			});
			const orgId = cc?.organization?.id ?? "";
			await queryClient.prefetchQuery({
				queryKey: biKeys.costCenterOverview(orgId, params.ccId),
				queryFn: () => getCostCenterBI(orgId, params.ccId),
			});
		},
		component: RouteComponent,
		head: () => ({
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ title: "Análise do Centro de Custo - ObraControl" },
			],
		}),
	},
);

function RouteComponent() {
	const { ccId } = useParams({
		from: "/app/centros-de-custo/$ccId/multiobras/",
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

	const { data: cc } = useQuery({
		queryKey: costCenterKeys.globalDetail(ccId),
		queryFn: () => getCostCenterById(ccId),
	});

	const orgId = cc?.organization?.id ?? "";

	const { data: allData, isLoading: isAllLoading } = useQuery({
		queryKey: biKeys.costCenterOverview(orgId, ccId),
		queryFn: () => getCostCenterBI(orgId, ccId),
		enabled: !!orgId,
	});

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: biKeys.costCenterOverview(orgId, ccId, filter),
		queryFn: () => getCostCenterBI(orgId, ccId, filter),
		enabled: !!orgId,
	});

	const allWorkIds = useMemo(
		() => (allData?.works ?? []).map((w) => w.workId),
		[allData],
	);

	const toggleWork = (workId: string) => {
		setSelectedWorks((prev) => {
			const next = new Set(prev);
			if (next.has(workId)) {
				next.delete(workId);
			} else {
				next.add(workId);
			}
			return next;
		});
	};

	const toggleAll = () => {
		if (selectedWorks.size === allWorkIds.length) {
			setSelectedWorks(new Set());
		} else {
			setSelectedWorks(new Set(allWorkIds));
		}
	};

	const breadcrumbItems = useBreadcrumb({
		ccName: cc?.name,
		ccId,
		section: "Análise Multi-Obras",
	});

	if (isLoading || isAllLoading)
		return <LoadingSpinner title="Carregando análise..." />;
	if (error)
		return (
			<ErrorFeedback
				message="Erro ao carregar BI multi-obras."
				onRetry={() => refetch()}
			/>
		);
	if (!data) return null;

	const works = allData?.works ?? [];

	return (
		<PageContainer>
			<Breadcrumb items={breadcrumbItems} />
			<PageHeader
				eyebrow="Estatísticas"
				title="Análise do Centro de Custo"
				description="Comparativo das obras selecionadas no centro de custo."
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
