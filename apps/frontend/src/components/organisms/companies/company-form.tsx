import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, MapPin, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { listAdminUsers } from "@/api/admin-users";
import { adminUserKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import {
	INPUT_MASKS,
	MaskedInput,
} from "@/components/molecules/FormField/MaskedField";
import { AddressForm } from "@/components/organisms/address/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type CompanyFormValues, companyFormSchema } from "@/schemas/companies";
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

export interface CompanyFormProps {
	mode?: "create" | "edit";
	defaultValues?: Partial<CompanyFormValues> & {
		structuredAddress?: AddressValue | null;
	};
	defaultAddress?: AddressValue | null;
	submitting?: boolean;
	onSubmit: (
		values: CompanyFormValues,
		template: File | null,
		structuredAddress: AddressValue | null,
	) => void;
	onError?: (message: string) => void;
	onCancel: () => void;
}

export function CompanyForm({
	mode = "create",
	defaultValues,
	defaultAddress,
	submitting,
	onSubmit,
	onError,
	onCancel,
}: CompanyFormProps) {
	const [template, setTemplate] = useState<File | null>(null);
	const [structuredAddress, setStructuredAddress] =
		useState<AddressValue | null>(
			defaultAddress ?? defaultValues?.structuredAddress ?? null,
		);
	const usersQuery = useQuery({
		queryKey: adminUserKeys.list({ limit: 100 }),
		queryFn: () => listAdminUsers({ limit: 100 }),
	});
	const form = useForm<CompanyFormValues>({
		resolver: zodResolver(companyFormSchema),
		defaultValues: {
			name: "",
			...defaultValues,
		},
	});

	useEffect(() => {
		if (!defaultValues) return;
		form.reset({ name: "", ...defaultValues });
		setStructuredAddress(
			defaultAddress ?? defaultValues.structuredAddress ?? null,
		);
	}, [defaultAddress, defaultValues, form]);

	if (usersQuery.isLoading) {
		return <LoadingSpinner title="Carregando usuários..." />;
	}
	if (usersQuery.error) {
		return (
			<ErrorFeedback
				message="Não foi possível carregar os usuários para o gerente."
				onRetry={() => void usersQuery.refetch()}
			/>
		);
	}

	const users = usersQuery.data?.data ?? [];
	const managerOptions = users.map((user) => ({
		id: user.id,
		value: user.name,
		label: user.name,
	}));
	const currentManager = form.getValues("managerName")?.trim();
	if (
		currentManager &&
		!managerOptions.some((option) => option.value === currentManager)
	) {
		managerOptions.unshift({
			id: `current-${currentManager}`,
			value: currentManager,
			label: currentManager,
		});
	}

	const handleSubmit = form.handleSubmit((values) => {
		if (mode === "create" && !template) {
			onError?.("Selecione um template DOCX.");
			return;
		}
		if (template && !template.name.toLowerCase().endsWith(".docx"))
			return onError?.("O template deve ser DOCX.");
		onSubmit(values, template, structuredAddress);
	});

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Card>
				<CardHeaderWithIcon
					icon={Building2}
					title="Dados da empresa"
					description="Informações gerais e contato"
				/>
				<CardContent className="space-y-4">
					<Controller
						name="name"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Razão social"
								placeholder="Razão social da empresa"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="document"
						control={form.control}
						render={({ field, fieldState }) => (
							<div className="space-y-1">
								<Label htmlFor="document">CNPJ</Label>
								<MaskedInput
									id="document"
									mask={INPUT_MASKS.cnpj}
									placeholder="00.000.000/0000-00"
									value={field.value ?? ""}
									disabled={submitting}
									onChange={field.onChange}
									onBlur={field.onBlur}
									ref={field.ref}
									name={field.name}
								/>
								{fieldState.error && (
									<p className="text-sm text-destructive">
										{fieldState.error.message}
									</p>
								)}
							</div>
						)}
					/>
					<Controller
						name="tradeName"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Nome fantasia"
								placeholder="Nome fantasia"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="managerName"
						control={form.control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Gerente responsável"
								placeholder="Selecione um gerente"
								options={managerOptions}
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="contactEmail"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="E-mail de contato"
								placeholder="contato@empresa.com"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="contactPhone"
						control={form.control}
						render={({ field, fieldState }) => (
							<div className="space-y-1">
								<Label htmlFor="contactPhone">Telefone de contato</Label>
								<MaskedInput
									id="contactPhone"
									mask={INPUT_MASKS.phone}
									placeholder="(00) 0 0000-0000"
									value={field.value ?? ""}
									disabled={submitting}
									onChange={field.onChange}
									onBlur={field.onBlur}
									ref={field.ref}
									name={field.name}
								/>
								{fieldState.error && (
									<p className="text-sm text-destructive">
										{fieldState.error.message}
									</p>
								)}
							</div>
						)}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeaderWithIcon
					icon={MapPin}
					title="Endereço"
					description="Endereço da sede da empresa"
				/>
				<CardContent>
					<AddressForm
						value={structuredAddress ?? emptyAddress}
						onChange={setStructuredAddress}
						disabled={submitting}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeaderWithIcon
					icon={FileText}
					title="Template DOCX"
					description="Modelo de contrato para esta empresa"
				/>
				<CardContent>
					<div className="space-y-1">
						<Label htmlFor="contract-template">
							{mode === "create"
								? "Contrato modelo DOCX (obrigatório)"
								: "Substituir template DOCX"}
						</Label>
						<Input
							id="contract-template"
							type="file"
							accept=".docx"
							disabled={submitting}
							onChange={(event) => setTemplate(event.target.files?.[0] ?? null)}
						/>
					</div>
				</CardContent>
			</Card>
			<div className="flex justify-end gap-2 pt-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button type="submit" disabled={submitting || !form.formState.isValid}>
					<Save className="mr-2 h-4 w-4" />
					{submitting
						? "Salvando..."
						: mode === "edit"
							? "Salvar alterações"
							: "Salvar empresa"}
				</Button>
			</div>
		</form>
	);
}
