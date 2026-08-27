import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	ClipboardList,
	Download,
	Pencil,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import {
	MEASUREMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
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
	canChangeStatus?: boolean;
	onOpenStatus?: (measurement: WorkMeasurement) => void;
	isUpdatingStatus?: boolean;
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
	canChangeStatus = false,
	onOpenStatus,
	isUpdatingStatus,
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
		helper.accessor("date", {
			header: "Data",
			cell: (info) => formatDate(info.getValue()),
			meta: { mobileLabel: "Data" },
		}),
		helper.display({
			id: "status",
			header: "Status",
			cell: (info) => {
				const status = info.row.original.status ?? "RASCUNHO";
				return (
					<div className="flex flex-wrap gap-1">
						<StatusBadge status={status} map={MEASUREMENT_STATUS_MAP} />
						{info.row.original.approvalStatus === "PENDING_APPROVAL" ? (
							<StatusBadge status="PENDING_APPROVAL" />
						) : null}
					</div>
				);
			},
			meta: { mobileLabel: "Status" },
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
						{canChangeStatus ? (
							<Button
								variant="ghost"
								size="icon"
								title="Alterar status da medição"
								aria-label="Alterar status da medição"
								disabled={isUpdatingStatus}
								onClick={(e) => {
									e.stopPropagation();
									onOpenStatus?.(m);
								}}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						) : null}
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
