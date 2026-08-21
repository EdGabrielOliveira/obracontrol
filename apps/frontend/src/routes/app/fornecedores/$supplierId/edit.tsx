import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supplierKeys } from "@/api/query-keys";
import { getSupplier, updateSupplier } from "@/api/suppliers";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { SupplierProfileForm } from "@/components/organisms/suppliers/supplier-profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";
import {
	type SupplierFormValues,
	supplierFormSchema,
} from "@/schemas/suppliers";
import type {
	SupplierBankAccountType,
	SupplierPixKeyType,
	SupplierUpdateInput,
} from "@/types/suppliers";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/fornecedores/$supplierId/edit")({
	loader: async ({ params }) => {
		await queryClient.prefetchQuery({
			queryKey: supplierKeys.detail(params.supplierId),
			queryFn: () => getSupplier(params.supplierId),
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar Fornecedor - ObraControl" },
		],
	}),
});

function toFormValues(supplier: {
	name: string;
	document?: string | null;
	responsibleName?: string | null;
	responsibleDocument?: string | null;
	contact?: string | null;
	pixKey?: string | null;
	pixKeyType?: string | null;
	bankCode?: string | null;
	bankName?: string | null;
	bankBranch?: string | null;
	bankAccount?: string | null;
	bankAccountType?: string | null;
	addressZipCode?: string | null;
	addressStreet?: string | null;
	addressNumber?: string | null;
	addressComplement?: string | null;
	addressDistrict?: string | null;
	addressCity?: string | null;
	addressState?: string | null;
	notes?: string | null;
}): SupplierFormValues {
	return {
		name: supplier.name,
		document: supplier.document ?? "",
		responsibleName: supplier.responsibleName ?? "",
		responsibleDocument: supplier.responsibleDocument ?? "",
		contact: supplier.contact ?? "",
		pixKey: supplier.pixKey ?? "",
		pixKeyType: supplier.pixKeyType ?? "",
		bankCode: supplier.bankCode ?? "",
		bankName: supplier.bankName ?? "",
		bankBranch: supplier.bankBranch ?? "",
		bankAccount: supplier.bankAccount ?? "",
		bankAccountType: supplier.bankAccountType ?? "",
		addressZipCode: supplier.addressZipCode ?? "",
		addressStreet: supplier.addressStreet ?? "",
		addressNumber: supplier.addressNumber ?? "",
		addressComplement: supplier.addressComplement ?? "",
		addressDistrict: supplier.addressDistrict ?? "",
		addressCity: supplier.addressCity ?? "",
		addressState: supplier.addressState ?? "",
		structuredAddress: {
			zipCode: supplier.addressZipCode ?? "",
			street: supplier.addressStreet ?? "",
			district: supplier.addressDistrict ?? "",
			number: supplier.addressNumber ?? "",
			city: supplier.addressCity ?? "",
			state: supplier.addressState ?? "",
			complement: supplier.addressComplement ?? "",
			latitude: null,
			longitude: null,
		},
		notes: supplier.notes ?? "",
	};
}

function toUpdateInput(values: SupplierFormValues): SupplierUpdateInput {
	const address = values.structuredAddress;
	return {
		name: values.name,
		document: values.document ?? null,
		responsibleName: values.responsibleName ?? null,
		responsibleDocument: values.responsibleDocument ?? null,
		contact: values.contact ?? null,
		pixKey: values.pixKey ?? null,
		pixKeyType: (values.pixKeyType ?? null) as SupplierPixKeyType | null,
		bankCode: values.bankCode ?? null,
		bankName: values.bankName ?? null,
		bankBranch: values.bankBranch ?? null,
		bankAccount: values.bankAccount ?? null,
		bankAccountType: (values.bankAccountType ??
			null) as SupplierBankAccountType | null,
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
	const { supplierId } = useParams({
		from: "/app/fornecedores/$supplierId/edit",
	});
	const navigate = useNavigate();
	const queryClientHook = useQueryClient();
	const [submitting, setSubmitting] = useState(false);

	const supplierQuery = useQuery({
		queryKey: supplierKeys.detail(supplierId),
		queryFn: () => getSupplier(supplierId),
	});

	const { control, handleSubmit, reset } = useForm<SupplierFormValues>({
		resolver: zodResolver(supplierFormSchema),
		defaultValues: EMPTY_FORM,
	});

	useEffect(() => {
		if (supplierQuery.data) {
			reset(toFormValues(supplierQuery.data.supplier));
		}
	}, [supplierQuery.data, reset]);

	const updateMutation = useMutation({
		mutationFn: (input: SupplierUpdateInput) =>
			updateSupplier(supplierId, input),
		onSuccess: () => {
			toast.success("Fornecedor atualizado!");
			queryClientHook.invalidateQueries({ queryKey: supplierKeys.all });
			queryClientHook.invalidateQueries({
				queryKey: supplierKeys.detail(supplierId),
			});
			navigate({
				to: "/app/fornecedores/$supplierId",
				params: { supplierId },
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar fornecedor.")),
		onSettled: () => setSubmitting(false),
	});

	if (supplierQuery.isLoading)
		return <LoadingSpinner title="Carregando fornecedor..." />;
	if (supplierQuery.error || !supplierQuery.data) return <ErrorFeedback />;

	const supplier = supplierQuery.data.supplier;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Cadastros"
				title="Editar Fornecedor"
				description={supplier.name}
			/>
			<Card>
				<CardContent className="pt-6">
					<form
						onSubmit={handleSubmit((values) => {
							setSubmitting(true);
							updateMutation.mutate(toUpdateInput(values));
						})}
						className="space-y-4"
					>
						<SupplierProfileForm control={control} />
						<div className="flex justify-end gap-3 pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									navigate({
										to: "/app/fornecedores/$supplierId",
										params: { supplierId },
									})
								}
							>
								Cancelar
							</Button>
							<Button type="submit" loading={submitting}>
								Salvar alterações
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</PageContainer>
	);
}

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
