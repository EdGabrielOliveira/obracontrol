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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
	warnings,
	onDismissWarnings,
}: MeasurementsTabProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(
		new Set(),
	);
	const [measurementDraft, setMeasurementDraft] = useState<
		Record<string, { measuredQuantity: string }>
	>({});
	const prevCreating = useRef(isCreatingMeasurement);
	const navigate = useNavigate();

	const serviceMap = useMemo(
		() => new Map(services.map((s) => [s.id, s])),
		[services],
	);
	const canCreateMeasurement = services.some(
		(service) => Number(service.quantity) > 0,
	);
	const selectedServiceIdsWithQuantity = services
		.filter(
			(service) =>
				selectedServiceIds.has(service.id) && Number(service.quantity) > 0,
		)
		.map((service) => service.id);

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
		setSelectedServiceIds(new Set());
		setMeasurementDraft({});
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
				<div className="mb-4 flex flex-wrap gap-2">
					<Button
						variant="default"
						size="sm"
						disabled={!canCreateMeasurement}
						onClick={openAdd}
					>
						<Plus className="mr-2 h-4 w-4" />
						Nova medição
					</Button>
				</div>
				{!canCreateMeasurement && (
					<div className="status-warning mb-4 rounded-md px-3 py-2 text-sm">
						<p>
							Não há serviços do contrato com quantidade contratada para medir.
						</p>
					</div>
				)}

				{measurements.length === 0 ? (
					<EmptyState
						icon={<ClipboardList className="h-12 w-12" />}
						title="Nenhuma medição cadastrada."
						description={
								canCreateMeasurement
									? "Crie uma medição informando a quantidade executada por serviço."
									: "Cadastre serviços com quantidade contratada antes de criar medições."
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
								const items = selectedServiceIdsWithQuantity.flatMap((id) => {
									const rawQuantity = measurementDraft[id]?.measuredQuantity;
									if (!rawQuantity) return [];
									return [
										{
											serviceId: id,
											measuredQuantity: Number(rawQuantity),
										},
									];
								});

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

							<div className="space-y-2">
								<Label>Serviços</Label>
								<div className="max-h-72 overflow-y-auto rounded-md border border-border">
									{services.map((svc) => (
										<div
											key={svc.id}
											className="grid grid-cols-[auto_minmax(0,1fr)_6rem_6rem] gap-2 border-b border-border px-2 py-2 text-sm last:border-b-0"
										>
											<Checkbox
														checked={selectedServiceIds.has(svc.id)}
														disabled={Number(svc.quantity) <= 0}
														onCheckedChange={(checked) => {
															if (Number(svc.quantity) <= 0) return;
													setSelectedServiceIds((prev) => {
														const next = new Set(prev);
														if (checked) {
															next.add(svc.id);
														} else {
															next.delete(svc.id);
														}
														return next;
													});
												}}
											/>
											<div className="min-w-0">
												<div className="truncate font-medium">
													{svc.description}
												</div>
												<div className="text-xs text-muted-foreground">
													{svc.quantity ?? "—"} {svc.unit ?? ""} contratados
												</div>
											</div>
											<input
												type="number"
												min="0"
												step="0.0001"
												placeholder="Qtd"
												disabled={!selectedServiceIds.has(svc.id)}
												className="h-8 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50"
												value={measurementDraft[svc.id]?.measuredQuantity ?? ""}
												onChange={(event) =>
													setMeasurementDraft((prev) => ({
														...prev,
														[svc.id]: {
															measuredQuantity: event.target.value,
														},
													}))
												}
											/>
											<span className="self-center text-right text-xs text-muted-foreground">
												{(() => {
													const measured = Number(
														measurementDraft[svc.id]?.measuredQuantity,
													);
													const contracted = Number(svc.quantity);
													return measured > 0 && contracted > 0
														? formatPercentage((measured / contracted) * 100)
														: "—";
												})()}
											</span>
										</div>
									))}
									{services.length === 0 && (
										<p className="text-xs text-muted-foreground px-1 py-2">
											Cadastre serviços primeiro.
										</p>
									)}
								</div>
							</div>

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
																selectedServiceIdsWithQuantity.length === 0 ||
																selectedServiceIdsWithQuantity.every(
											(id) => !measurementDraft[id]?.measuredQuantity,
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
