import { zodResolver } from "@hookform/resolvers/zod";
import { Download, FileText, ListTree, MapPinned } from "lucide-react";
import { useState } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { FileDropzone } from "@/components/atoms/file-dropzone";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import {
	type BudgetItemSelection,
	BudgetItemSelector,
} from "@/components/organisms/budget/budget-item-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	type QuotationRequestValues,
	quotationRequestSchema,
} from "@/schemas/quotation-request";
import type { BudgetTreeItem } from "@/types/budget";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";

interface ContractRequestFormProps {
	workId: string;
	budgetItems?: BudgetTreeItem[];
	effectiveBudgetItems?: CostBudgetItemSelectorResponse;
	defaultValues?: Partial<QuotationRequestValues>;
	isSubmitting?: boolean;
	onSubmit: (values: QuotationRequestValues, file: File) => void;
	onDownloadTemplate: () => void;
	onCancel: () => void;
}

export function ContractRequestForm({
	workId,
	budgetItems,
	effectiveBudgetItems,
	defaultValues,
	isSubmitting,
	onSubmit,
	onDownloadTemplate,
	onCancel,
}: ContractRequestFormProps) {
	const form = useForm<QuotationRequestValues>({
		resolver: zodResolver(
			quotationRequestSchema,
		) as Resolver<QuotationRequestValues>,
		defaultValues: {
			serviceType: "",
			title: "",
			description: "",
			startDate: "",
			endDate: "",
			items: [],
			...defaultValues,
		},
		mode: "onChange",
	});
	const selectedItems = form.watch("items");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const handleBudgetSelection = (items: BudgetItemSelection[]) => {
		form.setValue(
			"items",
			items.map(({ budgetItemId, quantity }) => ({ budgetItemId, quantity })),
			{ shouldValidate: true, shouldDirty: true },
		);
	};

	const submit = (values: QuotationRequestValues) => {
		if (!selectedFile) {
			form.setError("root", { message: "Anexe o mapa de cotação em Excel." });
			return;
		}
		onSubmit(values, selectedFile);
	};

	return (
		<form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
			<Card>
				<CardHeaderWithIcon
					icon={FileText}
					title="Dados do contrato"
					description="Informações principais da solicitação."
				/>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<Controller
						name="title"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Título"
								placeholder="Contratação de fundação"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="serviceType"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Tipo de serviço"
								placeholder="Execução, projeto ou fornecimento"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="startDate"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Início"
								mode="datepicker"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="endDate"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Fim"
								mode="datepicker"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="description"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Descrição"
								placeholder="Descreva o escopo da contratação"
								as="textarea"
								className="sm:col-span-2"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={ListTree}
					title="Itens do orçamento"
					description="Selecione os itens que serão contratados."
				/>
				<CardContent className="space-y-3">
					<p className="text-sm text-muted-foreground">
						Selecione as atividades que comporão o contrato e informe a
						quantidade.
					</p>
					<BudgetItemSelector
						workId={workId}
						budgetItems={effectiveBudgetItems ? undefined : budgetItems}
						effectiveBudgetItems={effectiveBudgetItems}
						selectedItems={selectedItems}
						onChange={handleBudgetSelection}
						showUnitPrice={false}
						quantityLabel="Quantidade do contrato"
					/>
					{form.formState.errors.items?.message ? (
						<p className="text-sm text-destructive">
							{form.formState.errors.items.message}
						</p>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={MapPinned}
					title="Mapa de cotação"
					description="Anexe o mapa de cotação recebido."
				/>
				<CardContent className="space-y-3">
					<p className="text-sm text-muted-foreground">
						Anexe o Excel com os fornecedores, CNPJs e valores da cotação.
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onDownloadTemplate}
					>
						<Download className="mr-2 h-4 w-4" />
						Baixar modelo padrão
					</Button>
					<FileDropzone
						onFileSelect={(file) => {
							setSelectedFile(file);
							form.clearErrors("root");
						}}
					/>
					{selectedFile ? (
						<p className="text-sm text-muted-foreground">
							Arquivo selecionado:{" "}
							<span className="font-medium">{selectedFile.name}</span>
						</p>
					) : null}
					{form.formState.errors.root?.message ? (
						<p className="text-sm text-destructive">
							{form.formState.errors.root.message}
						</p>
					) : null}
				</CardContent>
			</Card>

			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button type="submit" loading={isSubmitting}>
					Criar contrato e enviar mapa
				</Button>
			</div>
		</form>
	);
}
