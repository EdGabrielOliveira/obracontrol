import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Download, HardHat } from "lucide-react";
import { toast } from "sonner";
import { getCostCenterById } from "@/api/organizations";
import { costCenterKeys } from "@/api/query-keys";
import { downloadCostCenterPdf, getOrgCostCenterReport } from "@/api/reports";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { StatusBadge } from "@/atoms/status-badge";
import { DataSection } from "@/components/atoms/data-section";
import { PageHeader } from "@/components/atoms/page-header";
import { BarChartCard } from "@/components/organisms/charts/bar-chart-card";
import { PieChartCard } from "@/components/organisms/charts/pie-chart-card";
import { CostCenterReportKpis } from "@/components/organisms/organizations/cost-center-report-kpis";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";
import { formatCurrency } from "@/utils/format";

export const Route = createFileRoute("/app/centros-de-custo/$ccId/relatorios/")(
	{
		beforeLoad: requireManagementAccess,
		component: RouteComponent,
		head: () => ({
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ title: "Relatório do Centro de Custo - ObraControl" },
			],
		}),
		loader: async ({ params }) => {
			const cc = await queryClient.fetchQuery({
				queryKey: costCenterKeys.globalDetail(params.ccId),
				queryFn: () => getCostCenterById(params.ccId),
			});
			const orgId = cc?.organization?.id ?? "";
			await queryClient.prefetchQuery({
				queryKey: costCenterKeys.orgScopedReport(orgId, params.ccId),
				queryFn: () => getOrgCostCenterReport(orgId, params.ccId),
			});
		},
	},
);

function RouteComponent() {
	const { ccId } = useParams({
		from: "/app/centros-de-custo/$ccId/relatorios/",
	});

	const { data: cc } = useQuery({
		queryKey: costCenterKeys.globalDetail(ccId),
		queryFn: () => getCostCenterById(ccId),
	});

	const orgId = cc?.organization?.id ?? "";

	const { data, isLoading, error } = useQuery({
		queryKey: costCenterKeys.orgScopedReport(orgId, ccId),
		queryFn: () => getOrgCostCenterReport(orgId, ccId),
		enabled: !!orgId,
	});

	if (!cc || isLoading)
		return <LoadingSpinner title="Carregando relatório..." />;
	if (error || !data) return <ErrorFeedback />;

	const r = data;
	const summary = r.summary;

	const works = r.works;
	const hasWorks = Array.isArray(works) && works.length > 0;

	const worksComparison = works?.map((w) => ({
		name: w.name,
		value: w.budgeted,
	}));
	const hasWorksChart =
		Array.isArray(worksComparison) && worksComparison.length > 0;

	const budgetDistribution = works?.map((w) => ({
		name: w.name,
		value: w.spent,
	}));
	const hasBudgetChart =
		Array.isArray(budgetDistribution) && budgetDistribution.length > 0;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Centro de Custo"
				title="Relatório do Centro de Custo"
				description="Métricas e gráficos do centro de custo."
			/>
			<div className="mb-6 flex justify-end">
				<Button
					onClick={async () => {
						try {
							const blob = await downloadCostCenterPdf(ccId);
							downloadBlob(blob, `relatorio-cc-${ccId}.pdf`);
							toast.success("PDF gerado com sucesso!");
						} catch {
							toast.error("Erro ao gerar PDF.");
						}
					}}
				>
					<Download className="mr-2 h-4 w-4" />
					Baixar PDF
				</Button>
			</div>
			<CostCenterReportKpis summary={summary} />

			<div className="mt-6 grid gap-6 lg:grid-cols-2">
				{hasWorksChart && (
					<BarChartCard
						title="Comparativo entre Obras"
						data={worksComparison}
						dataKey="value"
					/>
				)}
				{hasBudgetChart && (
					<Card>
						<CardContent>
							<PieChartCard
								title="Distribuição de Orçamento"
								data={budgetDistribution}
							/>
						</CardContent>
					</Card>
				)}
			</div>

			{hasWorks && (
				<DataSection
					icon={HardHat}
					title="Obras"
					description={`${works.length} obra(s) no centro de custo`}
					className="mt-6"
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Obra</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Orçamento</TableHead>
								<TableHead className="text-right">Gasto</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{works.map((w) => (
								<TableRow key={w.id}>
									<TableCell>{w.name}</TableCell>
									<TableCell>
										<StatusBadge status={w.status} />
									</TableCell>
									<TableCell className="text-right">
										{formatCurrency(w.budgeted)}
									</TableCell>
									<TableCell className="text-right">
										{formatCurrency(w.spent)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</DataSection>
			)}
		</PageContainer>
	);
}
