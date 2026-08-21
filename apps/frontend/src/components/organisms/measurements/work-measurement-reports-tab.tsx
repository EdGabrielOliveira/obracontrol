import { createColumnHelper } from "@tanstack/react-table";
import { BarChart3, TrendingUp } from "lucide-react";
import { BarChartComponent } from "@/components/atoms/bar-chart";
import { DataTable } from "@/components/atoms/data-table";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkMeasurementReportsResponse } from "@/types/measurements";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

interface WorkMeasurementReportsTabProps {
	data: WorkMeasurementReportsResponse;
}

export function WorkMeasurementReportsTab({
	data,
}: WorkMeasurementReportsTabProps) {
	const { measurementByStage, plannedVsMeasured } = data;

	const stageColumnHelper = createColumnHelper<{
		stage: string;
		budgeted: number;
		measured: number;
		percentage: number;
	}>();

	const stageColumns = [
		stageColumnHelper.accessor("stage", {
			header: "Etapa",
		}),
		stageColumnHelper.accessor("budgeted", {
			header: "Orçado",
			cell: (info) => formatCurrency(info.getValue()),
			meta: { className: "text-right" },
		}),
		stageColumnHelper.accessor("measured", {
			header: "Medido",
			cell: (info) => formatCurrency(info.getValue()),
			meta: { className: "text-right" },
		}),
		stageColumnHelper.accessor("percentage", {
			header: "%",
			cell: (info) => formatRatioAsPercentage(info.getValue()),
			meta: { className: "text-right" },
		}),
	];

	const plannedVsMeasuredColumnHelper = createColumnHelper<{
		month: string;
		measured: number;
		measuredAccumulated: number;
		performance: number;
	}>();

	const plannedVsMeasuredColumns = [
		plannedVsMeasuredColumnHelper.accessor("month", {
			header: "Mês",
		}),
		plannedVsMeasuredColumnHelper.accessor("measured", {
			header: "Medido",
			cell: (info) => formatCurrency(info.getValue()),
			meta: { className: "text-right" },
		}),
		plannedVsMeasuredColumnHelper.accessor("measuredAccumulated", {
			header: "Medido Acum.",
			cell: (info) => formatCurrency(info.getValue()),
			meta: { className: "text-right" },
		}),
		plannedVsMeasuredColumnHelper.accessor("performance", {
			header: "Performance",
			cell: (info) => formatRatioAsPercentage(info.getValue()),
			meta: { className: "text-right" },
		}),
	];

	return (
		<div className="space-y-6">
			{measurementByStage.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Medição por Etapa"
						description="Orçado vs. medido por etapa"
					/>
					<CardContent>
						<div className="mb-4 h-64">
							<BarChartComponent
								currency
								data={measurementByStage.map((s) => ({
									name: s.stage,
									Orçado: s.budgeted,
									Medido: s.measured,
								}))}
							/>
						</div>
						<DataTable
							columns={stageColumns}
							data={measurementByStage}
							searchPlaceholder="Buscar etapas..."
							pageSize={10}
						/>
					</CardContent>
				</Card>
			)}

			{plannedVsMeasured.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={TrendingUp}
						title="Planejado x Medido (Mensal)"
						description="Acompanhamento mensal do planejado vs. medido"
					/>
					<CardContent>
						<div className="mb-4 h-64">
							<BarChartComponent
								currency
								data={plannedVsMeasured.map((p) => ({
									name: p.month,
									Planejado: p.plannedAccumulated,
									Medido: p.measuredAccumulated,
								}))}
							/>
						</div>
						<DataTable
							columns={plannedVsMeasuredColumns}
							data={plannedVsMeasured}
							searchPlaceholder="Buscar meses..."
							pageSize={10}
						/>
					</CardContent>
				</Card>
			)}

			{measurementByStage.length === 0 && plannedVsMeasured.length === 0 && (
				<EmptyStateCard
					icon={BarChart3}
					title="Nenhum dado de relatório"
					description="Crie medições para visualizar relatórios."
				/>
			)}
		</div>
	);
}
