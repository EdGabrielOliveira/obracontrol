import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Building, MapPin } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { listCompanies } from "@/api/companies";
import { listWorkManagers } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import { SelectFormField } from "@/components/molecules/FormField/SelectFormField";
import { AddressForm } from "@/components/organisms/address/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { organizationEditSchema } from "@/schemas/organizations";
import type { AddressValue } from "@/types/address";
import type { CreateOrganizationInput } from "@/types/organizations";

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

interface OrgFormProps {
	mode?: "create" | "edit";
	defaultValues?: CreateOrganizationInput;
	onSubmit: (data: CreateOrganizationInput) => void;
	onCancel?: () => void;
	loading?: boolean;
}

export function OrgForm({
	mode = "create",
	defaultValues = { name: "", companyId: "" },
	onSubmit,
	onCancel,
	loading,
}: OrgFormProps) {
	const companiesQuery = useQuery({
		queryKey: ["companies"],
		queryFn: listCompanies,
	});
	const managersQuery = useQuery({
		queryKey: ["work-managers"],
		queryFn: listWorkManagers,
	});
	const { control, handleSubmit } = useForm<CreateOrganizationInput>({
		resolver: zodResolver(organizationEditSchema),
		defaultValues: {
			...defaultValues,
			structuredAddress: defaultValues.structuredAddress ?? null,
		},
	});
	if (companiesQuery.isLoading || managersQuery.isLoading) {
		return <LoadingSpinner title="Carregando opções..." />;
	}
	if (companiesQuery.error || managersQuery.error) {
		return (
			<ErrorFeedback
				onRetry={() => {
					void companiesQuery.refetch();
					void managersQuery.refetch();
				}}
			/>
		);
	}
	const companies = companiesQuery.data ?? [];
	const managers = managersQuery.data ?? [];

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="flex flex-col w-full space-y-4"
		>
			<Card>
				<CardHeaderWithIcon
					icon={Building}
					title="Dados gerais"
					description="Informações básicas da organização."
				/>
				<CardContent className="space-y-4">
					<Controller
						name="name"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Nome"
								field={field}
								fieldState={fieldState}
								placeholder="Nome da organização"
							/>
						)}
					/>
					<Controller
						name="companyId"
						control={control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Empresa"
								field={field}
								fieldState={fieldState}
								options={companies.map((company) => ({
									id: company.id,
									value: company.id,
									label: company.name,
								}))}
								placeholder="Selecione uma empresa"
							/>
						)}
					/>
					<Controller
						name="managerName"
						control={control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Gerente responsável"
								field={field}
								fieldState={fieldState}
								options={managers.map((manager) => ({
									id: manager.id,
									value: manager.name,
									label: manager.name,
								}))}
								placeholder="Selecione um gerente"
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={MapPin}
					title="Endereço"
					description="Localização da organização."
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

			<div className="flex justify-end gap-2">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancelar
					</Button>
				)}
				<Button type="submit" loading={loading}>
					{mode === "edit" ? "Salvar alterações" : "Criar organização"}
				</Button>
			</div>
		</form>
	);
}
