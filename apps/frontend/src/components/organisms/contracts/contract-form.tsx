import { zodResolver } from "@hookform/resolvers/zod";
import {
	BriefcaseBusiness,
	CalendarRange,
	CircleDollarSign,
	ListTree,
	User,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { SupplierCombobox } from "@/components/molecules/supplier-combobox";
import {
	type BudgetItemSelection,
	BudgetItemSelector,
} from "@/components/organisms/budget/budget-item-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	CONTRACT_STATUS_OPTIONS,
	DEFAULT_CONTRACT_STATUS,
} from "@/constants/status-options";
import { optionsForStatus, CONTRACT_STATUS_TRANSITIONS } from "@/lib/status-transitions";
import {
	type ContractEditFormValues,
	type ContractFormValues,
	contractEditFormSchema,
	contractFormSchema,
} from "@/schemas/contracts";
import type { CostBudgetItemSelectorResponse } from "@/types/measurements";
import type { Supplier } from "@/types/suppliers";

interface ContractFormBaseProps {
	loading?: boolean;
	onCancel?: () => void;
}

interface ContractCreateFormProps extends ContractFormBaseProps {
	mode?: "create";
	defaultValues?: Partial<ContractFormValues>;
	onSubmit: (data: ContractFormValues) => void;
	suppliers?: Supplier[];
	linkedSupplierIds?: string[];
	disableContractValue?: boolean;
	workId?: string;
	effectiveBudgetItems?: CostBudgetItemSelectorResponse;
	showServices?: boolean;
	submitLabel?: string;
	contractValueLabel?: string;
}

interface ContractEditFormProps extends ContractFormBaseProps {
	mode: "edit";
	defaultValues?: Partial<ContractEditFormValues>;
	onSubmit: (data: ContractEditFormValues) => void;
}

type ContractFormProps = ContractCreateFormProps | ContractEditFormProps;

export function ContractForm(props: ContractFormProps) {
	if (props.mode === "edit") {
		return <ContractEditForm {...props} />;
	}

	return <ContractCreateForm {...props} />;
}

function ContractEditForm({
	defaultValues,
	onSubmit,
	loading,
	onCancel,
}: ContractEditFormProps) {
	const currentStatus = defaultValues?.status ?? "RASCUNHO";
	const availableStatusOptions = useMemo(
		() =>
			optionsForStatus(
				CONTRACT_STATUS_OPTIONS,
				currentStatus,
				CONTRACT_STATUS_TRANSITIONS,
			),
		[currentStatus],
	);
	const { handleSubmit, control, watch } = useForm<ContractEditFormValues>({
		resolver: zodResolver(
			contractEditFormSchema,
		) as Resolver<ContractEditFormValues>,
		defaultValues,
	});
	const selectedStatus = watch("status") ?? currentStatus;
	const statusNeedsReason =
		selectedStatus === "PARALISADO" || selectedStatus === "ARQUIVADO";

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<Card>
				<CardHeaderWithIcon
					icon={BriefcaseBusiness}
					title="Informações do contrato"
					description="Atualize os dados cadastrais permitidos para este contrato."
				/>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<Controller
						name="title"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Título"
								field={field}
								fieldState={fieldState}
								placeholder="Ex.: Contrato de fundação"
							/>
						)}
					/>
					<Controller
						name="serviceType"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Tipo de serviço"
								field={field}
								fieldState={fieldState}
								placeholder="Execução, projeto ou fornecimento"
							/>
						)}
					/>
					<Controller
						name="objectDescription"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Objeto do contrato"
								field={field}
								fieldState={fieldState}
								as="textarea"
								className="sm:col-span-2"
								placeholder="Descreva os serviços a serem prestados"
							/>
						)}
					/>
					<Controller
						name="status"
						control={control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Status"
								placeholder="Selecione..."
								options={availableStatusOptions}
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					{statusNeedsReason && (
						<Controller
							name="statusReason"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Motivo da alteração de status"
									field={field}
									fieldState={fieldState}
									placeholder="Explique a alteração"
									className="sm:col-span-2"
								/>
							)}
						/>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={CalendarRange}
					title="Vigência"
					description="Defina o período de início e fim do contrato."
				/>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<Controller
						name="startDate"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Início"
								field={field}
								fieldState={fieldState}
								mode="datepicker"
							/>
						)}
					/>
					<Controller
						name="endDate"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Fim"
								field={field}
								fieldState={fieldState}
								mode="datepicker"
							/>
						)}
					/>
				</CardContent>
			</Card>

			<div className="flex justify-end gap-3">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancelar
					</Button>
				)}
				<Button type="submit" loading={loading}>
					Salvar alterações
				</Button>
			</div>
		</form>
	);
}

function ContractCreateForm({
	defaultValues,
	onSubmit,
	loading,
	suppliers = [],
	linkedSupplierIds,
	disableContractValue,
	workId,
	effectiveBudgetItems,
	showServices = false,
	submitLabel = "Salvar",
	contractValueLabel = "Valor do contrato",
}: ContractCreateFormProps) {
	const { handleSubmit, control, register, setValue } =
		useForm<ContractFormValues>({
			resolver: zodResolver(contractFormSchema) as Resolver<ContractFormValues>,
		defaultValues: {
			status: DEFAULT_CONTRACT_STATUS,
				...defaultValues,
			},
		});
	const [selectedServices, setSelectedServices] = useState<
		BudgetItemSelection[]
	>(
		() =>
			defaultValues?.services?.map((service) => ({
				budgetItemId: service.budgetItemId,
				quantity: service.quantity,
				unitPrice: service.unitCost,
			})) ?? [],
	);
	const [servicesError, setServicesError] = useState<string | null>(null);
	const canSelectServices = showServices && !!workId && !!effectiveBudgetItems;

	const submit = (values: ContractFormValues) => {
		if (canSelectServices && selectedServices.length > 0) {
			const hasInvalidService = selectedServices.some(
				(service) =>
					service.quantity <= 0 ||
					service.unitPrice == null ||
					service.unitPrice <= 0,
			);
			if (hasInvalidService) {
				setServicesError(
					"Informe quantidade e valor unitário válidos para todos os serviços selecionados.",
				);
				return;
			}
		}
		setServicesError(null);
		onSubmit({
			...values,
			...(selectedServices.length > 0
				? {
						services: selectedServices.map((service) => ({
							budgetItemId: service.budgetItemId,
							quantity: service.quantity,
							unitCost: service.unitPrice ?? 0,
						})),
					}
				: {}),
		});
	};

	return (
		<form onSubmit={handleSubmit(submit)} className="space-y-4">
			<input type="hidden" {...register("supplierId")} />
			<Card>
				<CardHeaderWithIcon
					icon={User}
					title="Dados do fornecedor"
					description="Selecione um fornecedor vinculado à obra ou informe o nome cadastrado."
				/>
				<CardContent>
					<Controller
						name="supplierName"
						control={control}
						render={({ field, fieldState }) => (
							<SupplierCombobox
								label="Fornecedor"
								placeholder="Selecione ou digite o fornecedor..."
								suppliers={suppliers}
								value={field.value ?? ""}
								onValueChange={(name) => {
									field.onChange(name);
									const supplier = suppliers.find((s) => s.name === name);
									const isLinked =
										linkedSupplierIds === undefined ||
										(supplier ? linkedSupplierIds.includes(supplier.id) : false);
									setValue(
										"supplierId",
										isLinked && supplier ? supplier.id : "",
									);
								}}
								disabled={field.disabled}
								invalid={fieldState.invalid}
								error={fieldState.error}
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={BriefcaseBusiness}
					title="Serviço"
					description="Identifique o serviço e descreva o escopo que será contratado."
				/>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<Controller
						name="title"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Título"
								field={field}
								fieldState={fieldState}
								placeholder="Ex.: Contrato de fundação"
							/>
						)}
					/>
					<Controller
						name="code"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Código"
								field={field}
								fieldState={fieldState}
								placeholder="Código do contrato"
							/>
						)}
					/>
					<Controller
						name="serviceType"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Tipo de serviço"
								field={field}
								fieldState={fieldState}
								placeholder="Execução, projeto ou fornecimento"
							/>
						)}
					/>
					<Controller
						name="objectDescription"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Objeto do contrato"
								field={field}
								fieldState={fieldState}
								as="textarea"
								className="sm:col-span-2"
								placeholder="Descreva os serviços a serem prestados"
							/>
						)}
					/>
				</CardContent>
			</Card>
			{canSelectServices && (
				<Card>
					<CardHeaderWithIcon
						icon={ListTree}
						title="Serviços do contrato"
						description="Opcionalmente, vincule os itens já contratados ao orçamento da obra."
					/>
					<CardContent className="space-y-3">
						<BudgetItemSelector
							workId={workId ?? ""}
							effectiveBudgetItems={effectiveBudgetItems}
							selectedItems={selectedServices}
							onChange={(items) => {
								setSelectedServices(items);
								setServicesError(null);
							}}
							showUnitPrice
							editableUnitPrice
							quantityLabel="Quantidade contratada"
						/>
						{servicesError ? (
							<p className="text-sm text-destructive">{servicesError}</p>
						) : null}
					</CardContent>
				</Card>
			)}
			<Card>
				<CardHeaderWithIcon
					icon={CircleDollarSign}
					title="Informações do contrato"
					description="Defina o valor, a vigência e as observações do contrato."
				/>
				<CardContent className="space-y-4">
					<Controller
						name="contractValue"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label={contractValueLabel}
								field={field}
								fieldState={fieldState}
								mode="currency"
								placeholder="0.00"
								disabled={disableContractValue}
							/>
						)}
					/>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<Controller
							name="startDate"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Início"
									field={field}
									fieldState={fieldState}
									mode="datepicker"
								/>
							)}
						/>
						<Controller
							name="endDate"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Fim"
									field={field}
									fieldState={fieldState}
									mode="datepicker"
								/>
							)}
						/>
					</div>
					<Controller
						name="notes"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Observações"
								field={field}
								fieldState={fieldState}
								as="textarea"
								placeholder="Observações..."
							/>
						)}
					/>
				</CardContent>
			</Card>
			<Button type="submit" loading={loading}>
				{submitLabel}
			</Button>
		</form>
	);
}
