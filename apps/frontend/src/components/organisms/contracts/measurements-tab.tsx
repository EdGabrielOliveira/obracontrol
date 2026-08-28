import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { ClipboardList, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/atoms/empty-state";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { DataTable } from "@/components/atoms/data-table";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import {
	MEASUREMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import {
	type BudgetItemSelection,
	BudgetItemSelector,
} from "@/components/organisms/budget/budget-item-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { BudgetTreeItem } from "@/types/budget";
import type {
	ContractMeasurement,
	ContractService,
	CreateContractMeasurementInput,
} from "@/types/contracts";
import { formatDate, formatPercentage, formatQuantity } from "@/utils/format";

const measurementCreateSchema = z.object({
	title: z.string().min(1, "Titulo obrigatorio"),
	date: z.string().min(1, "Data obrigatoria"),
	notes: z.string().optional(),
});

type MeasurementCreateValues = z.infer<typeof measurementCreateSchema>;

type MeasurementWarningItem = {
	code: string;
	severity: "warning";
	message: string;
	measurementDate?: string;
	periodStart?: string | null;
	periodEnd?: string | null;
};

type MeasurementTableRow =
	| {
			kind: "measurement";
			measurement: ContractMeasurement;
			children?: MeasurementTableRow[];
	  }
	| {
			kind: "item";
			serviceName: string;
			unit: string;
			item: NonNullable<ContractMeasurement["items"]>[number];
	  };

const measurementTableHelper = createColumnHelper<MeasurementTableRow>();

interface MeasurementsTabProps {
	workId: string;
	contractId: string;
	measurements: ContractMeasurement[];
	services: ContractService[];
	isLoading: boolean;
	isError: boolean;
	isCreatingMeasurement?: boolean;
	onRetry: () => void;
	onCreateMeasurement?: (
		input: CreateContractMeasurementInput & {
			items?: Array<{
				serviceId: string;
				measuredQuantity: number;
			}>;
		},
	) => void;
	onDeleteMeasurement?: (id: string) => void;
	canChangeMeasurementStatus?: boolean;
	onOpenMeasurementStatus?: (measurement: ContractMeasurement) => void;
	isUpdatingMeasurementStatus?: boolean;
	searchValue?: string;
	onSearchChange?: (value: string) => void;

	warnings?: MeasurementWarningItem[];
	onDismissWarnings?: () => void;
}

export function MeasurementsTab({
	workId,
	contractId,
	measurements,
	services,
	isLoading,
	isError,
	isCreatingMeasurement,
	onRetry,
	onCreateMeasurement,
	onDeleteMeasurement,
	canChangeMeasurementStatus = false,
	onOpenMeasurementStatus,
	isUpdatingMeasurementStatus,
	searchValue,
	onSearchChange,
	warnings,
	onDismissWarnings,
}: MeasurementsTabProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [selectedServices, setSelectedServices] = useState<
		BudgetItemSelection[]
	>([]);
	const prevCreating = useRef(isCreatingMeasurement);
	const navigate = useNavigate();

	const serviceMap = useMemo(
		() => new Map(services.map((s) => [s.id, s])),
		[services],
	);
	const canCreateMeasurement = services.some(
		(service) => Number(service.remainingQuantity ?? service.quantity) > 0,
	);
	const selectorItems = useMemo<BudgetTreeItem[]>(
		() =>
			services.map((service, index) => ({
				id: service.id,
				parentId: null,
				index:
					service.budgetItem?.displayIndex ??
					service.budgetItem?.index ??
					`${index + 1}`,
				type: "ITEM",
				description: service.description,
				unit: service.unit,
				quantity: service.quantity,
				unitCost: service.unitCost,
				totalCost: service.totalCost,
				plannedStart: null,
				plannedEnd: null,
				completionPercentage: null,
				sortOrder: service.sortOrder,
				children: [],
			})),
		[services],
	);
	const availableQuantities = useMemo(
		() =>
			Object.fromEntries(
				services.map((service) => [
					service.id,
					Math.max(
						0,
						Number(service.remainingQuantity ?? service.quantity ?? 0),
					),
				]),
			),
		[services],
	);

	const createForm = useForm<MeasurementCreateValues>({
		resolver: zodResolver(measurementCreateSchema),
		defaultValues: {
			title: "",
			date: "",
		},
	});

	useEffect(() => {
		if (prevCreating.current && !isCreatingMeasurement) {
			setShowAdd(false);
		}
		prevCreating.current = isCreatingMeasurement;
	}, [isCreatingMeasurement]);

	const openAdd = () => {
		createForm.reset({
			title: "",
			date: "",
			notes: "",
		});
		setSelectedServices([]);
		setShowAdd(true);
	};

	const openEdit = (m: ContractMeasurement) => {
		navigate({
			to: "/app/obras/$workId/contratos/$contractId/medicoes/$measurementId/edit",
			params: { workId, contractId, measurementId: m.id },
		});
	};

	const measurementRows: MeasurementTableRow[] = measurements.map(
		(measurement) => ({
			kind: "measurement",
			measurement,
			children: (measurement.items ?? []).map((item) => {
				const service = serviceMap.get(item.serviceId);
				return {
					kind: "item",
					item,
					serviceName: service?.description ?? item.serviceId,
					unit: service?.unit ?? "",
				};
			}),
		}),
	);

	const measurementColumns = [
		measurementTableHelper.accessor(
			(row) =>
				row.kind === "measurement"
					? `#${row.measurement.number}`
					: row.serviceName,
			{
				id: "number",
				header: "#",
				cell: (info) => (
					<span className="font-mono text-xs">
						{info.row.original.kind === "measurement"
							? `#${info.row.original.measurement.number}`
							: ""}
					</span>
				),
				meta: { mobileLabel: "#" },
			},
		),
		measurementTableHelper.accessor(
			(row) => (row.kind === "measurement" ? row.measurement.date : ""),
			{
				id: "date",
				header: "Data",
				cell: (info) =>
					info.row.original.kind === "measurement"
						? formatDate(info.row.original.measurement.date)
						: "",
				meta: { mobileLabel: "Data" },
			},
		),
		measurementTableHelper.accessor(
			(row) =>
				row.kind === "measurement"
					? (row.measurement.title ?? "-")
					: row.serviceName,
			{
				id: "description",
				header: "Medição / Serviço",
				cell: (info) => {
					const row = info.row.original;
					if (row.kind === "measurement") {
						return (
							<span className="font-medium">
								{row.measurement.title ?? "-"}
							</span>
						);
					}
					return (
						<div className="text-xs">
							<div>{row.serviceName}</div>
							{row.unit && (
								<span className="text-muted-foreground">{row.unit}</span>
							)}
						</div>
					);
				},
				meta: { mobileLabel: "Medição / Serviço" },
			},
		),
		measurementTableHelper.accessor(
			(row) => (row.kind === "item" ? (row.item.measuredQuantity ?? 0) : null),
			{
				id: "quantity",
				header: "Qtd. medida",
				cell: (info) =>
					info.row.original.kind === "item"
						? formatQuantity(info.row.original.item.measuredQuantity)
						: "-",
				meta: { className: "text-right", mobileLabel: "Qtd. medida" },
			},
		),
		measurementTableHelper.accessor(
			(row) =>
				row.kind === "item" ? (row.item.measuredPercentage ?? 0) : null,
			{
				id: "percentage",
				header: "% medido",
				cell: (info) =>
					info.row.original.kind === "item" &&
					info.row.original.item.measuredPercentage != null
						? formatPercentage(info.row.original.item.measuredPercentage)
						: "-",
				meta: { className: "text-right", mobileLabel: "% medido" },
			},
		),
		measurementTableHelper.display({
			id: "status",
			header: "Status",
			cell: (info) => {
				const row = info.row.original;
				if (row.kind === "item") return null;
				return (
					<div className="flex flex-wrap gap-1">
						<StatusBadge
							status={row.measurement.status ?? "RASCUNHO"}
							map={MEASUREMENT_STATUS_MAP}
						/>
						{row.measurement.approvalStatus === "PENDING_APPROVAL" ? (
							<StatusBadge status="PENDING_APPROVAL" />
						) : null}
					</div>
				);
			},
			meta: { mobileLabel: "Status" },
		}),
		measurementTableHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const row = info.row.original;
				if (row.kind === "item") return null;
				return (
					<div className="flex justify-end gap-1" data-no-row-click>
						{canChangeMeasurementStatus ? (
							<Button
								variant="ghost"
								size="icon"
								title="Alterar status da medição"
								aria-label="Alterar status da medição"
								disabled={isUpdatingMeasurementStatus}
								onClick={() => onOpenMeasurementStatus?.(row.measurement)}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						) : null}
						<Button
							variant="ghost"
							size="icon"
							onClick={() => openEdit(row.measurement)}
						>
							<Pencil className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setDeleteId(row.measurement.id)}
						>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				);
			},
			meta: { className: "text-right", hideOnMobile: true },
		}),
	];

	if (isLoading) return <LoadingSpinner title="Carregando medições..." />;
	if (isError) return <ErrorFeedback onRetry={() => onRetry()} />;

	return (
		<Card>
			<CardHeaderWithIcon
				icon={ClipboardList}
				title="Medições do Contrato"
				description="Registre a quantidade executada por serviço do contrato."
				actions={
					<Button
						variant="default"
						size="sm"
						disabled={!canCreateMeasurement}
						onClick={openAdd}
					>
						<Plus className="mr-2 h-4 w-4" />
						Nova medição
					</Button>
				}
			/>
			<CardContent>
				{warnings && warnings.length > 0 && (
					<Alert className="mb-4">
						<AlertTitle className="flex items-center justify-between gap-2">
							<span>Atenção</span>
							<button
								type="button"
								onClick={onDismissWarnings}
								className="rounded p-0.5 text-muted-foreground hover:text-foreground"
								aria-label="Fechar avisos"
							>
								×
							</button>
						</AlertTitle>
						<AlertDescription>
							<ul className="list-disc pl-4">
								{warnings.map((warning) => (
									<li key={`${warning.code}-${warning.message}`}>
										{warning.message}
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}
				{!canCreateMeasurement && (
					<div className="status-warning mb-4 rounded-md px-3 py-2 text-sm">
						<p>
							Não há saldo disponível em nenhum serviço do contrato para medir.
						</p>
					</div>
				)}

				{measurements.length === 0 && !searchValue?.trim() ? (
					<EmptyState
						icon={<ClipboardList className="h-12 w-12" />}
						title="Nenhuma medição cadastrada."
						description={
							canCreateMeasurement
								? "Crie uma medição informando a quantidade executada por serviço."
								: "Todos os serviços já estão 100% medidos ou não possuem saldo contratado."
						}
					/>
				) : (
					<DataTable
						columns={measurementColumns}
						data={measurementRows}
						getSubRows={(row) =>
							row.kind === "measurement" && row.children?.length
								? row.children
								: undefined
						}
						searchPlaceholder="Buscar medições..."
						searchValue={searchValue}
						onSearchChange={onSearchChange}
						pageSize={10}
						emptyMessage="Nenhuma medição cadastrada."
					/>
				)}

				<Dialog open={showAdd} onOpenChange={setShowAdd}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Nova Medição</DialogTitle>
						</DialogHeader>
						<form
							onSubmit={createForm.handleSubmit((values) => {
								const items = selectedServices.flatMap((selection) =>
									selection.quantity > 0
										? [
												{
													serviceId: selection.budgetItemId,
													measuredQuantity: selection.quantity,
												},
											]
										: [],
								);

								if (items.length === 0) return;
								onCreateMeasurement?.({
									...values,
									items,
								});
							})}
							className="space-y-4"
						>
							<Controller
								name="title"
								control={createForm.control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Titulo"
										field={field}
										fieldState={fieldState}
										placeholder="Título da medição"
									/>
								)}
							/>
							<Controller
								name="date"
								control={createForm.control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Data"
										field={field}
										fieldState={fieldState}
										mode="datepicker"
									/>
								)}
							/>

							<Controller
								name="notes"
								control={createForm.control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Observação (opcional)"
										as="textarea"
										field={field}
										fieldState={fieldState}
										placeholder="Adicione uma observação, se necessário"
									/>
								)}
							/>

							<BudgetItemSelector
								workId={workId}
								budgetItems={selectorItems}
								selectedItems={selectedServices}
								onChange={setSelectedServices}
								disabledItemIds={
									new Set(
										services
											.filter((service) => availableQuantities[service.id] <= 0)
											.map((service) => service.id),
									)
								}
								availableQuantities={availableQuantities}
								showUnitPrice={false}
								quantityLabel="Quantidade medida"
								showMeasurementPercentage
								title="Serviços do contrato"
								description="Selecione os serviços e informe a quantidade desta medição."
							/>

							<div className="flex justify-end gap-2 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setShowAdd(false)}
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									disabled={
										!canCreateMeasurement ||
										selectedServices.length === 0 ||
										selectedServices.every(
											(selection) => selection.quantity <= 0,
										)
									}
								>
									Salvar
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>

				<ConfirmDialog
					open={!!deleteId}
					title="Excluir medição?"
					description="Esta ação não pode ser desfeita."
					onConfirm={() => {
						if (deleteId) onDeleteMeasurement?.(deleteId);
						setDeleteId(null);
					}}
					onCancel={() => setDeleteId(null)}
				/>
			</CardContent>
		</Card>
	);
}
