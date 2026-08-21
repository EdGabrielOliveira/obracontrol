import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import type { ComponentProps } from "react";
import { useRef } from "react";
import { toast } from "sonner";
import { importWorkbookKind } from "@/api/import";
import { contractKeys, workKeys } from "@/api/query-keys";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/utils/api-error";

interface ContractMeasurementImportActionProps {
	workId: string;
	contractId: string;
	buttonProps?: Omit<ComponentProps<typeof Button>, "onClick" | "children">;
	children: React.ReactNode;
}

export function ContractMeasurementImportAction({
	workId,
	contractId,
	buttonProps,
	children,
}: ContractMeasurementImportActionProps) {
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const { requestCreationConfirmation } = useCreationConfirmation();

	const mutation = useMutation({
		mutationFn: (file: File) =>
			importWorkbookKind("medicao-contrato", file, { workId, contractId }),
		onSuccess: (result) => {
			toast.success(
				`Importação concluída: ${result.importedCount} registro(s) aplicado(s).`,
			);
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementsBase(workId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.services(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.aggregate(workId, contractId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Falha ao importar medições."));
		},
	});

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".xlsx"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) requestCreationConfirmation(() => mutation.mutate(file));
					event.target.value = "";
				}}
			/>
			<Button
				{...buttonProps}
				onClick={() => inputRef.current?.click()}
				loading={mutation.isPending}
			>
				{mutation.isPending ? (
					<Download className="h-4 w-4" />
				) : (
					<FileUp className="h-4 w-4" />
				)}
				{children}
			</Button>
		</>
	);
}
