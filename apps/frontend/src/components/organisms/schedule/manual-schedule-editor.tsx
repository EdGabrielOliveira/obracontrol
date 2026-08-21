import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { ManualScheduleItemInput } from "@/api/schedule";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import { BudgetItemEditSelector } from "@/components/organisms/budget/budget-item-edit-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BudgetTreeItem } from "@/types/budget";
import type { ScheduleResponse } from "@/types/schedule";
import { flattenItems } from "@/utils/schedule-helpers";

const manualScheduleSchema = z
	.object({
		budgetItemId: z.string().min(1, "Selecione um item do orçamento"),
		plannedStart: z.string().min(1, "Data de início obrigatória"),
		plannedEnd: z.string().min(1, "Data de fim obrigatória"),
	})
	.refine((values) => values.plannedEnd >= values.plannedStart, {
		message: "A data de fim deve ser maior ou igual à data de início.",
		path: ["plannedEnd"],
	});

type ManualScheduleFormValues = z.infer<typeof manualScheduleSchema>;

type ManualScheduleEditorProps = {
	workId: string;
	scheduleData?: ScheduleResponse;
	onSubmit: (values: ManualScheduleItemInput) => void | Promise<void>;
	submitting?: boolean;
};

function dateInputValue(value: string | null | undefined) {
	return value ? value.slice(0, 10) : "";
}

function scheduleDatesByItem(scheduleData?: ScheduleResponse) {
	const dates = new Map<string, { start: string; end: string }>();
	for (const item of flattenItems(scheduleData?.items ?? [])) {
		if (item.type === "ITEM" && (item.plannedStart || item.plannedEnd)) {
			dates.set(item.id, {
				start: dateInputValue(item.plannedStart),
				end: dateInputValue(item.plannedEnd),
			});
		}
	}
	for (const item of scheduleData?.gantt ?? []) {
		if (item.baselineStart || item.baselineEnd) {
			dates.set(item.itemId, {
				start: dateInputValue(item.baselineStart),
				end: dateInputValue(item.baselineEnd),
			});
		}
	}
	return dates;
}

export function ManualScheduleEditor({
	workId,
	scheduleData,
	onSubmit,
	submitting = false,
}: ManualScheduleEditorProps) {
	const scheduleDates = scheduleDatesByItem(scheduleData);
	const { handleSubmit, control, setValue, watch, formState } =
		useForm<ManualScheduleFormValues>({
			resolver: zodResolver(manualScheduleSchema),
			defaultValues: {
				budgetItemId: "",
				plannedStart: "",
				plannedEnd: "",
			},
		});
	const selectedItemId = watch("budgetItemId");
	const hasExistingSchedule = selectedItemId
		? scheduleDates.has(selectedItemId)
		: false;

	const handleItemSelect = (item: BudgetTreeItem) => {
		setValue("budgetItemId", item.id, { shouldValidate: true });
		const dates = scheduleDates.get(item.id);
		setValue("plannedStart", dates?.start ?? "", { shouldValidate: true });
		setValue("plannedEnd", dates?.end ?? "", { shouldValidate: true });
	};

	return (
		<Card>
			<CardHeaderWithIcon
				icon={CalendarPlus}
				title="Editar cronograma"
				description="Abra um item do orçamento e informe as datas da linha de base. Itens que já possuem cronograma podem ser editados."
			/>
			<CardContent>
				<form
					onSubmit={handleSubmit(async (values) => {
						await onSubmit({
							budgetItemId: values.budgetItemId,
							plannedStart: values.plannedStart,
							plannedEnd: values.plannedEnd,
						});
					})}
					className="space-y-4"
				>
					<BudgetItemEditSelector
						workId={workId}
						selectedItemId={selectedItemId}
						onSelect={handleItemSelect}
						renderItemDetails={() => (
							<div className="space-y-3 border-t border-primary/20 bg-background/70 p-3">
								<p className="text-xs text-muted-foreground">
									{hasExistingSchedule
										? "Este item já possui cronograma. Atualize as datas abaixo."
										: "Este item ainda não possui cronograma. Informe as datas para criar a linha de base."}
								</p>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<Controller
										name="plannedStart"
										control={control}
										render={({ field, fieldState }) => (
											<InputFormField
												label="Data de início"
												field={field}
												fieldState={fieldState}
												mode="datepicker"
												disabled={submitting}
											/>
										)}
									/>
									<Controller
										name="plannedEnd"
										control={control}
										render={({ field, fieldState }) => (
											<InputFormField
												label="Data de fim"
												field={field}
												fieldState={fieldState}
												mode="datepicker"
												disabled={submitting}
											/>
										)}
									/>
								</div>
							</div>
						)}
						disabled={submitting}
					/>
					{formState.errors.budgetItemId && (
						<p className="text-sm text-destructive">
							{formState.errors.budgetItemId.message}
						</p>
					)}
					<div className="flex justify-end">
						<Button type="submit" disabled={submitting}>
							{submitting ? "Salvando..." : "Salvar cronograma"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
