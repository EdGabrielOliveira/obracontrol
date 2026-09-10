import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Plus } from "lucide-react";
import { useMemo } from "react";
import {
	type Control,
	Controller,
	type Resolver,
	useFieldArray,
	useForm,
	useWatch,
} from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import {
	type BudgetItemSelection,
	BudgetItemSelector,
} from "@/components/organisms/budget/budget-item-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	COST_CATEGORY_OPTIONS,
	COST_PAYMENT_STATUS_OPTIONS,
	COST_TYPE_OPTIONS,
} from "@/constants/status-options";
import { type CostFormValues, costSchema } from "@/schemas/costs";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import type { WorkSupplier } from "@/types/suppliers";

type CostFormProps = {
	mode?: "create" | "edit";
	workId: string;
	costBudgetItems: CostBudgetItemSelectorResponse;
	suppliers: WorkSupplier[];
	defaultValues?: CostFormValues;
	submitting?: boolean;
	onSubmit: (values: CostFormValues) => void;
	onCancel: () => void;
};

function emptyCostItem(
	budgetVersionItemId: string,
): CostFormValues["items"][number] {
	return {
		budgetVersionItemId,
		costDate: new Date().toISOString().slice(0, 10),
		category: "MATERIAL",
		categoryDetail: "",
		description: "",
		amount: "",
		costType: "CURRENT",
		supplierId: "",
		paymentStatus: "OPEN",
	};
}

function CostItemFields({
	control,
	path,
	category,
	supplierOptions,
}: {
	control: Control<CostFormValues>;
	path: `items.${number}`;
	category: CostFormValues["items"][number]["category"];
	supplierOptions: Array<{ id: string; value: string; label: string }>;
}) {
	return (
		<div className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
			<Controller
				name={`${path}.category`}
				control={control}
				render={({ field, fieldState }) => (
					<SelectFormField
						label="Categoria"
						placeholder="Selecione..."
						options={COST_CATEGORY_OPTIONS}
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
			<Controller
				name={`${path}.costType`}
				control={control}
				render={({ field, fieldState }) => (
					<SelectFormField
						label="Tipo do custo"
						placeholder="Selecione..."
						options={COST_TYPE_OPTIONS}
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
			{category === "OUTROS" && (
				<Controller
					name={`${path}.categoryDetail`}
					control={control}
					render={({ field, fieldState }) => (
						<InputFormField
							label="Especifique a categoria"
							placeholder="Ex.: Taxas e licenças"
							field={field}
							fieldState={fieldState}
						/>
					)}
				/>
			)}
			<Controller
				name={`${path}.costDate`}
				control={control}
				render={({ field, fieldState }) => (
					<InputFormField
						label="Data"
						mode="datepicker"
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
			<Controller
				name={`${path}.amount`}
				control={control}
				render={({ field, fieldState }) => (
					<InputFormField
						label="Valor (R$)"
						mode="currency"
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
			<Controller
				name={`${path}.supplierId`}
				control={control}
				render={({ field, fieldState }) => (
					<SelectFormField
						label="Fornecedor (opcional)"
						placeholder="Selecione..."
						options={supplierOptions}
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
			<Controller
				name={`${path}.paymentStatus`}
				control={control}
				render={({ field, fieldState }) => (
					<SelectFormField
						label="Status do pagamento"
						placeholder="Selecione..."
						options={COST_PAYMENT_STATUS_OPTIONS}
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
			<div className="md:col-span-2">
				<Controller
					name={`${path}.description`}
					control={control}
					render={({ field, fieldState }) => (
						<InputFormField
							as="textarea"
							label="Descrição / observação"
							rows={2}
							field={field}
							fieldState={fieldState}
						/>
					)}
				/>
			</div>
		</div>
	);
}

export function CostForm({
	mode = "create",
	workId,
	costBudgetItems,
	suppliers,
	defaultValues,
	submitting,
	onSubmit,
	onCancel,
}: CostFormProps) {
	const form = useForm<CostFormValues>({
		resolver: zodResolver(costSchema) as Resolver<CostFormValues>,
		defaultValues: defaultValues ?? { title: "", items: [] },
	});
	const { replace } = useFieldArray({ control: form.control, name: "items" });
	const watchedItems = useWatch({ control: form.control, name: "items" }) ?? [];
	const itemByVersionId = useMemo(
		() => new Map(costBudgetItems.items.map((item) => [item.id, item])),
		[costBudgetItems.items],
	);
	const supplierOptions = suppliers.map((item) => ({
		id: item.supplierId,
		value: item.supplierId,
		label: item.supplier.name,
	}));
	const selectedItems: BudgetItemSelection[] = watchedItems.flatMap((item) => {
		const budget = itemByVersionId.get(item.budgetVersionItemId);
		return budget
			? [
					{
						budgetItemId: budget.budgetItemId,
						budgetVersionItemId: budget.id,
						quantity: 1,
					},
				]
			: [];
	});
	const setBudgetSelection = (selections: BudgetItemSelection[]) => {
		const current = form.getValues("items");
		replace(
			selections.map((selection) => {
				const budgetVersionItemId =
					selection.budgetVersionItemId ?? selection.budgetItemId;
				return (
					current.find(
						(item) => item.budgetVersionItemId === budgetVersionItemId,
					) ?? emptyCostItem(budgetVersionItemId)
				);
			}),
		);
	};

	return (
		<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
			<Card>
				<CardHeaderWithIcon
					icon={DollarSign}
					title="Dados do custo"
					description="O custo reúne vários lançamentos financeiros relacionados."
				/>
				<CardContent>
					<Controller
						name="title"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Título do custo"
								placeholder="Ex.: Custos da fundação — janeiro"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeaderWithIcon
					icon={Plus}
					title="Itens do orçamento"
					description="Selecione os itens e preencha os campos de cada lançamento no próprio item."
				/>
				<CardContent>
					<BudgetItemSelector
						workId={workId}
						effectiveBudgetItems={costBudgetItems}
						selectedItems={selectedItems}
						onChange={setBudgetSelection}
						showUnitPrice={false}
						showQuantity={false}
						editableUnitPrice={false}
						title="Itens selecionados"
						description="Use a busca e abra as etapas para organizar os lançamentos."
						renderSelectedItemDetails={({ selectionIndex }) => {
							const item = watchedItems[selectionIndex];
							if (!item) return null;
							return (
								<CostItemFields
									control={form.control}
									path={`items.${selectionIndex}`}
									category={item.category}
									supplierOptions={supplierOptions}
								/>
							);
						}}
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
					disabled={watchedItems.length === 0}
				>
					{mode === "edit"
						? `Salvar alterações (${watchedItems.length} item(ns))`
						: `Criar custo com ${watchedItems.length || 0} item(ns)`}
				</Button>
			</div>
		</form>
	);
}
