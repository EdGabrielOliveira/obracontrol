import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { SupplierCombobox } from "@/components/molecules/supplier-combobox";
import { Button } from "@/components/ui/button";
import {
	CONTRACT_STATUS_OPTIONS,
	DEFAULT_CONTRACT_STATUS,
} from "@/constants/status-options";
import {
	type ContractFormValues,
	contractFormSchema,
} from "@/schemas/contracts";
import type { Supplier } from "@/types/suppliers";

interface ContractFormProps {
	defaultValues?: Partial<ContractFormValues>;
	onSubmit: (data: ContractFormValues) => void;
	loading?: boolean;
	suppliers?: Supplier[];
	disableContractValue?: boolean;
}

export function ContractForm({
	defaultValues,
	onSubmit,
	loading,
	suppliers = [],
	disableContractValue,
}: ContractFormProps) {
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
						label="Objeto do contrato"
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
