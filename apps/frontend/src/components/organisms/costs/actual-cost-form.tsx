import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
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
import {
	type ActualCostFormValues,
	actualCostSchema,
	normalizeCostTypeInput,
} from "@/schemas/costs";
import type { BudgetTreeItem } from "@/types/budget";
import type {
	CostBudgetItemSelectorResponse,
	LegacyActualCost,
} from "@/types/measurements";
import type { WorkSupplier } from "@/types/suppliers";
import { toDateInputValue } from "@/utils/format";

const CATEGORY_OPTIONS = [
	{ id: "MATERIAL", value: "MATERIAL", label: "Material" },
	{ id: "MAO_DE_OBRA", value: "MAO_DE_OBRA", label: "Mão de Obra" },
	{ id: "EQUIPAMENTO", value: "EQUIPAMENTO", label: "Equipamento" },
	{ id: "TRANSPORTE", value: "TRANSPORTE", label: "Transporte" },
	{ id: "SERVICO", value: "SERVICO", label: "Serviço" },
	{ id: "OUTROS", value: "OUTROS", label: "Outros" },
];

export interface ActualCostFormProps {
	workId: string;
	budgetItems?: BudgetTreeItem[];
	costBudgetItems?: CostBudgetItemSelectorResponse;
	suppliers?: WorkSupplier[];
	cost?: LegacyActualCost;
	submitting?: boolean;
	onSubmit: (values: ActualCostFormValues) => void;
	onCancel: () => void;
}

export function ActualCostForm({
	workId,
	budgetItems,
	costBudgetItems,
	suppliers,
	cost,
	submitting,
	onSubmit,
	onCancel,
}: ActualCostFormProps) {
	const [selected, setSelected] = useState<BudgetItemSelection[]>([]);
	const form = useForm<ActualCostFormValues>({
		resolver: zodResolver(actualCostSchema) as Resolver<ActualCostFormValues>,
		defaultValues: {
			budgetVersionItemId: cost?.budgetVersionItem?.versionItemId ?? "",
			costDate:
				toDateInputValue(cost?.costDate) ||
				new Date().toISOString().slice(0, 10),
			category: (cost?.category as ActualCostFormValues["category"]) ?? "",
			categoryDetail: cost?.categoryDetail ?? "",
			description: cost?.description ?? "",
			amount: cost?.amount?.toString() ?? "",
			costType: normalizeCostTypeInput(
				cost?.costType,
			) as ActualCostFormValues["costType"],
			supplierId: cost?.supplierId ?? "",
			paymentStatus: cost?.paymentStatus ?? "OPEN",
		},
	});
	const costTypeValue = useWatch({
		control: form.control,
		name: "costType",
	});
	const categoryValue = useWatch({
		control: form.control,
		name: "category",
	});
	const paymentStatusOptions =
		costTypeValue === "FUTURE"
			? COST_PAYMENT_STATUS_OPTIONS.filter((option) => option.value === "OPEN")
			: COST_PAYMENT_STATUS_OPTIONS;
	useEffect(() => {
		if (costTypeValue === "FUTURE") form.setValue("paymentStatus", "OPEN");
	}, [costTypeValue, form]);
	const items = useMemo<BudgetTreeItem[]>(
		() =>
			budgetItems ??
			costBudgetItems?.items.map((item) => ({
				id: item.id,
				parentId: null,
				index: item.displayIndex,
				type: "ITEM",
				description: item.description,
				unit: item.unit,
				quantity: null,
				unitCost: item.totalCost,
				totalCost: item.totalCost,
				plannedStart: null,
				plannedEnd: null,
				actualStart: null,
				actualEnd: null,
				completionPercentage: null,
				sortOrder: 0,
				children: [],
			})) ??
			[],
		[budgetItems, costBudgetItems],
	);
	useEffect(() => {
		const existing = cost?.budgetVersionItem?.versionItemId
			? [
					{
						budgetItemId: cost.budgetVersionItem.versionItemId,
						quantity: 1,
						unitPrice: cost.amount,
					},
				]
			: [];
		setSelected(existing);
	}, [cost]);
	const supplierOptions =
		suppliers?.map((item) => ({
			id: item.supplierId,
			value: item.supplierId,
			label: item.supplier.name,
		})) ?? [];
	const setBudgetSelection = (next: BudgetItemSelection[]) => {
		const selected = next.slice(-1);
		setSelected(selected);
		form.setValue(
			"budgetVersionItemId",
			selected[0]?.budgetVersionItemId ?? selected[0]?.budgetItemId ?? "",
		);
	};
	return (
		<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
			<Card>
				<CardHeaderWithIcon
					icon={DollarSign}
					title="Dados do custo"
					description="Informações básicas do registro de custo"
				/>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="costDate"
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
							name="supplierId"
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
					</div>
					{categoryValue === "OUTROS" && (
						<Controller
							name="categoryDetail"
							control={form.control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Especifique a categoria"
									field={field}
									fieldState={fieldState}
									placeholder="Ex: Taxas e licenças"
								/>
							)}
						/>
					)}
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="category"
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
							name="costType"
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
					<Controller
						name="description"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								as="textarea"
								label="Descrição"
								field={field}
								fieldState={fieldState}
								rows={4}
							/>
						)}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="amount"
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
							name="paymentStatus"
							control={form.control}
							render={({ field, fieldState }) => (
								<SelectFormField
									label="Status pagamento"
									placeholder="Selecione..."
									options={paymentStatusOptions}
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
					title="Vinculação ao orçamento"
					description="Associe este custo a um item do orçamento"
				/>
				<CardContent>
					<BudgetItemSelector
						workId={workId}
						budgetItems={costBudgetItems ? undefined : items}
						effectiveBudgetItems={costBudgetItems}
						selectedItems={selected}
						onChange={setBudgetSelection}
						quantityLabel="Quantidade"
						showUnitPrice
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
					disabled={selected.length === 0}
				>
					{cost ? "Salvar" : "Criar custo"}
				</Button>
			</div>
		</form>
	);
}
