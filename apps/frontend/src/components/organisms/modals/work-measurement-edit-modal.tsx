import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { governanceKeys, workKeys } from "@/api/query-keys";
import { updateWorkMeasurement } from "@/api/work-measurements";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { hydrateEditItems } from "@/lib/work-measurement-edit-hydration";
import {
	type MeasurementEditValues,
	measurementEditSchema,
} from "@/schemas/measurements";
import type {
	MeasurementApprovalStatus,
	MeasurementWarning,
	WorkMeasurement,
} from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";
import { formatCurrency, formatPercentage } from "@/utils/format";

interface WorkMeasurementEditModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	embedded?: boolean;
	workId: string;
	measurement: WorkMeasurement;
	budgetOptions: { id: string; value: string; label: string }[];

	coveredItemIds?: Set<string>;

	onResult?: (result: {
		warnings?: MeasurementWarning[];
		approvalStatus?: MeasurementApprovalStatus;
	}) => void;
}

function readOnlyValue(
	value: number | null | undefined,
	format?: (v: number) => string,
) {
	if (value == null) return "—";
	return format ? format(value) : value.toLocaleString("pt-BR");
}

export function WorkMeasurementEditModal({
	open,
	onOpenChange,
	embedded = false,
	workId,
	measurement,
	budgetOptions,
	coveredItemIds,
	onResult,
}: WorkMeasurementEditModalProps) {
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	const { control, handleSubmit, reset } = useForm<MeasurementEditValues>({
		resolver: zodResolver(measurementEditSchema),
	});

	const { fields, append, remove, replace } = useFieldArray({
		control,
		name: "items",
	});

	useEffect(() => {
		if (open) {
			const rows = hydrateEditItems(measurement.items);
			reset({
				title: measurement.title,
				date: measurement.date?.slice(0, 10) ?? "",
				items: rows,
				balanceOverride: false,
				evidenceNote: "",
			});
			replace(rows);
		}
	}, [open, reset, replace, measurement]);

	const mutation = useMutation({
		mutationFn: (values: MeasurementEditValues) =>
			updateWorkMeasurement(workId, measurement.id, {
				title: values.title,
				date: values.date,
				items: values.items.map((item) => ({
					id: item.id || undefined,
					budgetItemId: item.budgetItemId,
					measuredQuantity: Number(item.measuredQuantity),
				})),
			}),
		onSuccess: (result) => {
			toast.success("Medição atualizada!");
			if (result.warnings?.length) {
				onResult?.({
					warnings: result.warnings,
					approvalStatus: result.approvalStatus,
				});
			}
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementDetail(workId, measurement.id),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementsBase(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementMap(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementReports(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.measurementSummary(workId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.budget(workId) });
			queryClient.invalidateQueries({
				queryKey: workKeys.physicalFinancialBase(workId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
			queryClient.invalidateQueries({
				queryKey: governanceKeys.pendingApprovals(workId),
			});
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar medição.")),
		onSettled: () => setSubmitting(false),
	});

	const onSubmit = (values: MeasurementEditValues) => {
		setSubmitting(true);
		mutation.mutate(values);
	};

	const content = (
		<>
			<DialogHeader>
				<DialogTitle>Editar medição #{measurement.number}</DialogTitle>
				<DialogDescription>Altere os dados da medição.</DialogDescription>
			</DialogHeader>
			<form
				onSubmit={handleSubmit(onSubmit)}
				className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
			>
				<Controller
					name="title"
					control={control}
					render={({ field, fieldState }) => (
						<InputFormField
							label="Título"
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

				<div className="space-y-2 rounded-lg border p-3">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Itens da Medição</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() =>
								append({
									budgetItemId: "",
									measuredQuantity: "",
								})
							}
						>
							<Plus className="mr-1 h-3.5 w-3.5" />
							Adicionar item
						</Button>
					</div>

					{fields.map((field, index) => {
						const backendItem = measurement.items?.find(
							(item) => item.id === field.id,
						);
						const covered = coveredItemIds?.has(field.id ?? "") ?? false;
						return (
							<div
								key={field.id}
								className="flex items-start gap-2 rounded-md border p-2"
							>
								<div className="flex-1 space-y-2">
									<Controller
										name={`items.${index}.budgetItemId`}
										control={control}
										render={({ field: f, fieldState: fs }) => (
											<SelectFormField
												label="Item"
												placeholder="Selecione um item"
												options={budgetOptions}
												field={f}
												fieldState={fs}
												disabled={covered}
											/>
										)}
									/>
									<div className="grid grid-cols-2 gap-2">
										<Controller
											name={`items.${index}.measuredQuantity`}
											control={control}
											render={({ field: f, fieldState: fs }) => (
												<InputFormField
													label="Qtd medida"
													field={f}
													fieldState={fs}
													type="number"
													step="0.0001"
													placeholder="0"
													disabled={covered}
												/>
											)}
										/>
									</div>
									{backendItem && (
										<div className="rounded-md bg-muted/40 p-2 text-xs">
											<p className="mb-1 font-medium text-muted-foreground">
												Valores calculados pelo backend
											</p>
											<div className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums sm:grid-cols-3">
												<span>
													Valor medido:{" "}
													{readOnlyValue(
														backendItem.measuredValue,
														formatCurrency,
													)}
												</span>
												<span>
													% medido:{" "}
													{readOnlyValue(
														backendItem.measuredPercentage,
														formatPercentage,
													)}
												</span>
												<span>
													Qtd acumulada:{" "}
													{readOnlyValue(backendItem.accumulatedQuantity)}
												</span>
												<span>
													Valor acumulado:{" "}
													{readOnlyValue(
														backendItem.accumulatedValue,
														formatCurrency,
													)}
												</span>
												<span>
													% acumulado:{" "}
													{readOnlyValue(
														backendItem.accumulatedPercentage,
														formatPercentage,
													)}
												</span>
												{backendItem.availableQuantity != null && (
													<span>
														Disponível:{" "}
														{readOnlyValue(backendItem.availableQuantity)}
													</span>
												)}
												{backendItem.impactStatus && (
													<span>
														Status:{" "}
														{backendItem.impactStatus === "PENDING_APPROVAL"
															? "Aguardando aprovação"
															: "Aprovado"}
													</span>
												)}
											</div>
										</div>
									)}
									{covered && (
										<p className="status-warning rounded-md px-2 py-1 text-xs">
											Item com cobertura contratual — edição bloqueada. Remova a
											cobertura para alterar a quantidade.
										</p>
									)}
								</div>
								{fields.length > 1 && !covered && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="mt-6 shrink-0"
										onClick={() => remove(index)}
									>
										<Minus className="h-4 w-4 text-destructive" />
									</Button>
								)}
							</div>
						);
					})}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancelar
					</Button>
					<Button type="submit" loading={submitting}>
						Salvar
					</Button>
				</DialogFooter>
			</form>
		</>
	);
	if (embedded) return <div className="space-y-4">{content}</div>;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>{content}</DialogContent>
		</Dialog>
	);
}
