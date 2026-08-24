import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange, FileText } from "lucide-react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { SupplierCombobox } from "@/components/molecules/supplier-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	CONTRACT_STATUS_OPTIONS,
	DEFAULT_CONTRACT_STATUS,
} from "@/constants/status-options";
import {
	type ContractEditFormValues,
	type ContractFormValues,
	contractEditFormSchema,
	contractFormSchema,
} from "@/schemas/contracts";
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
	disableContractValue?: boolean;
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
	const { handleSubmit, control } = useForm<ContractEditFormValues>({
		resolver: zodResolver(
			contractEditFormSchema,
		) as Resolver<ContractEditFormValues>,
		defaultValues,
	});

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<Card>
				<CardHeaderWithIcon
					icon={FileText}
					title="Dados do contrato"
					description="Atualize as informações cadastrais permitidas."
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
								label="Descrição"
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
	disableContractValue,
}: ContractCreateFormProps) {
	const { handleSubmit, control, register, setValue } =
		useForm<ContractFormValues>({
			resolver: zodResolver(contractFormSchema) as Resolver<ContractFormValues>,
			defaultValues: {
				supplierId: null,
				status: DEFAULT_CONTRACT_STATUS,
				...defaultValues,
			},
		});

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<input type="hidden" {...register("supplierId")} />
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
								setValue("supplierId", supplier ? supplier.id : null);
							}}
							disabled={field.disabled}
							invalid={fieldState.invalid}
							error={fieldState.error}
						/>
					)}
				/>
			</div>
			<Controller
				name="contractValue"
				control={control}
				render={({ field, fieldState }) => (
					<InputFormField
						label="Valor do contrato"
						field={field}
						fieldState={fieldState}
						mode="currency"
						placeholder="0.00"
						disabled={disableContractValue}
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
						placeholder="Ex: Execucao, Projeto, Fornecimento"
					/>
				)}
			/>
			<Controller
				name="objectDescription"
				control={control}
				render={({ field, fieldState }) => (
					<InputFormField
						label="Descrição"
						field={field}
						fieldState={fieldState}
						as="textarea"
						placeholder="Descreva os serviços a serem prestados"
					/>
				)}
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
				name="status"
				control={control}
				render={({ field, fieldState }) => (
					<SelectFormField
						label="Status"
						placeholder="Selecione..."
						options={CONTRACT_STATUS_OPTIONS}
						field={field}
						fieldState={fieldState}
					/>
				)}
			/>
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
			<Button type="submit" loading={loading}>
				Salvar
			</Button>
		</form>
	);
}
