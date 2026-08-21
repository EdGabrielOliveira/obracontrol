import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Link2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import { BudgetItemSelector } from "@/components/organisms/budget/budget-item-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	type MeasurementCreateValues,
	measurementCreateSchema,
} from "@/schemas/measurements";
import type { BudgetTreeItem } from "@/types/budget";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";

export function WorkMeasurementCreateForm({
	workId,
	budgetItems,
	effectiveBudgetItems,
	availableQuantities,
	submitting,
	onSubmit,
	onCancel,
}: {
	workId: string;
	budgetItems: BudgetTreeItem[];
	effectiveBudgetItems?: CostBudgetItemSelectorResponse;
	availableQuantities?: Record<string, number>;
	submitting?: boolean;
	onSubmit: (values: MeasurementCreateValues) => void;
	onCancel: () => void;
}) {
	const form = useForm<MeasurementCreateValues>({
		resolver: zodResolver(measurementCreateSchema),
		defaultValues: {
			title: "",
			date: new Date().toISOString().slice(0, 10),
			items: [],
			balanceOverride: false,
			evidenceNote: "",
		},
	});
	const { replace } = useFieldArray({ control: form.control, name: "items" });
	const items = form.watch("items");
	return (
		<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
			<Card>
				<CardHeaderWithIcon
					icon={ClipboardList}
					title="Dados da medição"
					description="Informações básicas da medição"
				/>
				<CardContent>
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="title"
							control={form.control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Descrição"
									field={field}
									fieldState={fieldState}
									placeholder="Ex: Medição 1 - Janeiro 2026"
								/>
							)}
						/>
						<Controller
							name="date"
							control={form.control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Data"
									mode="datepicker"
									field={field}
									fieldState={fieldState}
								/>
							)}
						/>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeaderWithIcon
					icon={Link2}
					title="Itens a medir"
					description="Selecione e quantifique os itens do orçamento"
				/>
				<CardContent>
					<BudgetItemSelector
						workId={workId}
						budgetItems={effectiveBudgetItems ? undefined : budgetItems}
						effectiveBudgetItems={effectiveBudgetItems}
						availableQuantities={availableQuantities}
						selectedItems={items.map((item) => ({
							budgetItemId: item.budgetItemId,
							quantity: Number(item.measuredQuantity) || 0,
						}))}
						onChange={(next) =>
							replace(
								next.map((item) => ({
									budgetItemId: item.budgetItemId,
									measuredQuantity:
										item.quantity > 0 ? String(item.quantity) : "",
								})),
							)
						}
						quantityLabel="Qtd. medida"
						showUnitPrice
						editableUnitPrice={false}
					/>
				</CardContent>
			</Card>
			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button
					type="submit"
					loading={submitting}
					disabled={items.length === 0}
				>
					Criar medição
				</Button>
			</div>
		</form>
	);
}
