import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { InputFormField } from "@/components/molecules/FormField";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type CostCenterFormValues,
	costCenterFormSchema,
} from "@/schemas/organizations";
import type { CreateCostCenterInput } from "@/types/organizations";

interface OrganizationOption {
	id: string;
	name: string;
}

interface CostCenterFormProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (data: CreateCostCenterInput) => void;
	loading?: boolean;
	organizations?: OrganizationOption[];
	defaultOrganizationId?: string;
}

export function CostCenterForm({
	open,
	onClose,
	onSubmit,
	loading,
	organizations,
	defaultOrganizationId,
}: CostCenterFormProps) {
	const showOrgSelector = organizations && organizations.length > 0;
	const { control, handleSubmit, reset } = useForm<CostCenterFormValues>({
		resolver: zodResolver(costCenterFormSchema),
		defaultValues: {
			name: "",
			organizationId: defaultOrganizationId ?? "",
		},
	});

	const handleSubmitWrapper = (data: CostCenterFormValues) => {
		onSubmit({ name: data.name } as CreateCostCenterInput);
		reset();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) {
					onClose();
					reset();
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Novo Centro de Custo</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={handleSubmit(handleSubmitWrapper)}
					className="space-y-4"
				>
					{showOrgSelector && (
						<Controller
							name="organizationId"
							control={control}
							render={({ field, fieldState }) => (
								<div className="space-y-2">
									<span className="text-sm font-medium">Orgão</span>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o orgão" />
										</SelectTrigger>
										<SelectContent>
											{organizations.map((org) => (
												<SelectItem key={org.id} value={org.id}>
													{org.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.error && (
										<p className="text-xs text-destructive">
											{fieldState.error.message}
										</p>
									)}
								</div>
							)}
						/>
					)}
					<Controller
						name="name"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Nome"
								field={field}
								fieldState={fieldState}
								placeholder="Nome do CC"
							/>
						)}
					/>
					<Button type="submit" loading={loading}>
						Salvar
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
