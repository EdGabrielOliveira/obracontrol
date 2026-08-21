import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supplierKeys } from "@/api/query-keys";
import { createSupplier, updateSupplier } from "@/api/suppliers";
import {
	StatusBadge,
	SUPPLIER_STATUS_MAP,
} from "@/components/atoms/status-badge";
import { SupplierProfileForm } from "@/components/organisms/suppliers/supplier-profile-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	type SupplierFormValues,
	supplierFormSchema,
} from "@/schemas/suppliers";
import type { AddressValue } from "@/types/address";
import type {
	Supplier,
	SupplierBankAccountType,
	SupplierCreateInput,
	SupplierPixKeyType,
	SupplierUpdateInput,
} from "@/types/suppliers";
import { getErrorMessage } from "@/utils/api-error";

interface SupplierModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	supplier?: Supplier;
	defaultValues?: Partial<SupplierFormValues>;
	onCreated?: (supplier: Supplier) => void;
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

function toStructuredAddress(supplier: Supplier): AddressValue {
	return {
		zipCode: supplier.addressZipCode ?? "",
		street: supplier.addressStreet ?? "",
		district: supplier.addressDistrict ?? "",
		number: supplier.addressNumber ?? "",
		city: supplier.addressCity ?? "",
		state: supplier.addressState ?? "",
		complement: supplier.addressComplement ?? "",
		latitude: null,
		longitude: null,
	};
}

function toFormValues(
	supplier: Supplier | undefined,
	defaultValues?: Partial<SupplierFormValues>,
): SupplierFormValues {
	if (!supplier) return { ...EMPTY_FORM, ...defaultValues };
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
		structuredAddress: toStructuredAddress(supplier),
		notes: supplier.notes ?? "",
	};
}

function toCreateInput(values: SupplierFormValues): SupplierCreateInput {
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

export function SupplierModal({
	open,
	onOpenChange,
	supplier,
	defaultValues,
	onCreated,
}: SupplierModalProps) {
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const isEdit = !!supplier;
	const { requestCreationConfirmation } = useCreationConfirmation();

	const { control, handleSubmit, reset } = useForm<SupplierFormValues>({
		resolver: zodResolver(supplierFormSchema),
		defaultValues: EMPTY_FORM,
	});

	useEffect(() => {
		if (open) {
			reset(toFormValues(supplier, defaultValues));
		}
	}, [defaultValues, open, supplier, reset]);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: supplierKeys.all });
		if (supplier) {
			queryClient.invalidateQueries({
				queryKey: supplierKeys.detail(supplier.id),
			});
		}
	};

	const createMutation = useMutation({
		mutationFn: (input: SupplierCreateInput) => createSupplier(input),
		onSuccess: (createdSupplier) => {
			toast.success("Fornecedor criado!");
			invalidate();
			onOpenChange(false);
			onCreated?.(createdSupplier);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar fornecedor.")),
		onSettled: () => setSubmitting(false),
	});

	const updateMutation = useMutation({
		mutationFn: (input: SupplierUpdateInput) => {
			if (!supplier) throw new Error("Supplier ID is required for update");
			return updateSupplier(supplier.id, input);
		},
		onSuccess: () => {
			toast.success("Fornecedor atualizado!");
			invalidate();
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar fornecedor.")),
		onSettled: () => setSubmitting(false),
	});

	const onSubmit = (values: SupplierFormValues) => {
		setSubmitting(true);
		const input = toCreateInput(values);
		if (isEdit) {
			updateMutation.mutate(input);
		} else {
			requestCreationConfirmation(() => createMutation.mutate(input));
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<DialogTitle>
							{isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}
						</DialogTitle>
						{supplier?.status && (
							<StatusBadge status={supplier.status} map={SUPPLIER_STATUS_MAP} />
						)}
					</div>
					<DialogDescription>
						{isEdit
							? "Atualize os dados do fornecedor."
							: "Preencha os dados para cadastrar um novo fornecedor."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<SupplierProfileForm control={control} />
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" loading={submitting}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
