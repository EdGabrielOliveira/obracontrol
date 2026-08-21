import { createColumnHelper } from "@tanstack/react-table";
import { ClipboardList, Network } from "lucide-react";
import { KpiCard } from "@/atoms/kpi-card";
import { DataTable } from "@/components/atoms/data-table";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type {
	MeasurementTreeItem,
	WorkMeasurementMapResponse,
} from "@/types/measurements";
import { formatCurrency, formatDate, formatPercentage } from "@/utils/format";

interface WorkMeasurementMapTabProps {
	data: WorkMeasurementMapResponse;
}

const measurementTreeColumnHelper = createColumnHelper<MeasurementTreeItem>();

export const measurementTreeColumns = [
	measurementTreeColumnHelper.accessor("index", {
		header: "Índice",
		cell: (info) => info.getValue(),
		meta: { className: "font-mono text-xs" },
	}),
	measurementTreeColumnHelper.accessor("description", {
		header: "Descrição",
	}),
	measurementTreeColumnHelper.accessor("totalCost", {
		header: "Orçado",
		cell: (info) => formatCurrency(info.getValue()),
		meta: { className: "text-right" },
	}),
	measurementTreeColumnHelper.accessor("measuredCurrent", {
		header: "% Medido",
		cell: (info) => formatPercentage(info.getValue()?.percentage ?? 0),
		meta: { className: "text-right" },
	}),
	measurementTreeColumnHelper.display({
		id: "measuredValue",
		header: "Valor Medido",
		cell: (info) =>
			formatCurrency(info.row.original.measuredCurrent?.value ?? 0),
		meta: { className: "text-right" },
	}),
	measurementTreeColumnHelper.display({
		id: "balance",
		header: "Saldo",
		cell: (info) =>
			formatCurrency(info.row.original.balanceToMeasure?.value ?? 0),
		meta: { className: "text-right" },
	}),
];

const workMeasurementColumnHelper = createColumnHelper<{
	id: string;
	number: number;
	date: string;
	title: string;
	totalMeasured: number;
}>();

const workMeasurementColumns = [
	workMeasurementColumnHelper.accessor("number", {
		header: "#",
		cell: (info) => info.getValue(),
		meta: { className: "font-mono text-xs" },
	}),
	workMeasurementColumnHelper.accessor("date", {
		header: "Data",
		cell: (info) => formatDate(info.getValue()),
	}),
	workMeasurementColumnHelper.accessor("title", {
		header: "Título",
	}),
	workMeasurementColumnHelper.accessor("totalMeasured", {
		header: "Total Medido",
		cell: (info) => formatCurrency(info.getValue()),
		meta: { className: "text-right font-medium" },
	}),
];

export function WorkMeasurementMapTab({ data }: WorkMeasurementMapTabProps) {
	const { items, totals, workMeasurements } = data;

	return (
		<div className="space-y-6">
			<KpiGrid>
				<KpiCard title="Total Orçado" value={formatCurrency(totals.budgeted)} />
				<KpiCard title="Total Medido" value={formatCurrency(totals.measured)} />
				<KpiCard title="Saldo" value={formatCurrency(totals.balance)} />
			</KpiGrid>

			<Card>
				<CardHeaderWithIcon
					icon={Network}
					title="Mapa Hierárquico"
					description="Visualização hierárquica dos itens de medição"
				/>
				<CardContent>
					<DataTable
						columns={measurementTreeColumns}
						data={items}
						getSubRows={(item) =>
							item.children && item.children.length > 0
								? item.children
								: undefined
						}
						searchPlaceholder="Buscar itens..."
						pageSize={50}
					/>
				</CardContent>
			</Card>

			{workMeasurements.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={ClipboardList}
						title="Medições da Obra"
						description="Lista de medições realizadas na obra"
					/>
					<CardContent>
						<DataTable
							columns={workMeasurementColumns}
							data={workMeasurements}
							searchPlaceholder="Buscar medições..."
							pageSize={10}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
