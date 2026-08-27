import { zodResolver } from "@hookform/resolvers/zod";
import {
	Building2,
	Download,
	FileSpreadsheet,
	MapPin,
	Plus,
} from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { AddressForm } from "@/components/organisms/address/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type WorkFormValues, workFormSchema } from "@/schemas/works";
import type { AddressValue } from "@/types/address";

const emptyAddress: AddressValue = {
	zipCode: "",
	street: "",
	district: "",
	number: "",
	city: "",
	state: "",
	complement: "",
	latitude: null,
	longitude: null,
};

export type FormOption = {
	id: string;
	value: string;
	label: string;
};

interface WorkFormProps {
	mode?: "create" | "edit";
	costCenterId: string;
	costCenterName?: string;
	costCenterOptions?: FormOption[];
	managerOptions?: FormOption[];
	defaultValues?: Partial<WorkFormValues>;
	onSubmit: (data: WorkFormValues, budgetFile: File | null) => void;
	onCancel?: () => void;
	loading?: boolean;
	onDownloadTemplate?: () => void;
	downloadingTemplate?: boolean;
}

export function WorkForm({
	mode = "create",
	costCenterId,
	costCenterName,
	costCenterOptions = [],
	managerOptions = [],
	defaultValues,
	onSubmit,
	onCancel,
	loading,
	onDownloadTemplate,
	downloadingTemplate,
}: WorkFormProps) {
	const [budgetFile, setBudgetFile] = useState<File | null>(null);
	const { control, handleSubmit } = useForm<WorkFormValues>({
		resolver: zodResolver(workFormSchema),
		defaultValues: {
			operationalStatus: "DRAFT",
			...defaultValues,
			costCenterId,
		},
	});

	const handleFormSubmit = handleSubmit((data) => onSubmit(data, budgetFile));

	return (
		<form onSubmit={handleFormSubmit} className="space-y-4">
			<Card>
				<CardHeaderWithIcon
					icon={Building2}
					title="Dados da obra"
					description="Informações gerais e prazos"
				/>
				<CardContent className="space-y-4">
					{mode === "edit" ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Controller
								name="code"
								control={control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Código"
										field={field}
										fieldState={fieldState}
										placeholder="Código da obra"
									/>
								)}
							/>
							<Controller
								name="name"
								control={control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Nome"
										field={field}
										fieldState={fieldState}
										placeholder="Nome da obra"
									/>
								)}
							/>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Controller
								name="costCenterId"
								control={control}
								render={({ field, fieldState }) => (
									<SelectFormField
										label="Centro de custo"
										field={field}
										fieldState={fieldState}
										options={costCenterOptions}
										placeholder="Selecione um centro de custo"
									/>
								)}
							/>
							<Controller
								name="name"
								control={control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Nome da obra"
										field={field}
										fieldState={fieldState}
										placeholder="Nome da obra"
									/>
								)}
							/>
						</div>
					)}
					{mode === "edit" ? (
						<>
							<Controller
								name="clientName"
								control={control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Cliente"
										field={field}
										fieldState={fieldState}
										placeholder="Nome do cliente"
									/>
								)}
							/>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<Controller
									name="plannedStart"
									control={control}
									render={({ field, fieldState }) => (
										<InputFormField
											label="Início previsto"
											field={field}
											fieldState={fieldState}
											mode="datepicker"
										/>
									)}
								/>
								<Controller
									name="plannedEnd"
									control={control}
									render={({ field, fieldState }) => (
										<InputFormField
											label="Fim previsto"
											field={field}
											fieldState={fieldState}
											mode="datepicker"
										/>
									)}
								/>
								<Controller
									name="areaM2"
									control={control}
									render={({ field, fieldState }) => (
										<InputFormField
											label="Área (m²)"
											field={field}
											fieldState={fieldState}
											placeholder="0.00"
											type="number"
											step="0.01"
										/>
									)}
								/>
							</div>
							<Controller
								name="responsibleName"
								control={control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Responsável"
										field={field}
										fieldState={fieldState}
										placeholder="Nome do responsável"
									/>
								)}
							/>
						</>
					) : (
						<>
							<Controller
								name="responsibleName"
								control={control}
								render={({ field, fieldState }) => (
									<SelectFormField
										label="Responsável (gestor) — opcional"
										field={field}
										fieldState={fieldState}
										options={managerOptions}
										placeholder="Selecione um gestor"
									/>
								)}
							/>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<Controller
									name="plannedStart"
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
									name="plannedEnd"
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
						</>
					)}
					{mode === "edit" && (
						<>
							<Controller
								name="operationalStatus"
								control={control}
								render={({ field, fieldState }) => (
									<SelectFormField
										label="Status operacional"
										field={field}
										fieldState={fieldState}
										placeholder="Selecione o status"
										options={[
											{ id: "DRAFT", value: "DRAFT", label: "Rascunho" },
											{
												id: "NOT_STARTED",
												value: "NOT_STARTED",
												label: "Não iniciada",
											},
											{
												id: "IN_PROGRESS",
												value: "IN_PROGRESS",
												label: "Em andamento",
											},
											{
												id: "SUSPENDED",
												value: "SUSPENDED",
												label: "Suspensa",
											},
											{ id: "DONE", value: "DONE", label: "Finalizada" },
											{ id: "IGNORED", value: "IGNORED", label: "Arquivada" },
										]}
									/>
								)}
							/>
							<Controller
								name="statusReason"
								control={control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Motivo da alteração de status"
										field={field}
										fieldState={fieldState}
										placeholder="Obrigatório ao suspender ou arquivar"
										className="sm:col-span-2"
									/>
								)}
							/>
						</>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeaderWithIcon
					icon={MapPin}
					title="Endereço"
					description="Endereço da obra"
				/>
				<CardContent>
					<Controller
						name="structuredAddress"
						control={control}
						render={({ field }) => (
							<AddressForm
								value={field.value ?? emptyAddress}
								onChange={field.onChange}
								disabled={loading}
							/>
						)}
					/>
				</CardContent>
			</Card>
			{mode === "create" && (
				<Card>
					<CardHeaderWithIcon
						icon={FileSpreadsheet}
						title="Orçamento inicial"
						description="Importar o orçamento junto com a obra"
					/>
					<CardContent className="space-y-2">
						<div className="flex items-start justify-between gap-4">
							<p className="text-sm text-muted-foreground">
								Envie uma planilha Excel (.xlsx) para importar o orçamento.
								Opcional.
							</p>
							{onDownloadTemplate && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={downloadingTemplate}
									onClick={onDownloadTemplate}
								>
									<Download className="mr-2 h-4 w-4" />
									{downloadingTemplate ? "Baixando..." : "Baixar modelo"}
								</Button>
							)}
						</div>
						<div className="space-y-1">
							<Label htmlFor="budget-file">Planilha do orçamento</Label>
							<Input
								id="budget-file"
								type="file"
								accept=".xlsx"
								disabled={loading}
								onChange={(event) =>
									setBudgetFile(event.target.files?.[0] ?? null)
								}
							/>
						</div>
					</CardContent>
				</Card>
			)}
			<div className="flex items-center justify-between">
				{mode === "edit" && (
					<p className="text-sm text-muted-foreground">
						Centro de Custo:{" "}
						<span className="font-medium">
							{costCenterName ?? costCenterId}
						</span>
					</p>
				)}
				<div className="flex gap-2 ml-auto">
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel}>
							Cancelar
						</Button>
					)}
					<Button type="submit" loading={loading}>
						{mode === "create" && <Plus className="mr-2 h-4 w-4" />}
						{loading
							? "Salvando..."
							: mode === "edit"
								? "Salvar"
								: "Criar obra"}
					</Button>
				</div>
			</div>
		</form>
	);
}
