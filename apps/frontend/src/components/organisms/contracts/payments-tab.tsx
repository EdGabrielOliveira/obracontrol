import { zodResolver } from "@hookform/resolvers/zod";
import { createColumnHelper } from "@tanstack/react-table";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/atoms/data-table";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import {
	PAYMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { OverrideFields } from "@/components/molecules/override-fields";
import { ContractPaymentEditModal } from "@/components/organisms/modals/contract-payment-edit-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_STATUS_OPTIONS } from "@/constants/status-options";
import { useAuth } from "@/lib/auth-context";
import type { ContractPaymentCreateValues } from "@/schemas/contracts";
import { contractPaymentCreateSchema } from "@/schemas/contracts";
import type { ContractMeasurement, ContractPayment } from "@/types/contracts";
import { formatCurrency, formatDate } from "@/utils/format";

interface PaymentsTabProps {
	workId: string;
	contractId: string;
	payments?: ContractPayment[];
	measurements?: ContractMeasurement[];
	isLoading?: boolean;
	isCreatingPayment?: boolean;
	onCreatePayment?: (values: ContractPaymentCreateValues) => void;
	onDeletePayment?: (id: string) => void;
}

function measurementLabel(measurement: ContractMeasurement) {
	return `#${measurement.number} · ${measurement.title ?? ""}`;
}

export function PaymentsTab({
	workId,
	contractId,
	payments: externalPayments,
	measurements = [],
	isLoading: externalLoading,
	isCreatingPayment,
	onCreatePayment,
	onDeletePayment,
}: PaymentsTabProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const { role } = useAuth();
	const isAdmin = role === "ADMIN";
	const prevCreating = useRef(isCreatingPayment);

	const { control, handleSubmit, reset } = useForm<ContractPaymentCreateValues>(
		{
			resolver: zodResolver(contractPaymentCreateSchema),
			defaultValues: {
				description: "",
				date: "",
				value: "",
				paidValue: "",
				retentionValue: "",
				discountValue: "",
				measurementId: "",
				status: "EM_ABERTO",
				balanceOverride: false,
				reason: "",
			},
		},
	);

	useEffect(() => {
		if (prevCreating.current && !isCreatingPayment) {
			setShowAdd(false);
			reset();
		}
		prevCreating.current = isCreatingPayment;
	}, [isCreatingPayment, reset]);

	const onSubmit = (values: ContractPaymentCreateValues) => {
		onCreatePayment?.(values);
	};

	const paymentHelper = createColumnHelper<ContractPayment>();

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

	const paymentColumns = [
		paymentHelper.accessor("date", {
			header: "Data",
			cell: (info) => formatDate(info.getValue()),
			meta: { mobileLabel: "Data" },
		}),
		paymentHelper.accessor("measurementId", {
			header: "Medição",
			cell: (info) => {
				const measurement = measurements.find((m) => m.id === info.getValue());
				return measurement ? measurementLabel(measurement) : "Contrato geral";
			},
			meta: { mobileLabel: "Medição" },
		}),
		paymentHelper.accessor("description", {
			header: "Descrição",
			cell: (info) => info.getValue() ?? "\u2014",
			meta: { mobileLabel: "Descrição" },
		}),
		paymentHelper.accessor("value", {
			header: "Valor",
			cell: (info) => formatCurrency(info.getValue()),
			meta: { className: "text-right", mobileLabel: "Valor" },
		}),
		paymentHelper.accessor("paidValue", {
			header: "Valor Pago",
			cell: (info) => formatCurrency(info.getValue()),
			meta: { className: "text-right", mobileLabel: "Valor Pago" },
		}),
		paymentHelper.accessor("retentionValue", {
			header: "Retenção",
			cell: (info) => {
				const val = info.getValue();
				return val != null ? formatCurrency(val) : "\u2014";
			},
			meta: { className: "text-right", mobileLabel: "Retenção" },
		}),
		paymentHelper.accessor("status", {
			header: "Status",
			cell: (info) => (
				<StatusBadge status={info.getValue()} map={PAYMENT_STATUS_MAP} />
			),
			meta: { mobileLabel: "Status" },
		}),
		paymentHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const p = info.row.original;
				return (
					<div className="flex justify-end gap-1" data-no-row-click>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setEditPaymentId(p.id)}
						>
							<Pencil className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setDeleteId(p.id)}
						>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				);
			},
			meta: { hideOnMobile: true },
		}),
	];

	if (externalLoading)
		return (
			<div className="py-8 text-center text-muted-foreground">
				Carregando pagamentos...
			</div>
		);
	if (!externalPayments) return <ErrorFeedback />;

	const payments = externalPayments;

	return (
		<Card>
			<CardHeaderWithIcon
				icon={CreditCard}
				title="Pagamentos do Contrato"
				description="Registre e acompanhe os pagamentos do contrato."
			/>
			<CardContent>
				<div className="mb-4">
					<Button
						variant="default"
						size="sm"
						onClick={() => {
							reset();
							setShowAdd(true);
						}}
					>
						<Plus className="mr-2 h-4 w-4" />
						Novo pagamento
					</Button>
				</div>

				<DataTable
					columns={paymentColumns}
					data={payments}
					searchPlaceholder="Buscar pagamentos..."
					emptyMessage="Nenhum pagamento cadastrado."
				/>

				<Dialog open={showAdd} onOpenChange={setShowAdd}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Novo Pagamento</DialogTitle>
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
										options={PAYMENT_STATUS_OPTIONS}
									/>
								)}
							/>
							{isAdmin && (
								<Controller
									name="balanceOverride"
									control={control}
									render={({ field }) => (
										<Controller
											name="reason"
											control={control}
											render={({ field: reasonField, fieldState }) => (
												<OverrideFields
													checked={field.value ?? false}
													onCheckedChange={(checked) => {
														field.onChange(checked);
														if (!checked) reasonField.onChange("");
													}}
													noteValue={reasonField.value ?? ""}
													onNoteValueChange={reasonField.onChange}
													noteLabel="Motivo"
													notePlaceholder="Descreva o motivo do override..."
													invalid={fieldState.invalid}
													error={fieldState.error}
												/>
											)}
										/>
									)}
								/>
							)}
							<div className="flex justify-end gap-2 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setShowAdd(false)}
								>
									Cancelar
								</Button>
								<Button type="submit">Salvar</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>

				<ConfirmDialog
					open={!!deleteId}
					title="Excluir pagamento?"
					description="Esta ação não pode ser desfeita."
					onConfirm={() => {
						if (deleteId) onDeletePayment?.(deleteId);
						setDeleteId(null);
					}}
					onCancel={() => setDeleteId(null)}
				/>

				{editPaymentId &&
					(() => {
						const payment = payments.find((p) => p.id === editPaymentId);
						if (!payment) return null;
						return (
							<ContractPaymentEditModal
								open={!!editPaymentId}
								onOpenChange={(open) => {
									if (!open) setEditPaymentId(null);
								}}
								workId={workId}
								contractId={contractId}
								payment={payment}
								measurements={measurements}
							/>
						);
					})()}
			</CardContent>
		</Card>
	);
}
