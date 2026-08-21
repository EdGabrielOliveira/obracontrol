import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { CreateScheduleRevisionInput } from "@/api/schedule";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ScheduleItem } from "@/types/schedule";

const scheduleRevisionSchema = z
	.object({
		index: z.string().min(1, "Selecione um item do orçamento"),
		version: z.string().optional(),
		replannedStart: z.string().min(1, "Data de início obrigatória"),
		replannedEnd: z.string().min(1, "Data de fim obrigatória"),
		revisionDate: z.string().optional(),
		reason: z.string().optional(),
	})
	.refine((values) => values.replannedEnd >= values.replannedStart, {
		message: "O fim replanejado deve ser maior ou igual ao início.",
		path: ["replannedEnd"],
	});

type ScheduleRevisionFormValues = z.infer<typeof scheduleRevisionSchema>;

interface ScheduleRevisionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: ScheduleItem[];
	onSubmit: (values: CreateScheduleRevisionInput) => void;
}

export function ScheduleRevisionModal({
	open,
	onOpenChange,
	items,
	onSubmit,
}: ScheduleRevisionModalProps) {
	const { handleSubmit, reset, control } = useForm<ScheduleRevisionFormValues>({
		resolver: zodResolver(scheduleRevisionSchema),
		defaultValues: {
			index: "",
			version: "",
			replannedStart: new Date().toISOString().slice(0, 10),
			replannedEnd: new Date().toISOString().slice(0, 10),
			revisionDate: new Date().toISOString().slice(0, 10),
			reason: "",
		},
	});

	const itemOptions = items.map((item) => ({
		id: item.index,
		value: item.index,
		label: `${item.index} — ${item.description}`,
	}));

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) reset();
			}}
		>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>Novo replanejamento</DialogTitle>
					<DialogDescription>
						Registre uma revisão de datas para um item do orçamento.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={handleSubmit((values) => {
						onSubmit({
							index: values.index,
							version: values.version || undefined,
							replannedStart: values.replannedStart,
							replannedEnd: values.replannedEnd,
							revisionDate: values.revisionDate || undefined,
							reason: values.reason || undefined,
						});
						reset();
					})}
					className="space-y-4"
				>
					<Controller
						name="index"
						control={control}
						render={({ field, fieldState }) => (
							<SelectFormField
								label="Item do orçamento"
								placeholder="Selecione..."
								options={itemOptions}
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<div className="grid grid-cols-2 gap-4">
						<Controller
							name="version"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Versão (opcional)"
									field={field}
									fieldState={fieldState}
									placeholder="Ex: R1"
								/>
							)}
						/>
						<Controller
							name="revisionDate"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Data da revisão"
									field={field}
									fieldState={fieldState}
									mode="datepicker"
								/>
							)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<Controller
							name="replannedStart"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Início replanejado"
									field={field}
									fieldState={fieldState}
									mode="datepicker"
								/>
							)}
						/>
						<Controller
							name="replannedEnd"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Fim replanejado"
									field={field}
									fieldState={fieldState}
									mode="datepicker"
								/>
							)}
						/>
					</div>
					<Controller
						name="reason"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Motivo (opcional)"
								field={field}
								fieldState={fieldState}
								placeholder="Ex: Atraso de fornecedor, chuva..."
							/>
						)}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit">Registrar</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
