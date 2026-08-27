import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supplierKeys } from "@/api/query-keys";
import { createSupplier } from "@/api/suppliers";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { SupplierProfileForm } from "@/components/organisms/suppliers/supplier-profile-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import {
	type SupplierFormValues,
	supplierFormSchema,
} from "@/schemas/suppliers";
import type { SupplierCreateInput } from "@/types/suppliers";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/fornecedores/new")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Novo Fornecedor - ObraControl" },
		],
	}),
});

const EMPTY_FORM: SupplierFormValues = {
	name: "",
	document: "",
	responsibleName: "",
	responsibleDocument: "",
	contact: "",
	pixKey: "",
	pixKeyType: "",
	bankCode: "",
	bankName: "",
	bankBranch: "",
	bankAccount: "",
	bankAccountType: "",
	addressZipCode: "",
	addressStreet: "",
	addressNumber: "",
	addressComplement: "",
	addressDistrict: "",
	addressCity: "",
	addressState: "",
	structuredAddress: null,
	notes: "",
};

function toCreateInput(values: SupplierFormValues): SupplierCreateInput {
	const address = values.structuredAddress;
	return {
		name: values.name,
		document: values.document ?? null,
		responsibleName: values.responsibleName ?? null,
		responsibleDocument: values.responsibleDocument ?? null,
		contact: values.contact ?? null,
		pixKey: values.pixKey ?? null,
		pixKeyType: (values.pixKeyType ??
			null) as SupplierCreateInput["pixKeyType"],
		bankCode: values.bankCode ?? null,
		bankName: values.bankName ?? null,
		bankBranch: values.bankBranch ?? null,
		bankAccount: values.bankAccount ?? null,
		bankAccountType: (values.bankAccountType ??
			null) as SupplierCreateInput["bankAccountType"],
		addressZipCode: address?.zipCode ?? null,
		addressStreet: address?.street ?? null,
		addressNumber: address?.number ?? null,
		addressComplement: address?.complement ?? null,
		addressDistrict: address?.district ?? null,
		addressCity: address?.city ?? null,
		addressState: address?.state ?? null,
		notes: values.notes ?? null,
	};
}

function RouteComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const { requestCreationConfirmation } = useCreationConfirmation();

	const { control, handleSubmit } = useForm<SupplierFormValues>({
		resolver: zodResolver(supplierFormSchema),
		defaultValues: EMPTY_FORM,
	});

	const createMutation = useMutation({
		mutationFn: (input: SupplierCreateInput) => createSupplier(input),
		onSuccess: (createdSupplier) => {
			toast.success("Fornecedor criado!");
			queryClient.invalidateQueries({ queryKey: supplierKeys.all });
			navigate({
				to: "/app/fornecedores/$supplierId",
				params: { supplierId: createdSupplier.id },
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar fornecedor.")),
		onSettled: () => setSubmitting(false),
	});

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Cadastros"
				title="Novo Fornecedor"
				description="Preencha os dados para cadastrar um novo fornecedor."
			/>
			<form
				onSubmit={handleSubmit((values) => {
					setSubmitting(true);
					requestCreationConfirmation(() =>
						createMutation.mutate(toCreateInput(values)),
					);
				})}
				className="space-y-4"
			>
				<SupplierProfileForm control={control} />
				<div className="flex justify-end gap-3 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/app/fornecedores" })}
					>
						Cancelar
					</Button>
					<Button type="submit" loading={submitting}>
						Criar fornecedor
					</Button>
				</div>
			</form>
		</PageContainer>
	);
}
