import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { FileDown, Info, Layers, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { workKeys } from "@/api/query-keys";
import {
	downloadWorkMeasurementPdf,
	getWorkMeasurement,
} from "@/api/work-measurements";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { MeasurementDetailCharts } from "@/components/organisms/measurements/measurement-detail-charts";
import { MeasurementDetailHeader } from "@/components/organisms/measurements/measurement-detail-header";
import { MeasurementItemTree } from "@/components/organisms/measurements/measurement-item-tree";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { formatCurrency, formatDate } from "@/utils/format";

export const Route = createFileRoute(
	"/app/obras/$workId/medicoes/$measurementId/",
)({
	loader: async ({ params }) => {
		await queryClient.prefetchQuery({
			queryKey: workKeys.measurementDetail(params.workId, params.measurementId),
			queryFn: () => getWorkMeasurement(params.workId, params.measurementId),
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Detalhe da Medição - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, measurementId } = useParams({
		from: "/app/obras/$workId/medicoes/$measurementId/",
	});

	const navigate = useNavigate();
	const [downloading, setDownloading] = useState(false);

	const handleDownloadPdf = useCallback(async () => {
		setDownloading(true);
		try {
			const blob = await downloadWorkMeasurementPdf(workId, measurementId);
			downloadBlob(blob, `boletim-medicao-${measurementId}.pdf`);
		} finally {
			setDownloading(false);
		}
	}, [workId, measurementId]);

	const { data, isLoading, error } = useQuery({
		queryKey: workKeys.measurementDetail(workId, measurementId),
		queryFn: () => getWorkMeasurement(workId, measurementId),
	});

	if (isLoading) return <LoadingSpinner title="Carregando medição..." />;
	if (error) return <ErrorFeedback />;
	if (!data) return <LoadingSpinner />;

	const { measurement, items, totals, budgetSummary } = data;

	return (
		<PageContainer>
			<MeasurementDetailHeader
				number={measurement.number}
				title={measurement.title}
				date={measurement.date}
				totalMeasuredValue={measurement.totalMeasuredValue}
				currentMeasuredValue={measurement.currentMeasuredValue}
				discountValue={measurement.discountValue}
				retentionValue={measurement.retentionValue}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							disabled={downloading}
							onClick={handleDownloadPdf}
						>
							<FileDown className="mr-2 h-4 w-4" />
							{downloading ? "Baixando..." : "Baixar boletim"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/app/obras/$workId/medicoes/$measurementId/edit",
									params: { workId, measurementId },
								})
							}
						>
							<Pencil className="mr-2 h-4 w-4" />
							Editar
						</Button>
					</>
				}
			/>

			<div className="mt-6 space-y-6">
				<Card>
					<CardHeaderWithIcon
						icon={Info}
						title="Dados da Medição"
						description="Informações gerais da medição."
					/>
					<CardContent>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<p className="text-xs text-muted-foreground">Número</p>
								<p className="font-mono text-sm">#{measurement.number}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Data</p>
								<p className="text-sm">{formatDate(measurement.date)}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Criado em</p>
								<p className="text-sm">{formatDate(measurement.createdAt)}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Criado por</p>
								<p className="text-sm">
									{measurement.createdByName || "Não informado"}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Desconto</p>
								<p className="text-sm">
									{formatCurrency(measurement.discountValue ?? 0)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Retenção</p>
								<p className="text-sm">
									{formatCurrency(measurement.retentionValue ?? 0)}
								</p>
							</div>
						</div>
						{measurement.notes && (
							<div className="mt-4">
								<p className="text-xs text-muted-foreground">Observações</p>
								<p className="text-sm">{measurement.notes}</p>
							</div>
						)}
					</CardContent>
				</Card>

				{budgetSummary && (
					<Card>
						<CardHeaderWithIcon
							icon={Layers}
							title="Resumo do Orçamento"
							description="Orçado, medido e saldo da obra."
						/>
						<CardContent>
							<KpiGrid>
								<KpiCard
									title="Total Orçado"
									value={formatCurrency(budgetSummary.totalBudgeted)}
								/>
								<KpiCard
									title="Total Medido"
									value={formatCurrency(budgetSummary.totalMeasured)}
									tone="success"
								/>
								<KpiCard
									title="Saldo a Medir"
									value={formatCurrency(budgetSummary.balanceToMeasure)}
									tone="warning"
								/>
							</KpiGrid>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeaderWithIcon
						icon={Layers}
						title="Itens da Medição"
						description="Itens medidos nesta medição."
					/>
					<CardContent>
						<MeasurementItemTree items={items} totals={totals} />
					</CardContent>
				</Card>

				<MeasurementDetailCharts
					items={items}
					totals={totals}
					budgetSummary={budgetSummary}
				/>
			</div>
		</PageContainer>
	);
}
