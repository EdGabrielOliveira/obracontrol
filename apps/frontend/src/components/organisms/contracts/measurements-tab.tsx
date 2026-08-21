import { zodResolver } from "@hookform/resolvers/zod";
import {
	ChevronDown,
	ChevronRight,
	ClipboardList,
	Download,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/atoms/empty-state";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import { ContractMeasurementImportAction } from "@/components/organisms/contracts/contract-measurement-import-action";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	canCreateContractMeasurement,
	filterBudgetCoveredServiceIds,
	hasDirectBudgetCoverage,
} from "@/lib/contract-measurement-guards";
import type {
	ContractMeasurement,
	ContractMeasurementItem,
	ContractService,
	CreateContractMeasurementInput,
} from "@/types/contracts";
import {
	formatCurrency,
	formatDate,
	formatPercentage,
	formatQuantity,
} from "@/utils/format";

const measurementCreateSchema = z.object({
	title: z.string().min(1, "Titulo obrigatorio"),
	date: z.string().min(1, "Data obrigatoria"),
	taxValue: z.string().optional(),
});

const measurementEditSchema = z.object({
	title: z.string().min(1, "Titulo obrigatorio"),
	date: z.string().min(1, "Data obrigatoria"),
});

const measurementItemSchema = z.object({
	measuredQuantity: z.string().optional(),
	measuredPercentage: z.string().optional(),
});

type MeasurementCreateValues = z.infer<typeof measurementCreateSchema>;
type MeasurementEditValues = z.infer<typeof measurementEditSchema>;
type MeasurementItemFormValues = z.infer<typeof measurementItemSchema>;

type MeasurementWarningItem = {
	code: string;
	severity: "warning";
	message: string;
	measurementDate?: string;
	periodStart?: string | null;
	periodEnd?: string | null;
};

interface MeasurementsTabProps {
	workId: string;
	contractId: string;
	measurements: ContractMeasurement[];
	services: ContractService[];
	effectiveBudgetVersionId?: string | null;
	isLoading: boolean;
	isError: boolean;
	isCreatingMeasurement?: boolean;
	isEditingMeasurement?: boolean;
	isUpdatingItems?: boolean;
	onRetry: () => void;
	onOpenServices?: () => void;
	onCreateMeasurement?: (
		input: CreateContractMeasurementInput & {
			items?: Array<{
				serviceId: string;
				measuredQuantity?: number;
				measuredPercentage?: number;
			}>;
		},
	) => void;
	onEditMeasurement?: (id: string, values: MeasurementEditValues) => void;
	onDeleteMeasurement?: (id: string) => void;
	onUpdateMeasurementItems?: (
		measurementId: string,
		items: Array<{
			id?: string;
			serviceId: string;
			measuredQuantity?: number | null;
			measuredValue?: number | null;
			measuredPercentage?: number | null;
			accumulatedQuantity?: number | null;
			accumulatedValue?: number | null;
			accumulatedPercentage?: number | null;
		}>,
	) => void;

	warnings?: MeasurementWarningItem[];
	onDismissWarnings?: () => void;
}

interface ItemEditTarget {
	measurementId: string;
	item: ContractMeasurementItem;
	serviceName: string;
	allItems: ContractMeasurementItem[];
}

export function MeasurementsTab({
	workId,
	contractId,
	measurements,
	services,
	effectiveBudgetVersionId,
	isLoading,
	isError,
	isCreatingMeasurement,
	isEditingMeasurement,
	isUpdatingItems,
	onRetry,
	onOpenServices,
	onCreateMeasurement,
	onEditMeasurement,
	onDeleteMeasurement,
	onUpdateMeasurementItems,
	warnings,
	onDismissWarnings,
}: MeasurementsTabProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [editMeasurementId, setEditMeasurementId] = useState<string | null>(
		null,
	);
	const [editMeasurement, setEditMeasurement] =
		useState<ContractMeasurement | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [editItemTarget, setEditItemTarget] = useState<ItemEditTarget | null>(
		null,
	);
	const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(
		new Set(),
	);
	const [measurementDraft, setMeasurementDraft] = useState<
		Record<string, { measuredQuantity: string; measuredPercentage: string }>
	>({});
	const prevCreating = useRef(isCreatingMeasurement);
	const prevEditing = useRef(isEditingMeasurement);
	const prevUpdating = useRef(isUpdatingItems);

	const serviceMap = new Map(services.map((s) => [s.id, s]));
	const canCreateMeasurement = canCreateContractMeasurement(
		services,
		effectiveBudgetVersionId,
	);
	const coveredSelectedServiceIds = filterBudgetCoveredServiceIds(
		[...selectedServiceIds],
		services,
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

	useEffect(() => {
		if (prevEditing.current && !isEditingMeasurement) {
			setEditMeasurementId(null);
			setEditMeasurement(null);
		}
		prevEditing.current = isEditingMeasurement;
	}, [isEditingMeasurement]);

	useEffect(() => {
		if (prevUpdating.current && !isUpdatingItems) {
			setEditItemTarget(null);
		}
		prevUpdating.current = isUpdatingItems;
	}, [isUpdatingItems]);

	const openAdd = () => {
		createForm.reset({
			title: "",
			date: "",
			taxValue: "",
		});
		setSelectedServiceIds(new Set());
		setMeasurementDraft({});
		setShowAdd(true);
	};

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const openEdit = (m: ContractMeasurement) => {
		setEditMeasurement(m);
		setEditMeasurementId(m.id);
	};

	if (isLoading) return <LoadingSpinner title="Carregando medições..." />;
	if (isError) return <ErrorFeedback onRetry={() => onRetry()} />;

	return (
		<Card>
			<CardHeaderWithIcon
				icon={ClipboardList}
				title="Medições do Contrato"
				description="Gerencie as medições e os valores medidos."
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

				{measurements.length === 0 ? (
					<EmptyState
						icon={<ClipboardList className="h-12 w-12" />}
						title="Nenhuma medição cadastrada."
						description={
							canCreateMeasurement
								? "Crie medições para o contrato."
								: effectiveBudgetVersionId
									? "Vincule ao menos um serviço ao orçamento vigente para criar medições."
									: "A versão efetiva do orçamento ainda não está disponível para criar medições."
						}
					/>
				) : (
					<div className="space-y-2">
						{measurements.map((m) => {
							const isExpanded = expandedIds.has(m.id);
							const items = (m.items ?? []).map((item) => {
								const svc = serviceMap.get(item.serviceId);
								return {
									...item,
									serviceName: svc?.description ?? item.serviceId,
									unit: svc?.unit ?? "",
								};
							});

							return (
								<div key={m.id} className="rounded-lg border border-border">
									{/* biome-ignore lint/a11y/useSemanticElements: div needed to avoid nested <button> which is invalid HTML */}
									<div
										role="button"
										tabIndex={0}
										onClick={() => toggleExpand(m.id)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ")
												toggleExpand(m.id);
										}}
										className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
									>
										{isExpanded ? (
											<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
										) : (
											<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
										)}
										<span className="text-xs font-mono text-muted-foreground min-w-[2ch]">
											#{m.number}
										</span>
										<span className="text-sm">{formatDate(m.date)}</span>
										<span className="text-sm font-medium truncate flex-1">
											{m.title}
										</span>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
											onClick={(e) => {
												e.stopPropagation();
												openEdit(m);
											}}
										>
											<Pencil className="h-3.5 w-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
											onClick={(e) => {
												e.stopPropagation();
												setDeleteId(m.id);
											}}
										>
											<Trash2 className="h-3.5 w-3.5 text-destructive" />
										</Button>
										{!canCreateMeasurement && (
											<div className="status-warning basis-full rounded-md px-3 py-2 text-sm">
												<p>
													{effectiveBudgetVersionId
														? "Vincule ao menos um serviço ao orçamento vigente para criar medições."
														: "A versão efetiva do orçamento ainda não está disponível para criar medições."}
												</p>
												{onOpenServices && (
													<Button
														variant="link"
														className="h-auto px-0 text-warning"
														onClick={onOpenServices}
													>
														Vincular serviço ao orçamento
													</Button>
												)}
											</div>
										)}
									</div>

									{isExpanded && items.length > 0 && (
										<div className="border-t border-border overflow-x-auto">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Serviço</TableHead>
														<TableHead className="text-right">
															Qtd Medida
														</TableHead>
														<TableHead className="text-right">
															Valor Medido
														</TableHead>
														<TableHead className="text-right">
															% Medido
														</TableHead>
														<TableHead className="text-right">
															Qtd Acumulada
														</TableHead>
														<TableHead className="text-right">
															Valor Acumulado
														</TableHead>
														<TableHead className="text-right">
															% Acumulado
														</TableHead>
														<TableHead className="text-right">
															<span className="sr-only">Ações</span>
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{items.map((item) => {
														const svc = serviceMap.get(item.serviceId);
														return (
															<TableRow key={item.id}>
																<TableCell className="text-xs">
																	<div>{item.serviceName}</div>
																	{svc?.unit && (
																		<span className="text-muted-foreground">
																			{svc.unit}
																		</span>
																	)}
																</TableCell>
																<TableCell className="text-right">
																	{formatQuantity(item.measuredQuantity)}
																</TableCell>
																<TableCell className="text-right">
																	{item.measuredValue != null
																		? formatCurrency(item.measuredValue)
																		: "—"}
																</TableCell>
																<TableCell className="text-right">
																	{item.measuredPercentage != null
																		? formatPercentage(item.measuredPercentage)
																		: "—"}
																</TableCell>
																<TableCell className="text-right">
																	{formatQuantity(item.accumulatedQuantity)}
																</TableCell>
																<TableCell className="text-right">
																	{item.accumulatedValue != null
																		? formatCurrency(item.accumulatedValue)
																		: "—"}
																</TableCell>
																<TableCell className="text-right">
																	{item.accumulatedPercentage != null
																		? formatPercentage(
																				item.accumulatedPercentage,
																			)
																		: "—"}
																</TableCell>
																<TableCell className="text-right">
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7"
																		onClick={() =>
																			setEditItemTarget({
																				measurementId: m.id,
																				item,
																				serviceName: item.serviceName,
																				allItems: items,
																			})
																		}
																	>
																		<Pencil className="h-3.5 w-3.5" />
																	</Button>
																</TableCell>
															</TableRow>
														);
													})}
												</TableBody>
											</Table>
										</div>
									)}

									{isExpanded && items.length === 0 && (
										<div className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
											Nenhum item vinculado.
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

				<Dialog open={showAdd} onOpenChange={setShowAdd}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Nova Medição</DialogTitle>
						</DialogHeader>
						<form
							onSubmit={createForm.handleSubmit((values) => {
								const items = coveredSelectedServiceIds
									.map((id) => {
										const draft = measurementDraft[id];
										const measuredQuantity = draft?.measuredQuantity
											? Number(draft.measuredQuantity)
											: undefined;
										const measuredPercentage = draft?.measuredPercentage
											? Number(draft.measuredPercentage)
											: undefined;

										return {
											serviceId: id,
											measuredQuantity,
											measuredPercentage,
										};
									})
									.filter(
										(item) =>
											item.measuredQuantity !== undefined ||
											item.measuredPercentage !== undefined,
									);

								if (items.length === 0) return;
								onCreateMeasurement?.({
									...values,
									taxValue: values.taxValue
										? Number(values.taxValue)
										: undefined,
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
								name="taxValue"
								control={createForm.control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Valor de impostos"
										field={field}
										fieldState={fieldState}
										type="number"
										step="0.01"
										placeholder="0.00"
									/>
								)}
							/>

							<div className="space-y-2">
								<Label>Serviços</Label>
								<div className="max-h-72 overflow-y-auto rounded-md border border-border">
									{services.map((svc) => (
										<div
											key={svc.id}
											className="grid grid-cols-[auto_minmax(0,1fr)_5rem_5rem] gap-2 border-b border-border px-2 py-2 text-sm last:border-b-0"
										>
											<Checkbox
												checked={
													hasDirectBudgetCoverage(svc) &&
													selectedServiceIds.has(svc.id)
												}
												disabled={!hasDirectBudgetCoverage(svc)}
												onCheckedChange={(checked) => {
													if (!hasDirectBudgetCoverage(svc)) return;
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
													{svc.quantity ?? "—"} {svc.unit ?? ""} · Custo unit.{" "}
													{svc.unitCost != null
														? formatCurrency(svc.unitCost)
														: "—"}{" "}
													· Total{" "}
													{svc.totalCost != null
														? formatCurrency(svc.totalCost)
														: "—"}
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
															measuredPercentage:
																prev[svc.id]?.measuredPercentage ?? "",
														},
													}))
												}
											/>
											<input
												type="number"
												min="0"
												max="100"
												step="0.01"
												placeholder="%"
												disabled={!selectedServiceIds.has(svc.id)}
												className="h-8 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50"
												value={
													measurementDraft[svc.id]?.measuredPercentage ?? ""
												}
												onChange={(event) =>
													setMeasurementDraft((prev) => ({
														...prev,
														[svc.id]: {
															measuredQuantity:
																prev[svc.id]?.measuredQuantity ?? "",
															measuredPercentage: event.target.value,
														},
													}))
												}
											/>
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
										coveredSelectedServiceIds.length === 0 ||
										coveredSelectedServiceIds.every(
											(id) =>
												!measurementDraft[id]?.measuredQuantity &&
												!measurementDraft[id]?.measuredPercentage,
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

				{editMeasurementId && editMeasurement && (
					<EditMeasurementDialog
						open={!!editMeasurementId}
						onOpenChange={(open) => {
							if (!open) {
								setEditMeasurementId(null);
								setEditMeasurement(null);
							}
						}}
						defaultValues={{
							title: editMeasurement.title ?? "",
							date: editMeasurement.date?.slice(0, 10) ?? "",
						}}
						onSubmit={(values) =>
							onEditMeasurement?.(editMeasurement.id, values)
						}
					/>
				)}

				{editItemTarget && (
					<EditItemDialog
						open={!!editItemTarget}
						onOpenChange={(open) => {
							if (!open) setEditItemTarget(null);
						}}
						measurementId={editItemTarget.measurementId}
						serviceId={editItemTarget.item.serviceId}
						allItems={editItemTarget.allItems}
						serviceName={editItemTarget.serviceName}
						onUpdateItems={onUpdateMeasurementItems}
					/>
				)}
			</CardContent>
		</Card>
	);
}

interface EditMeasurementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultValues: MeasurementEditValues;
	onSubmit: (values: MeasurementEditValues) => void;
	isPending?: boolean;
}

function EditMeasurementDialog({
	open,
	onOpenChange,
	defaultValues,
	onSubmit,
	isPending,
}: EditMeasurementDialogProps) {
	const { control, handleSubmit } = useForm<MeasurementEditValues>({
		resolver: zodResolver(measurementEditSchema),
		defaultValues,
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar Medição</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
					<Controller
						name="title"
						control={control}
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
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Data"
								field={field}
								fieldState={fieldState}
								mode="datepicker"
							/>
						)}
					/>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" loading={isPending}>
							Salvar
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface EditItemDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	measurementId: string;
	allItems: ContractMeasurementItem[];
	serviceId: string;
	serviceName: string;
	onUpdateItems?: (
		measurementId: string,
		items: Array<{
			id?: string;
			serviceId: string;
			measuredQuantity?: number | null;
			measuredValue?: number | null;
			measuredPercentage?: number | null;
			accumulatedQuantity?: number | null;
			accumulatedValue?: number | null;
			accumulatedPercentage?: number | null;
		}>,
	) => void;
}

function EditItemDialog({
	open,
	onOpenChange,
	measurementId,
	allItems,
	serviceId,
	serviceName,
	onUpdateItems,
}: EditItemDialogProps) {
	const currentItem = allItems.find((i) => i.serviceId === serviceId);
	const { control, handleSubmit } = useForm<MeasurementItemFormValues>({
		resolver: zodResolver(measurementItemSchema),
		defaultValues: {
			measuredQuantity:
				currentItem?.measuredQuantity != null
					? String(currentItem.measuredQuantity)
					: "",
			measuredPercentage:
				currentItem?.measuredPercentage != null
					? String(currentItem.measuredPercentage)
					: "",
		},
	});

	const handleSaveItem = (values: MeasurementItemFormValues) => {
		const updatedItems = allItems.map((i) =>
			i.serviceId === serviceId
				? {
						...i,
						measuredQuantity: values.measuredQuantity
							? Number(values.measuredQuantity)
							: undefined,
						measuredPercentage: values.measuredPercentage
							? Number(values.measuredPercentage)
							: undefined,
					}
				: i,
		);
		onUpdateItems?.(measurementId, updatedItems);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar Item da Medição</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">{serviceName}</p>
				<form onSubmit={handleSubmit(handleSaveItem)} className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="measuredQuantity"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Quantidade Medida"
									field={field}
									fieldState={fieldState}
									type="number"
									step="0.0001"
									placeholder="0"
								/>
							)}
						/>
						<Controller
							name="measuredPercentage"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="% Medido"
									field={field}
									fieldState={fieldState}
									type="number"
									min="0"
									max="100"
									step="0.01"
									placeholder="0"
								/>
							)}
						/>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit">Salvar</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
