import { FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ScheduleImportDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pending?: boolean;
	error?: string | null;
	onImport: (file: File) => void;
	onDownloadTemplate: () => void;
	templatePending?: boolean;
};

export function ScheduleImportDialog({
	open,
	onOpenChange,
	pending = false,
	error,
	onImport,
	onDownloadTemplate,
	templatePending = false,
}: ScheduleImportDialogProps) {
	const [file, setFile] = useState<File | null>(null);

	useEffect(() => {
		if (!open) setFile(null);
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Importar cronograma</DialogTitle>
					<DialogDescription>
						Você pode cadastrar a obra primeiro e enviar o cronograma depois. O
						modelo contextualizado já traz os índices e nomes do orçamento
						vigente.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onDownloadTemplate}
						disabled={templatePending || pending}
					>
						<FileSpreadsheet className="mr-2 h-4 w-4" />
						{templatePending
							? "Baixando modelo..."
							: "Baixar modelo com índices"}
					</Button>
					<div className="space-y-2">
						<label
							htmlFor="schedule-import-file"
							className="text-sm font-medium"
						>
							Planilha Excel (.xlsx)
						</label>
						<Input
							id="schedule-import-file"
							type="file"
							accept=".xlsx"
							disabled={pending}
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						/>
						<p className="text-xs text-muted-foreground">
							Preencha as datas das linhas que farão parte do cronograma. Linhas
							sem data serão ignoradas.
						</p>
					</div>
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						disabled={!file || pending}
						onClick={() => file && onImport(file)}
					>
						<Upload className="mr-2 h-4 w-4" />
						{pending ? "Importando..." : "Importar cronograma"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
