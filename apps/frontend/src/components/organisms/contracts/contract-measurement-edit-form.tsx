import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, ListChecks } from "lucide-react";
import { Controller, type Path, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updateContractMeasurement } from "@/api/contract-measurements";
import { contractKeys, workKeys } from "@/api/query-keys";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContractMeasurement } from "@/types/contracts";
import { getErrorMessage } from "@/utils/api-error";
import {
	formatPercentage,
	formatQuantity,
} from "@/utils/format";

const editSchema = z.object({
	title: z.string().min(1, "Título obrigatório"),
	date: z.string().min(1, "Data obrigatória"),
	notes: z.string().optional(),
	items: z.array(
		z.object({
			id: z.string(),
			serviceId: z.string().min(1),
			measuredQuantity: z.string().optional(),
		}),
	),
});

type EditValues = z.infer<typeof editSchema>;

export function ContractMeasurementEditForm({
	workId,
	contractId,
	measurement,
	serviceMap,
	onCancel,
}: {
	workId: string;
	contractId: string;
	measurement: ContractMeasurement;
	serviceMap: Map<
		string,
		{ description: string; quantity: number | null; unit: string | null }
	>;
	onCancel: () => void;
}) {
	const queryClient = useQueryClient();
	const form = useForm<EditValues>({
		resolver: zodResolver(editSchema),
		defaultValues: {
			title: measurement.title ?? "",
			date: measurement.date?.slice(0, 10) ?? "",
			notes: measurement.notes ?? "",
			items: (measurement.items ?? []).map((item) => ({
				id: item.id,
				serviceId: item.serviceId,
				measuredQuantity:
					item.measuredQuantity != null ? String(item.measuredQuantity) : "",
			})),
		},
	});

	const mutation = useMutation({
		mutationFn: (values: EditValues) =>
			updateContractMeasurement(workId, contractId, measurement.id, {
				title: values.title,
				date: values.date,
				notes: values.notes?.trim() || undefined,
				items: values.items.map((item) => ({
					id: item.id,
					serviceId: item.serviceId,
					measuredQuantity: Number(item.measuredQuantity),
				})),
			}),
		onSuccess: () => {
			toast.success("Medição atualizada!");
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurements(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementDetail(
					workId,
					contractId,
					measurement.id,
				),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementMap(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.aggregate(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.report(workId, contractId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
			onCancel();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar medição.")),
	});

	return (
		<form
			onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
			className="space-y-6"
		>
			<Card>
				<CardHeaderWithIcon
					icon={ClipboardList}
					title="Dados da medição"
					description="Atualize as informações gerais da medição."
				/>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<Controller
							name="title"
							control={form.control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Título"
									field={field}
									fieldState={fieldState}
									placeholder="Título da medição"
								/>
							)}
						/>
						<Controller
							name="date"
							control={form.control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Data"
									mode="datepicker"
									field={field}
									fieldState={fieldState}
								/>
							)}
						/>
					</div>
					<Controller
						name="notes"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Observações"
								as="textarea"
								field={field}
								fieldState={fieldState}
								placeholder="Observações da medição"
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={ListChecks}
					title="Itens da medição"
					description="Atualize a quantidade executada de cada serviço."
				/>
				<CardContent className="space-y-3">
					{(measurement.items ?? []).map((item, index) => (
						<div key={item.id} className="rounded-lg border p-4">
							<div className="mb-3">
								<p className="font-medium">
									{serviceMap.get(item.serviceId)?.description ?? item.serviceId}
								</p>
								<p className="text-xs text-muted-foreground">
									Quantidade contratada: {formatQuantity(serviceMap.get(item.serviceId)?.quantity)}{" "}
									{serviceMap.get(item.serviceId)?.unit ?? ""}
								</p>
							</div>
							<div className="grid gap-4 md:grid-cols-2">
								<Controller
									name={`items.${index}.measuredQuantity` as Path<EditValues>}
									control={form.control}
									render={({ field, fieldState }) => (
										<InputFormField
											label="Quantidade medida"
											field={field}
											fieldState={fieldState}
											type="number"
											step="0.0001"
											min="0"
											placeholder="0"
										/>
									)}
								/>
								<div className="rounded-md border border-dashed px-3 py-2 text-sm">
									<p className="text-xs text-muted-foreground">% referente</p>
									<p className="font-medium">
										{(() => {
											const quantity = Number(form.watch(`items.${index}.measuredQuantity`));
											const contracted = Number(serviceMap.get(item.serviceId)?.quantity);
											return quantity > 0 && contracted > 0
												? formatPercentage((quantity / contracted) * 100)
												: "—";
										})()}
									</p>
								</div>
							</div>
						</div>
					))}
					{(measurement.items ?? []).length === 0 && (
						<p className="text-sm text-muted-foreground">
							Esta medição não possui itens registrados.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button type="submit" loading={mutation.isPending}>
					Salvar alterações
				</Button>
			</div>
		</form>
	);
}
