import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
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
	COST_PAYMENT_STATUS_OPTIONS,
	COST_TYPE_OPTIONS,
} from "@/constants/status-options";
import { type CostFormValues, costSchema } from "@/schemas/costs";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import type { WorkSupplier } from "@/types/suppliers";

const CATEGORY_OPTIONS = [
	{ id: "MATERIAL", value: "MATERIAL", label: "Material" },
	{ id: "MAO_DE_OBRA", value: "MAO_DE_OBRA", label: "Mão de obra" },
	{ id: "EQUIPAMENTO", value: "EQUIPAMENTO", label: "Equipamento" },
	{ id: "TRANSPORTE", value: "TRANSPORTE", label: "Transporte" },
	{ id: "SERVICO", value: "SERVICO", label: "Serviço" },
	{ id: "OUTROS", value: "OUTROS", label: "Outros" },
];

type CostFormProps = {
	workId: string;
	costBudgetItems: CostBudgetItemSelectorResponse;
	suppliers: WorkSupplier[];
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

export function CostForm({
	workId,
	costBudgetItems,
	suppliers,
	submitting,
	onSubmit,
	onCancel,
}: CostFormProps) {
	const form = useForm<CostFormValues>({
		resolver: zodResolver(costSchema) as Resolver<CostFormValues>,
		defaultValues: { title: "", items: [] },
	});
	const { fields, replace } = useFieldArray({
		control: form.control,
		name: "items",
	});
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
					description="Selecione todos os itens que fazem parte deste custo."
				/>
				<CardContent>
					<BudgetItemSelector
						workId={workId}
						effectiveBudgetItems={costBudgetItems}
						selectedItems={selectedItems}
						onChange={setBudgetSelection}
						showUnitPrice={false}
						editableUnitPrice={false}
						title="Itens selecionados"
						description="Cada item terá categoria, descrição e valor próprios."
					/>
				</CardContent>
			</Card>

			{fields.map((field, index) => {
				const budget = itemByVersionId.get(
					watchedItems[index]?.budgetVersionItemId,
				);
				const category = watchedItems[index]?.category;
				const path = `items.${index}` as const;
				return (
					<Card key={field.id}>
						<CardHeaderWithIcon
							icon={DollarSign}
							title={
								budget
									? `${budget.displayIndex} — ${budget.description}`
									: "Item de custo"
							}
							description="Preencha os dados deste lançamento."
							actions={
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Remover item de custo"
									onClick={() =>
										setBudgetSelection(
											selectedItems.filter(
												(item) =>
													item.budgetVersionItemId !==
													watchedItems[index]?.budgetVersionItemId,
											),
										)
									}
								>
									<Trash2 className="size-4" />
								</Button>
							}
						/>
						<CardContent className="space-y-4">
							<div className="grid gap-3 md:grid-cols-2">
								<Controller
									name={`${path}.category`}
									control={form.control}
									render={({ field, fieldState }) => (
										<SelectFormField
											label="Categoria"
											placeholder="Selecione..."
											options={CATEGORY_OPTIONS}
											field={field}
											fieldState={fieldState}
										/>
									)}
								/>
								<Controller
									name={`${path}.costType`}
									control={form.control}
									render={({ field, fieldState }) => (
										<SelectFormField
											label="Tipo"
											placeholder="Selecione..."
											options={COST_TYPE_OPTIONS}
											field={field}
											fieldState={fieldState}
										/>
									)}
								/>
							</div>
							{category === "OUTROS" && (
								<Controller
									name={`${path}.categoryDetail`}
									control={form.control}
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
								name={`${path}.description`}
								control={form.control}
								render={({ field, fieldState }) => (
									<InputFormField
										as="textarea"
										label="Descrição"
										rows={3}
										field={field}
										fieldState={fieldState}
									/>
								)}
							/>
							<div className="grid gap-3 md:grid-cols-2">
								<Controller
									name={`${path}.costDate`}
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
								<Controller
									name={`${path}.amount`}
									control={form.control}
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
									control={form.control}
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
									control={form.control}
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
							</div>
						</CardContent>
					</Card>
				);
			})}

			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button
					type="submit"
					loading={submitting}
					disabled={fields.length === 0}
				>
					Criar custo com {fields.length || 0} item(ns)
				</Button>
			</div>
		</form>
	);
}
