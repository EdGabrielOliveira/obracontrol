import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { EmptyState } from "@/components/atoms/empty-state";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	ContractAmendment,
	ContractMeasurement,
	CreateContractAmendmentInput,
	UpdateContractAmendmentInput,
} from "@/types/contracts";
import { parseCurrencyToNumber } from "@/utils/currency";
import { formatCurrency, formatDate } from "@/utils/format";

const AMENDMENT_KIND_OPTIONS = [
	{ id: "ADITIVO", value: "ADITIVO", label: "Aditivo" },
	{ id: "REDUCAO", value: "REDUCAO", label: "Redução" },
] as const;

const APPROVAL_STATUS_LABELS: Record<string, string> = {
	PENDING_GESTOR: "Aguardando gestor",
	PENDING_GERENTE: "Aguardando gerente",
	APPROVED: "Aprovado",
	REJECTED: "Rejeitado",
};

export const amendmentFormSchema = z
	.object({
		kind: z.enum(["ADITIVO", "REDUCAO"]),
		value: z.string().min(1, "Valor obrigatório"),
		reason: z
			.string()
			.min(1, "Motivo obrigatório")
			.max(1000, "Motivo deve ter no máximo 1000 caracteres"),
		date: z.string().min(1, "Data obrigatória"),
		measurementIds: z
			.array(z.string())
			.min(1, "Selecione ao menos uma medição"),
	})
	.refine((data) => (parseCurrencyToNumber(data.value) ?? 0) > 0, {
		message: "Informe um valor válido maior que zero",
		path: ["value"],
	});

type AmendmentFormValues = z.infer<typeof amendmentFormSchema>;

interface AmendmentsTabProps {
	amendments?: ContractAmendment[];
	measurements: ContractMeasurement[];
	isLoading?: boolean;
	isSaving?: boolean;
	isDeleting?: boolean;
	onCreate?: (input: CreateContractAmendmentInput) => void;
	onUpdate?: (id: string, input: UpdateContractAmendmentInput) => void;
	onDelete?: (id: string) => void;
	onDecide?: (id: string, decision: "APPROVE" | "REJECT") => void;
}

export function AmendmentsTab({
	amendments,
	measurements,
	isLoading,
	isSaving,
	isDeleting,
	onCreate,
	onUpdate,
	onDelete,
	onDecide,
}: AmendmentsTabProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [editing, setEditing] = useState<ContractAmendment | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const prevSaving = useRef(isSaving);
	const prevDeleting = useRef(isDeleting);

	useEffect(() => {
		if (prevSaving.current && !isSaving) {
			setShowAdd(false);
			setEditing(null);
		}
		prevSaving.current = isSaving;
	}, [isSaving]);

	useEffect(() => {
		if (prevDeleting.current && !isDeleting) {
			setDeleteId(null);
		}
		prevDeleting.current = isDeleting;
	}, [isDeleting]);

	const form = useForm<AmendmentFormValues>({
		resolver: zodResolver(amendmentFormSchema),
		defaultValues: {
			kind: "ADITIVO",
			value: "",
			reason: "",
			date: new Date().toISOString().slice(0, 10),
			measurementIds: [],
		},
	});

	const openCreate = () => {
		form.reset({
			kind: "ADITIVO",
			value: "",
			reason: "",
			date: new Date().toISOString().slice(0, 10),
			measurementIds: [],
		});
		setEditing(null);
		setShowAdd(true);
	};

	const openEdit = (amendment: ContractAmendment) => {
		form.reset({
			kind: amendment.kind,
			value: amendment.value.toString(),
			reason: amendment.reason,
			date: amendment.date?.slice(0, 10) ?? "",
			measurementIds: amendment.measurementIds ?? [],
		});
		setEditing(amendment);
		setShowAdd(true);
	};

	const handleSubmit = (values: AmendmentFormValues) => {
		const input: CreateContractAmendmentInput = {
			kind: values.kind,
			value: parseCurrencyToNumber(values.value) ?? 0,
			reason: values.reason,
			date: values.date,
			measurementIds: values.measurementIds,
		};
		if (editing) {
			onUpdate?.(editing.id, input);
		} else {
			onCreate?.(input);
		}
	};

	if (isLoading) return <LoadingSpinner title="Carregando aditivos..." />;
	if (!amendments) {
		return (
			<EmptyState
				icon={<FilePlus2 className="h-12 w-12" />}
				title="Não foi possível carregar os aditivos."
				description="Tente novamente."
			/>
		);
	}

	return (
		<Card>
			<CardHeaderWithIcon
				icon={FilePlus2}
				title="Aditivos do Contrato"
				description="Acréscimos e reduções que compõem o valor total do contrato."
			/>
			<CardContent>
				<div className="mb-4">
					<Button variant="default" size="sm" onClick={openCreate}>
						<Plus className="mr-2 h-4 w-4" />
						Novo aditivo
					</Button>
				</div>

				{amendments.length === 0 ? (
					<EmptyState
						icon={<FilePlus2 className="h-12 w-12" />}
						title="Nenhum aditivo cadastrado."
						description="Registre aditivos para ajustar o valor do contrato."
					/>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Tipo</TableHead>
									<TableHead className="text-right">Valor</TableHead>
									<TableHead>Data</TableHead>
									<TableHead>Motivo</TableHead>
									<TableHead>Medicoes</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{amendments.map((amendment) => (
									<TableRow key={amendment.id}>
										<TableCell>
											<Badge
												variant={
													amendment.kind === "ADITIVO" ? "default" : "secondary"
												}
											>
												{amendment.kind === "ADITIVO" ? "Aditivo" : "Redução"}
											</Badge>
										</TableCell>
										<TableCell
											className={
												amendment.kind === "ADITIVO"
													? "text-right font-medium text-primary"
													: "text-right font-medium text-destructive"
											}
										>
											{amendment.kind === "ADITIVO" ? "+" : "−"}
											{formatCurrency(amendment.value)}
										</TableCell>
										<TableCell>{formatDate(amendment.date)}</TableCell>
										<TableCell>{amendment.reason}</TableCell>
										<TableCell>
											<Badge variant="outline">
												{APPROVAL_STATUS_LABELS[amendment.approvalStatus] ??
													amendment.approvalStatus}
											</Badge>
										</TableCell>
										<TableCell>
											{amendment.measurementIds?.length ?? 0}
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => openEdit(amendment)}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												{amendment.approvalStatus === "PENDING_GESTOR" ||
												amendment.approvalStatus === "PENDING_GERENTE" ? (
													<Button
														size="sm"
														variant="outline"
														onClick={() => onDecide?.(amendment.id, "APPROVE")}
													>
														Aprovar
													</Button>
												) : null}
												<Button
													variant="ghost"
													size="icon"
													onClick={() => setDeleteId(amendment.id)}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				<Dialog open={showAdd} onOpenChange={setShowAdd}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editing ? "Editar Aditivo" : "Novo Aditivo"}
							</DialogTitle>
						</DialogHeader>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-3"
						>
							<Controller
								name="kind"
								control={form.control}
								render={({ field, fieldState }) => (
									<SelectFormField
										label="Tipo"
										placeholder="Selecione..."
										options={AMENDMENT_KIND_OPTIONS}
										field={field}
										fieldState={fieldState}
									/>
								)}
							/>
							<Controller
								name="measurementIds"
								control={form.control}
								render={({ field, fieldState }) => (
									<div className="space-y-2">
										<span className="text-sm font-medium">
											Medições vinculadas
										</span>
										<div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
											{measurements.length === 0 ? (
												<p className="text-sm text-muted-foreground">
													Crie uma medição antes de cadastrar o aditivo.
												</p>
											) : (
												measurements.map((measurement) => {
													const checked = field.value.includes(measurement.id);
													return (
														<div
															key={measurement.id}
															className="flex items-center gap-2 text-sm"
														>
															<Checkbox
																checked={checked}
																onCheckedChange={(next) =>
																	field.onChange(
																		next
																			? [...field.value, measurement.id]
																			: field.value.filter(
																					(id) => id !== measurement.id,
																				),
																	)
																}
															/>
															<span>
																#{measurement.number} -{" "}
																{measurement.title || "Medição"}
															</span>
														</div>
													);
												})
											)}
										</div>
										{fieldState.error && (
											<p className="text-sm text-destructive">
												{fieldState.error.message}
											</p>
										)}
									</div>
								)}
							/>
							<Controller
								name="value"
								control={form.control}
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
								name="date"
								control={form.control}
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
								name="reason"
								control={form.control}
								render={({ field, fieldState }) => (
									<InputFormField
										label="Motivo"
										field={field}
										fieldState={fieldState}
										as="textarea"
										placeholder="Motivo do aditivo..."
									/>
								)}
							/>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setShowAdd(false)}
								>
									Cancelar
								</Button>
								<Button type="submit" loading={isSaving}>
									Salvar
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>

				<ConfirmDialog
					open={!!deleteId}
					title="Excluir aditivo?"
					description="Esta ação não pode ser desfeita."
					onConfirm={() => {
						if (deleteId) onDelete?.(deleteId);
					}}
					onCancel={() => setDeleteId(null)}
					loading={isDeleting}
				/>
			</CardContent>
		</Card>
	);
}
