import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createContract, updateContract } from "@/api/contracts";
import { contractKeys, governanceKeys, workKeys } from "@/api/query-keys";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ContractForm } from "@/organisms/contracts/contract-form";
import type { ContractFormValues } from "@/schemas/contracts";
import type {
	Contract,
	ContractCreateInput,
	ContractUpdateInput,
} from "@/types/contracts";
import type { Supplier } from "@/types/suppliers";
import { getErrorMessage } from "@/utils/api-error";

interface ContractModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	embedded?: boolean;
	workId: string;
	contract?: Contract;
	suppliers?: Supplier[];
	disableContractValue?: boolean;
}

export function ContractModal({
	open,
	onOpenChange,
	embedded = false,
	workId,
	contract,
	suppliers = [],
	disableContractValue,
}: ContractModalProps) {
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const isEdit = !!contract;
	const { requestCreationConfirmation } = useCreationConfirmation();
	const contractId = contract?.id;

	const invalidateContractRelated = () => {
		queryClient.invalidateQueries({ queryKey: workKeys.contracts(workId) });
		queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
		queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
	};

	const createMutation = useMutation({
		mutationFn: (input: ContractCreateInput) => createContract(workId, input),
		onSuccess: (result) => {
			if (result.status === "PENDING") {
				toast.success(
					"Solicitação de criação de contrato enviada para aprovação do Gestor.",
				);
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(workId),
				});
				onOpenChange(false);
				return;
			}
			toast.success("Contrato criado!");
			invalidateContractRelated();
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar contrato.")),
		onSettled: () => setSubmitting(false),
	});

	const updateMutation = useMutation({
		mutationFn: (input: ContractUpdateInput) => {
			if (!contractId) throw new Error("Contract ID is required for update");
			const payload = { ...input };
			if (disableContractValue) delete payload.contractValue;
			return updateContract(workId, contractId, payload);
		},
		onSuccess: () => {
			toast.success("Contrato atualizado!");
			invalidateContractRelated();
			if (contractId) {
				queryClient.invalidateQueries({
					queryKey: contractKeys.detail(workId, contractId),
				});
			}
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar contrato.")),
		onSettled: () => setSubmitting(false),
	});

	const onSubmit = (data: ContractFormValues) => {
		setSubmitting(true);
		if (isEdit) {
			updateMutation.mutate(data as ContractUpdateInput);
		} else {
			requestCreationConfirmation(() => createMutation.mutate(data));
		}
	};

	const defaultValues = contract
		? {
				code: contract.code,
				supplierName: contract.supplierName,
				supplierId: contract.supplierId ?? null,
				contractValue: contract.contractValue,
				serviceType: contract.serviceType ?? undefined,
				objectDescription: contract.objectDescription ?? undefined,
				title: contract.title ?? undefined,
				startDate: contract.startDate ?? undefined,
				endDate: contract.endDate ?? undefined,
				status: contract.status,
				notes: contract.notes ?? undefined,
			}
		: undefined;

	const content = (
		<>
			<DialogHeader>
				<DialogTitle>
					{isEdit ? "Editar Contrato" : "Novo Contrato"}
				</DialogTitle>
				<DialogDescription>
					{isEdit
						? "Atualize os dados do contrato."
						: "Preencha os dados para criar um novo contrato."}
				</DialogDescription>
			</DialogHeader>
			<ContractForm
				defaultValues={defaultValues}
				onSubmit={onSubmit}
				loading={submitting}
				suppliers={suppliers}
				disableContractValue={disableContractValue}
			/>
		</>
	);
	if (embedded) return <div className="space-y-4">{content}</div>;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>{content}</DialogContent>
		</Dialog>
	);
}
