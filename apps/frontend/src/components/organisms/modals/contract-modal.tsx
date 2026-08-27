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
import type {
	ContractEditFormValues,
	ContractFormValues,
} from "@/schemas/contracts";
import type {
	Contract,
	ContractCreateInput,
	ContractEditInput,
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
		queryClient.invalidateQueries({
			queryKey: workKeys.contractsSummary(workId),
		});
		queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
		queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
	};

	const createMutation = useMutation({
		mutationFn: (input: ContractCreateInput) => createContract(workId, input),
		onSuccess: (result) => {
			if (result.status === "PENDING") {
				const approver =
					result.approvalRequest?.requiredApproverRole === "GESTOR"
						? "Gestor"
						: "Gerente";
				toast.success(
					`Solicitação de criação de contrato enviada para aprovação do ${approver}.`,
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
		mutationFn: (input: ContractEditInput) => {
			if (!contractId) throw new Error("Contract ID is required for update");
			return updateContract(workId, contractId, input);
		},
		onSuccess: (result) => {
			if (result.status === "PENDING") {
				const approver =
					result.approvalRequest?.requiredApproverRole === "GESTOR"
						? "Gestor"
						: "Gerente";
				toast.success(`Alteração enviada para aprovação do ${approver}.`);
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(workId),
				});
				onOpenChange(false);
				return;
			}
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

	const onCreateSubmit = (data: ContractFormValues) => {
		setSubmitting(true);
		requestCreationConfirmation(() => createMutation.mutate(data));
	};

	const onEditSubmit = (data: ContractEditFormValues) => {
		setSubmitting(true);
		const statusChanged = data.status !== contract?.status;
		const payload: ContractEditInput = {
			title: data.title,
			serviceType: data.serviceType,
			objectDescription: data.objectDescription,
			startDate: data.startDate,
			endDate: data.endDate,
			...(statusChanged
				? { status: data.status, statusReason: data.statusReason }
				: {}),
		};
		updateMutation.mutate(payload);
	};

	const editDefaultValues: Partial<ContractEditFormValues> | undefined =
		contract
			? {
					serviceType: contract.serviceType ?? undefined,
					objectDescription: contract.objectDescription ?? contract.notes ?? "",
					title: contract.title ?? undefined,
					startDate: contract.startDate ?? undefined,
					endDate: contract.endDate ?? undefined,
					status: contract.status,
					statusReason: undefined,
				}
			: undefined;

	const title = isEdit ? "Editar Contrato" : "Novo Contrato";
	const description = isEdit
		? "Atualize os dados do contrato."
		: "Preencha os dados para criar um novo contrato.";
	const form = isEdit ? (
		<ContractForm
			mode="edit"
			defaultValues={editDefaultValues}
			onSubmit={onEditSubmit}
			loading={submitting}
			onCancel={embedded ? () => onOpenChange(false) : undefined}
		/>
	) : (
		<ContractForm
			defaultValues={undefined}
			onSubmit={onCreateSubmit}
			loading={submitting}
			suppliers={suppliers}
			disableContractValue={disableContractValue}
		/>
	);
	if (embedded) {
		return form;
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{form}
			</DialogContent>
		</Dialog>
	);
}
