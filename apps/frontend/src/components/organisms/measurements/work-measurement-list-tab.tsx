import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	ClipboardList,
	Download,
	ExternalLink,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { ImportBatchAction } from "@/components/organisms/imports/import-batch-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MeasurementFilter } from "@/schemas/measurementFilter";
import type { WorkMeasurement } from "@/types/measurements";
import { formatCurrency, formatDate } from "@/utils/format";

interface WorkMeasurementListTabProps {
	measurements: WorkMeasurement[];
	searchParams: MeasurementFilter;
	onSearchChange: (patch: Partial<MeasurementFilter>) => void;
	onCreate: () => void;
	onEdit: (m: WorkMeasurement) => void;
	onDelete: (id: string) => void;
	currentPage: number;
	totalPages: number;
	workId: string;
}

const helper = createColumnHelper<WorkMeasurement>();

export function WorkMeasurementListTab({
	measurements,
	onCreate,
	onEdit,
	onDelete,
	workId,
}: WorkMeasurementListTabProps) {
	if (measurements.length === 0) {
		return (
			<EmptyStateCard
				icon={ClipboardList}
				title="Nenhuma medição encontrada"
				description="Crie uma medição manual ou importe uma planilha."
				actions={
					<>
						<Button variant="default" size="sm" onClick={onCreate}>
							<Plus className="mr-2 h-4 w-4" />
							Nova medição
						</Button>
						<ImportBatchAction
							workId={workId}
							model="medicao-obra"
							buttonProps={{ variant: "outline", size: "sm" }}
						>
							<Download className="mr-2 h-4 w-4" />
							Importar planilha
						</ImportBatchAction>
					</>
				}
			/>
		);
	}

	const measurementColumns = [
		helper.accessor("number", {
			header: "#",
			cell: (info) => {
				const m = info.row.original;
				return (
					<Link
						to="/app/obras/$workId/medicoes/$measurementId"
						params={{
							workId,
							measurementId: m.id,
						}}
						className="link-navigation font-mono text-xs"
					>
						{info.getValue()}
					</Link>
				);
			},
			meta: { mobileLabel: "#" },
		}),
		helper.accessor("date", {
			header: "Data",
			cell: (info) => formatDate(info.getValue()),
			meta: { mobileLabel: "Data" },
		}),
		helper.accessor("title", {
			header: "Título",
			cell: (info) => {
				const m = info.row.original;
				return (
					<Link
						to="/app/obras/$workId/medicoes/$measurementId"
						params={{
							workId,
							measurementId: m.id,
						}}
						className="link-navigation"
					>
						{info.getValue()}
					</Link>
				);
			},
			meta: { mobileLabel: "Título" },
		}),
		helper.accessor("totalMeasuredValue", {
			header: "Valor",
			cell: (info) => (
				<span className="text-right font-medium tabular-nums">
					{formatCurrency(info.getValue())}
				</span>
			),
			meta: { mobileLabel: "Valor" },
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const m = info.row.original;
				return (
					<div
						className="flex items-center justify-end gap-1"
						data-no-row-click
					>
						<Button variant="outline" size="xs" asChild>
							<Link
								to="/app/obras/$workId/medicoes/$measurementId"
								params={{
									workId,
									measurementId: m.id,
								}}
							>
								<ExternalLink className="h-3 w-3" />
								Ver detalhe
							</Link>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={(e) => {
								e.stopPropagation();
								onEdit(m);
							}}
						>
							<Pencil className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={(e) => {
								e.stopPropagation();
								onDelete(m.id);
							}}
						>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				);
			},
			meta: { hideOnMobile: true },
		}),
	];

	return (
		<Card>
			<CardHeaderWithIcon
				icon={ClipboardList}
				title="Medições da Obra"
				description={`${measurements.length} medição(ões) registrada(s)`}
			/>
			<CardContent>
				<DataTable
					columns={measurementColumns}
					data={measurements}
					searchPlaceholder="Buscar medições..."
					pageSize={10}
				/>
			</CardContent>
		</Card>
	);
}
