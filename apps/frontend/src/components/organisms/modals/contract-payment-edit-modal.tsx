import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateContractPayment } from "@/api/contract-payments";
import { contractKeys, workKeys } from "@/api/query-keys";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_STATUS_OPTIONS } from "@/constants/status-options";
import {
	optionsForStatus,
	PAYMENT_STATUS_TRANSITIONS,
} from "@/lib/status-transitions";
import {
	type ContractPaymentEditValues,
	contractPaymentEditSchema,
} from "@/schemas/contracts";
import type { ContractMeasurement, ContractPayment } from "@/types/contracts";
import { getErrorMessage } from "@/utils/api-error";
import { parseCurrencyToNumber } from "@/utils/currency";

interface ContractPaymentEditModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workId: string;
	contractId: string;
	payment: ContractPayment;
	measurements?: ContractMeasurement[];
}

function measurementLabel(measurement: ContractMeasurement) {
	return `#${measurement.number} · ${measurement.title ?? ""}`;
}

export function ContractPaymentEditModal({
	open,
	onOpenChange,
	workId,
	contractId,
	payment,
	measurements = [],
}: ContractPaymentEditModalProps) {
	const queryClient = useQueryClient();
	const measurementOptions = [
		{ id: "", value: "", label: "Pagamento geral do contrato" },
		...[...measurements]
			.sort((a, b) => b.number - a.number)
			.map((measurement) => ({
				id: measurement.id,
				value: measurement.id,
				label: measurementLabel(measurement),
			})),
	];
	const availablePaymentStatusOptions = optionsForStatus(
		PAYMENT_STATUS_OPTIONS,
		payment.status,
		PAYMENT_STATUS_TRANSITIONS,
	);

	const { control, handleSubmit } = useForm<ContractPaymentEditValues>({
		resolver: zodResolver(contractPaymentEditSchema),
		defaultValues: {
			date: payment.date?.slice(0, 10) ?? "",
			description: payment.description ?? "",
			value: payment.value?.toString() ?? "",
			paidValue: payment.paidValue?.toString() ?? "",
			retentionValue: payment.retentionValue?.toString() ?? "",
			discountValue: payment.discountValue?.toString() ?? "",
			measurementId: payment.measurementId ?? "",
			status: payment.status ?? "",
		},
	});

	const mutation = useMutation({
		mutationFn: (values: ContractPaymentEditValues) =>
			updateContractPayment(workId, contractId, payment.id, {
				date: values.date,
				value: parseCurrencyToNumber(values.value) ?? 0,
				paidValue: parseCurrencyToNumber(values.paidValue) ?? 0,
				measurementId: values.measurementId || null,
				description: values.description || undefined,
				retentionValue: values.retentionValue
					? (parseCurrencyToNumber(values.retentionValue) ?? 0)
					: undefined,
				discountValue: values.discountValue
					? (parseCurrencyToNumber(values.discountValue) ?? 0)
					: undefined,
				status: values.status || undefined,
			}),
		onSuccess: () => {
			toast.success("Pagamento atualizado!");
			queryClient.invalidateQueries({
				queryKey: contractKeys.payments(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.paymentsSummary(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.aggregate(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.report(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.detail(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.contractsList(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.bi(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.reports(workId),
			});
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar pagamento.")),
	});

	const onSubmit = (values: ContractPaymentEditValues) => {
		mutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar Pagamento</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
					<Controller
						name="description"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Descrição"
								field={field}
								fieldState={fieldState}
								placeholder="Descrição do pagamento"
							/>
						)}
					/>
					<Controller
						name="date"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Data"
								field={field}
								fieldState={fieldState}
								mode="datepicker"
							/>
						)}
					/>
					<Controller
						name="measurementId"
						control={control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Medição"
								field={field}
								fieldState={fieldState}
								placeholder="Selecione a medição"
								options={measurementOptions}
							/>
						)}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="value"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Valor"
									field={field}
									fieldState={fieldState}
									mode="currency"
									placeholder="0.00"
								/>
							)}
						/>
						<Controller
							name="paidValue"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Valor Pago"
									field={field}
									fieldState={fieldState}
									mode="currency"
									placeholder="0.00"
								/>
							)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Controller
							name="retentionValue"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Retenção"
									field={field}
									fieldState={fieldState}
									mode="currency"
									placeholder="0.00"
								/>
							)}
						/>
						<Controller
							name="discountValue"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Desconto"
									field={field}
									fieldState={fieldState}
									mode="currency"
									placeholder="0.00"
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
								field={field}
								fieldState={fieldState}
								placeholder="Selecione o status"
								options={availablePaymentStatusOptions}
							/>
						)}
					/>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" loading={mutation.isPending}>
							Salvar
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
