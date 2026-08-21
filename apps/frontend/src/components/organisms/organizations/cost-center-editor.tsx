import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, MapPin } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { AddressForm } from "@/components/organisms/address/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	type CostCenterEditValues,
	costCenterEditSchema,
} from "@/schemas/organizations";
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

type Option = { id: string; value: string; label: string };

export interface CostCenterEditorProps {
	mode?: "create" | "edit";
	organizations: Option[];
	managers: Option[];
	defaultValues?: Partial<CostCenterEditValues>;
	submitting?: boolean;
	onSubmit: (values: CostCenterEditValues) => void;
	onCancel: () => void;
}

export function CostCenterEditor({
	mode = "create",
	organizations,
	managers,
	defaultValues,
	submitting,
	onSubmit,
	onCancel,
}: CostCenterEditorProps) {
	const form = useForm<CostCenterEditValues>({
		resolver: zodResolver(costCenterEditSchema),
		defaultValues: {
			name: "",
			organizationId: "",
			managerName: "",
			structuredAddress: null,
			...defaultValues,
		},
	});

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
			<Card>
				<CardHeaderWithIcon
					icon={Building2}
					title="Dados gerais"
					description="Informações básicas do centro de custo."
				/>
				<CardContent className="space-y-4">
					<Controller
						name="organizationId"
						control={form.control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Organização"
								field={field}
								fieldState={fieldState}
								options={organizations}
								placeholder="Selecione uma organização"
							/>
						)}
					/>
					<Controller
						name="managerName"
						control={form.control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Gestor responsável"
								field={field}
								fieldState={fieldState}
								options={managers}
								placeholder="Selecione um gestor"
							/>
						)}
					/>
					<Controller
						name="name"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Nome do centro"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={MapPin}
					title="Endereço"
					description="Localização do centro de custo."
				/>
				<CardContent>
					<Controller
						name="structuredAddress"
						control={form.control}
						render={({ field }) => (
							<AddressForm
								value={field.value ?? emptyAddress}
								onChange={field.onChange}
								disabled={submitting}
							/>
						)}
					/>
				</CardContent>
			</Card>

			<div className="flex justify-end gap-3 pt-4">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button type="submit" loading={submitting}>
					{mode === "edit" ? "Salvar alterações" : "Criar centro"}
				</Button>
			</div>
		</form>
	);
}
