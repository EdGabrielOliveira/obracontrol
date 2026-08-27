import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { governanceKeys, workKeys } from "@/api/query-keys";
import { updateWorkMeasurement } from "@/api/work-measurements";
import { InputFormField } from "@/components/molecules/FormField";
import { BudgetItemSelector } from "@/components/organisms/budget/budget-item-selector";
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
import type { BudgetTreeItem } from "@/types/budget";
import type {
	MeasurementApprovalStatus,
	MeasurementWarning,
	WorkMeasurement,
} from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";

interface WorkMeasurementEditModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	embedded?: boolean;
	workId: string;
	measurement: WorkMeasurement;
	budgetItems: BudgetTreeItem[];
	coveredItemIds?: Set<string>;
	onResult?: (result: {
		warnings?: MeasurementWarning[];
		approvalStatus?: MeasurementApprovalStatus;
	}) => void;
}

export function WorkMeasurementEditModal({
	open,
	onOpenChange,
	embedded = false,
	workId,
	measurement,
	budgetItems,
	coveredItemIds,
	onResult,
}: WorkMeasurementEditModalProps) {
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const { control, handleSubmit, reset, watch } =
		useForm<MeasurementEditValues>({
			resolver: zodResolver(measurementEditSchema),
		});
	const { replace } = useFieldArray({ control, name: "items" });
	const items = watch("items") ?? [];
	const coveredBudgetItemIds = new Set(
		(measurement.items ?? [])
			.filter((item) => coveredItemIds?.has(item.id) ?? false)
			.map((item) => item.budgetItemId),
	);

	useEffect(() => {
		if (!open) return;
		const rows = hydrateEditItems(measurement.items);
		reset({
			title: measurement.title,
			date: measurement.date?.slice(0, 10) ?? "",
			items: rows,
			balanceOverride: false,
			evidenceNote: "",
		});
		replace(rows);
	}, [measurement, open, replace, reset]);

	const mutation = useMutation({
		mutationFn: (values: MeasurementEditValues) =>
			updateWorkMeasurement(workId, measurement.id, {
				title: values.title,
				date: values.date,
				items: values.items.map((item) => ({
					id: item.id || undefined,
					budgetItemId: item.budgetItemId,
					measuredQuantity: Number(item.measuredQuantity),
					...(item.measuredPercentage
						? { measuredPercentage: Number(item.measuredPercentage) }
						: {}),
				})),
			}),
		onSuccess: (result) => {
			toast.success("Medição atualizada!");
			if (result.warnings?.length)
				onResult?.({
					warnings: result.warnings,
					approvalStatus: result.approvalStatus,
				});
			for (const queryKey of [
				workKeys.measurementDetail(workId, measurement.id),
				workKeys.measurementsBase(workId),
				workKeys.measurementMap(workId),
				workKeys.measurementReports(workId),
				workKeys.measurementSummary(workId),
				workKeys.budget(workId),
				workKeys.physicalFinancialBase(workId),
				workKeys.bi(workId),
				workKeys.reports(workId),
				governanceKeys.pendingApprovals(workId),
			])
				queryClient.invalidateQueries({ queryKey });
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar medição.")),
		onSettled: () => setSubmitting(false),
	});

	const content = (
		<>
			{!embedded && (
				<DialogHeader>
					<DialogTitle>Editar medição #{measurement.number}</DialogTitle>
					<DialogDescription>Altere os dados da medição.</DialogDescription>
				</DialogHeader>
			)}
			<form
				onSubmit={handleSubmit((values) => {
					setSubmitting(true);
					mutation.mutate(values);
				})}
				className={
					embedded ? "space-y-6" : "max-h-[70vh] space-y-4 overflow-y-auto pr-1"
				}
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
				<div
					className={
						embedded
							? "space-y-3 rounded-lg border border-border p-4"
							: "space-y-2 rounded-lg border p-3"
					}
				>
					<span className="text-sm font-medium">Itens da Medição</span>
					<BudgetItemSelector
						workId={workId}
						budgetItems={budgetItems}
						selectedItems={items
							.filter((item) => item.budgetItemId)
							.map((item) => ({
								budgetItemId: item.budgetItemId,
								quantity: Number(item.measuredQuantity) || 0,
								...(item.measuredPercentage
									? { percentage: Number(item.measuredPercentage) }
									: {}),
							}))}
						disabledItemIds={coveredBudgetItemIds}
						quantityLabel="Qtd. medida"
						showMeasurementPercentage
						showUnitPrice
						editableUnitPrice={false}
						onChange={(next) => {
							const currentByBudgetId = new Map(
								items.map((item) => [item.budgetItemId, item]),
							);
							replace(
								next.map((item) => ({
									id: currentByBudgetId.get(item.budgetItemId)?.id,
									budgetItemId: item.budgetItemId,
									measuredQuantity:
										item.quantity > 0 ? String(item.quantity) : "",
									...(item.percentage != null
										? { measuredPercentage: String(item.percentage) }
										: {}),
								})),
							);
						}}
					/>
					{measurement.items?.some((item) => coveredItemIds?.has(item.id)) && (
						<p className="status-warning rounded-md px-2 py-1 text-xs">
							Itens com cobertura contratual permanecem selecionados, mas não
							podem ser alterados.
						</p>
					)}
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
