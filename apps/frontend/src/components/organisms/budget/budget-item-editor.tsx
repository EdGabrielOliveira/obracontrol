import { zodResolver } from "@hookform/resolvers/zod";
import { FilePenLine } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BudgetItemType, BudgetTreeItem } from "@/types/budget";
import { formatCurrency } from "@/utils/format";

const budgetItemFormSchema = z.object({
	index: z
		.string()
		.min(1, "Índice obrigatório")
		.regex(/^\d{1,3}(\.\d{1,3}){0,2}$/, "Índice inválido"),
	type: z.enum(["STAGE", "SUBSTAGE", "ITEM", "COMPOSITION", "INPUT"]),
	description: z.string().min(1, "Descrição obrigatória"),
	unit: z.string().optional(),
	quantity: z.string().optional(),
	unitCost: z.string().optional(),
});

type BudgetItemFormValues = z.infer<typeof budgetItemFormSchema>;

export type EditableBudgetItem = BudgetTreeItem & { depth: number };

export function flattenEditableBudgetItems(
	items: BudgetTreeItem[],
	depth = 0,
): EditableBudgetItem[] {
	return items.flatMap((item) => [
		{ ...item, depth },
		...flattenEditableBudgetItems(item.children, depth + 1),
	]);
}

const typeOptions: ReadonlyArray<{
	id: BudgetItemType;
	value: BudgetItemType;
	label: string;
}> = [
	{ id: "STAGE", value: "STAGE", label: "Etapa" },
	{ id: "SUBSTAGE", value: "SUBSTAGE", label: "Subetapa" },
	{ id: "ITEM", value: "ITEM", label: "Item" },
	{ id: "COMPOSITION", value: "COMPOSITION", label: "Composição" },
	{ id: "INPUT", value: "INPUT", label: "Insumo" },
];

type BudgetItemEditorProps = {
	item: EditableBudgetItem | null;
	onSubmit: (itemId: string, values: BudgetItemFormValues) => void;
	submitting?: boolean;
};

export function BudgetItemEditor({
	item,
	onSubmit,
	submitting = false,
}: BudgetItemEditorProps) {
	const { control, handleSubmit, reset } = useForm<BudgetItemFormValues>({
		resolver: zodResolver(budgetItemFormSchema),
		defaultValues: item
			? {
					index: item.index,
					type: item.type,
					description: item.description,
					unit: item.unit ?? "",
					quantity: item.quantity == null ? "" : String(item.quantity),
					unitCost: item.unitCost == null ? "" : String(item.unitCost),
				}
			: undefined,
	});

	useEffect(() => {
		if (!item) {
			reset();
			return;
		}
		reset({
			index: item.index,
			type: item.type,
			description: item.description,
			unit: item.unit ?? "",
			quantity: item.quantity == null ? "" : String(item.quantity),
			unitCost: item.unitCost == null ? "" : String(item.unitCost),
		});
	}, [item, reset]);

	if (!item) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-2 py-12 text-center">
					<FilePenLine className="size-8 text-muted-foreground" />
					<p className="font-medium">Selecione um item do orçamento</p>
					<p className="text-sm text-muted-foreground">
						Escolha um item na lista para editar seus dados.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeaderWithIcon
				icon={FilePenLine}
				title="Editar item"
				description="O valor total será recalculado pelo sistema após o salvamento."
			/>
			<CardContent>
				<form
					onSubmit={handleSubmit((values) => onSubmit(item.id, values))}
					className="space-y-4"
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<Controller
							name="index"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Índice"
									field={field}
									fieldState={fieldState}
									placeholder="Ex.: 1.1.1"
									disabled={submitting}
								/>
							)}
						/>
						<Controller
							name="type"
							control={control}
							render={({ field, fieldState }) => (
								<SelectFormField
									label="Tipo"
									placeholder="Selecione o tipo"
									options={typeOptions}
									field={field}
									fieldState={fieldState}
									disabled={submitting}
								/>
							)}
						/>
					</div>
					<Controller
						name="description"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Descrição"
								field={field}
								fieldState={fieldState}
								as="textarea"
								rows={3}
								disabled={submitting}
							/>
						)}
					/>
					<div className="grid gap-4 sm:grid-cols-3">
						<Controller
							name="unit"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Unidade"
									field={field}
									fieldState={fieldState}
									placeholder="m², un., vb..."
									disabled={submitting}
								/>
							)}
						/>
						<Controller
							name="quantity"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Quantidade"
									field={field}
									fieldState={fieldState}
									type="number"
									step="any"
									disabled={submitting}
								/>
							)}
						/>
						<Controller
							name="unitCost"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Custo unitário"
									field={field}
									fieldState={fieldState}
									type="number"
									step="0.01"
									disabled={submitting}
								/>
							)}
						/>
					</div>
					<div className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 text-sm">
						<span className="text-muted-foreground">Total atual</span>
						<strong>{formatCurrency(item.totalCost ?? 0)}</strong>
					</div>
					<div className="flex justify-end">
						<Button type="submit" disabled={submitting}>
							{submitting ? "Salvando..." : "Salvar alterações"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
