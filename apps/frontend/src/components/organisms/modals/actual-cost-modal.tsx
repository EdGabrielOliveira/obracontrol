import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createActualCost, updateActualCost } from "@/api/costs";
import { workKeys } from "@/api/query-keys";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import {
	type BudgetItemSelection,
	BudgetItemSelector,
} from "@/components/organisms/budget/budget-item-selector";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { getErrorMessage } from "@/utils/api-error";
import { parseCurrencyToNumber } from "@/utils/currency";
import { toDateInputValue } from "@/utils/format";

const CATEGORY_OPTIONS = [
	{ id: "MATERIAL", value: "MATERIAL", label: "Material" },
	{ id: "MAO_DE_OBRA", value: "MAO_DE_OBRA", label: "Mão de Obra" },
	{ id: "EQUIPAMENTO", value: "EQUIPAMENTO", label: "Equipamento" },
	{ id: "TRANSPORTE", value: "TRANSPORTE", label: "Transporte" },
	{ id: "SERVICO", value: "SERVICO", label: "Serviço" },
	{ id: "OUTROS", value: "OUTROS", label: "Outros" },
];

function todayInputValue(): string {
	return new Date().toISOString().slice(0, 10);
}

interface ActualCostModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workId: string;
	costBudgetItems?: CostBudgetItemSelectorResponse;
	budgetItems?: BudgetTreeItem[];
	suppliers?: WorkSupplier[];
	cost?: LegacyActualCost;
}

export function getActualCostModalOptions(
	costBudgetItems: CostBudgetItemSelectorResponse | undefined,
	suppliers: WorkSupplier[] | undefined,
) {
	return {
		budgetItemOptions:
			costBudgetItems?.items.map((item) => ({
				id: item.id,
				value: item.id,
				label: `${item.displayIndex} - ${item.description}`,
			})) ?? [],
		supplierOptions:
			suppliers?.map((link) => ({
				id: link.supplierId,
				value: link.supplierId,
				label: link.supplier.name,
			})) ?? [],
	};
}

export function ActualCostModal({
	open,
	onOpenChange,
	workId,
	costBudgetItems,
	budgetItems,
	suppliers,
	cost,
}: ActualCostModalProps) {
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const isEdit = !!cost;
	const { requestCreationConfirmation } = useCreationConfirmation();
	const [selectedBudgetItems, setSelectedBudgetItems] = useState<
		BudgetItemSelection[]
	>([]);

	const { supplierOptions } = getActualCostModalOptions(
		costBudgetItems,
		suppliers,
	);

	const { handleSubmit, reset, control, setValue } =
		useForm<ActualCostFormValues>({
			resolver: zodResolver(actualCostSchema) as Resolver<ActualCostFormValues>,
			defaultValues: {
				budgetVersionItemId: cost?.budgetVersionItem?.versionItemId ?? "",
				costDate: toDateInputValue(cost?.costDate) || todayInputValue(),
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

	const budgetTreeItems = useMemo<BudgetTreeItem[]>(
		() =>
			budgetItems ??
			costBudgetItems?.items.map((item) => ({
				id: item.id,
				parentId: item.stage ? null : null,
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

	const amountValue = useWatch({ control, name: "amount" });
	const categoryValue = useWatch({ control, name: "category" });
	const costTypeValue = useWatch({ control, name: "costType" });
	const paymentStatusOptions =
		costTypeValue === "FUTURE"
			? COST_PAYMENT_STATUS_OPTIONS.filter((option) => option.value === "OPEN")
			: COST_PAYMENT_STATUS_OPTIONS;
	const parsedAmount = parseCurrencyToNumber(amountValue) ?? 0;
	useEffect(() => {
		if (costTypeValue === "FUTURE") setValue("paymentStatus", "OPEN");
	}, [costTypeValue, setValue]);

	useEffect(() => {
		reset({
			budgetVersionItemId: cost?.budgetVersionItem?.versionItemId ?? "",
			costDate: toDateInputValue(cost?.costDate) || todayInputValue(),
			category: (cost?.category as ActualCostFormValues["category"]) ?? "",
			categoryDetail: cost?.categoryDetail ?? "",
			description: cost?.description ?? "",
			amount: cost?.amount?.toString() ?? "",
			costType: normalizeCostTypeInput(
				cost?.costType,
			) as ActualCostFormValues["costType"],
			supplierId: cost?.supplierId ?? "",
			paymentStatus: cost?.paymentStatus ?? "OPEN",
		});
		const existing = cost?.budgetVersionItem?.versionItemId
			? [
					{
						budgetItemId: cost.budgetVersionItem.versionItemId,
						quantity: 1,
						unitPrice: cost.amount,
					},
				]
			: [];
		setSelectedBudgetItems(existing);
	}, [open, cost, reset, setValue]);

	const createMutation = useMutation({
		mutationFn: (values: ActualCostFormValues) => {
			return createActualCost(workId, {
				budgetVersionItemId: values.budgetVersionItemId,
				costDate: values.costDate,
				category: values.category,
				categoryDetail: values.categoryDetail,
				description: values.description,
				amount: parsedAmount,
				costType: values.costType,
				supplierId: values.supplierId || null,
				paymentStatus: values.paymentStatus,
			});
		},
		onSuccess: () => {
			toast.success("Custo criado com sucesso!");
			queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.management(workId) });
			queryClient.invalidateQueries({
				queryKey: workKeys.costBudgetItems(workId),
			});
			reset();
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Erro ao criar custo. Tente novamente."),
			);
		},
		onSettled: () => {
			setSubmitting(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: ActualCostFormValues) => {
			if (!cost) throw new Error("Cost ID required");
			return updateActualCost(workId, cost.id, {
				budgetVersionItemId: values.budgetVersionItemId,
				costDate: values.costDate,
				category: values.category,
				categoryDetail: values.categoryDetail,
				description: values.description,
				amount: parsedAmount,
				costType: values.costType,
				supplierId: values.supplierId || null,
				paymentStatus: values.paymentStatus,
			});
		},
		onSuccess: () => {
			toast.success("Custo atualizado com sucesso!");
			queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.management(workId) });
			queryClient.invalidateQueries({
				queryKey: workKeys.costBudgetItems(workId),
			});
			if (cost) {
				queryClient.invalidateQueries({
					queryKey: workKeys.costDetail(workId, cost.id),
				});
			}
			reset();
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Erro ao atualizar custo. Tente novamente."),
			);
		},
		onSettled: () => {
			setSubmitting(false);
		},
	});

	const onSubmit = (values: ActualCostFormValues) => {
		setSubmitting(true);
		if (isEdit) {
			updateMutation.mutate(values);
		} else {
			requestCreationConfirmation(() => createMutation.mutate(values));
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>{isEdit ? "Editar custo" : "Novo custo"}</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Atualize os dados do custo realizado."
							: "Cadastre um custo realizado para esta obra."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-2 rounded-lg border p-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Itens do orçamento</span>
							<span className="text-xs text-muted-foreground">
								{selectedBudgetItems.length} selecionado(s)
							</span>
						</div>
						{categoryValue === "OUTROS" && (
							<Controller
								name="categoryDetail"
								control={control}
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
						<BudgetItemSelector
							workId={workId}
							budgetItems={costBudgetItems ? undefined : budgetTreeItems}
							effectiveBudgetItems={costBudgetItems}
							selectedItems={selectedBudgetItems}
							onChange={(items) => {
								const selected = items.slice(-1);
								setSelectedBudgetItems(selected);
								setValue(
									"budgetVersionItemId",
									selected[0]?.budgetVersionItemId ??
										selected[0]?.budgetItemId ??
										"",
								);
							}}
							quantityLabel="Quantidade"
							showUnitPrice
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<Controller
							name="costDate"
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
						<Controller
							name="supplierId"
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
					</div>

					<div className="grid grid-cols-2 gap-4">
						<Controller
							name="category"
							control={control}
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
							control={control}
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
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								as="textarea"
								label="Descrição complementar (opcional)"
								field={field}
								fieldState={fieldState}
								rows={4}
								placeholder="Ex: Compra de material de construção"
							/>
						)}
					/>

					<div className="grid grid-cols-2 gap-4">
						<Controller
							name="amount"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Valor (R$)"
									field={field}
									fieldState={fieldState}
									mode="currency"
									placeholder="0.00"
								/>
							)}
						/>
						<Controller
							name="paymentStatus"
							control={control}
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

					<div className="grid grid-cols-2 gap-4"></div>

					{costBudgetItems && (
						<p className="text-xs text-muted-foreground">
							Itens do orçamento vigente{" "}
							<span className="font-medium">
								{costBudgetItems.version.label} · versão{" "}
								{costBudgetItems.version.displayIndex}
							</span>
						</p>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							loading={submitting}
							disabled={selectedBudgetItems.length === 0}
						>
							{isEdit ? "Salvar" : "Criar custo"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
