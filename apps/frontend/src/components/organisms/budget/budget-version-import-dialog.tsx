import { FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
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
import type { BudgetVersionImportPreview } from "@/types/budget";
import { formatCurrency } from "@/utils/format";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	preview: BudgetVersionImportPreview | null;
	previewPending: boolean;
	confirmPending: boolean;
	templateDownloadPending: boolean;
	onPreview: (input: { title: string; file: File }) => void;
	onConfirm: (importId: string, sourceVersionId: string | null) => void;
	onDownloadTemplate: () => void;
};

export function BudgetVersionImportDialog({
	open,
	onOpenChange,
	preview,
	previewPending,
	confirmPending,
	templateDownloadPending,
	onPreview,
	onConfirm,
	onDownloadTemplate,
}: Props) {
	const [title, setTitle] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const canPreview = title.trim().length > 0 && file !== null;
	const conflicts = preview?.comparison.blockingIssues ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Novo orçamento ou aditivo</DialogTitle>
					<DialogDescription>
						Envie a planilha completa para comparar a estrutura, as quantidades,
						os valores e as datas antes de criar o rascunho. Alterações de
						cronograma também são aceitas.
					</DialogDescription>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-fit"
						disabled={templateDownloadPending}
						onClick={onDownloadTemplate}
					>
						<FileSpreadsheet className="mr-2 h-4 w-4" />
						{templateDownloadPending
							? "Baixando modelo..."
							: "Baixar modelo padrão"}
					</Button>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<label
							htmlFor="budget-version-title"
							className="text-sm font-medium"
						>
							Título
						</label>
						<Input
							id="budget-version-title"
							value={title}
							maxLength={120}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Ex.: Aditivo 01 - Fundação"
						/>
					</div>
					<div className="space-y-2">
						<label
							htmlFor="budget-version-file"
							className="text-sm font-medium"
						>
							Planilha Excel
						</label>
						<Input
							id="budget-version-file"
							type="file"
							accept=".xlsx"
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						/>
					</div>
					<Button
						type="button"
						disabled={!canPreview || previewPending}
						onClick={() => file && onPreview({ title: title.trim(), file })}
					>
						<Upload className="mr-2 h-4 w-4" />
						{previewPending ? "Gerando preview..." : "Gerar preview"}
					</Button>

					{preview ? (
						<div className="space-y-3 rounded-lg border p-4">
							<div className="flex items-center gap-2 text-sm font-medium">
								<FileSpreadsheet className="h-4 w-4" />
								Preview{" "}
								{preview.role === "ADITIVO"
									? "do aditivo"
									: "do orçamento original"}
							</div>
							<div className="grid gap-2 text-sm sm:grid-cols-4">
								<span>
									Total candidato:{" "}
									{formatCurrency(preview.comparison.candidateTotal)}
								</span>
								<span>
									Acréscimo: {formatCurrency(preview.comparison.grossIncrease)}
								</span>
								<span>
									Supressão: {formatCurrency(preview.comparison.suppression)}
								</span>
								<span>
									Impacto: {formatCurrency(preview.comparison.netImpact)}
								</span>
							</div>
							{conflicts.length > 0 ? (
								<div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
									{conflicts.map((conflict) => (
										<p key={`${conflict.code}-${conflict.itemIndex}`}>
											{conflict.itemIndex}: {conflict.message}
										</p>
									))}
								</div>
							) : (
								<p className="text-sm text-success">
									Nenhum conflito bloqueante encontrado.
								</p>
							)}
							<div className="max-h-48 space-y-1 overflow-y-auto text-sm">
								{preview.comparison.rows.map((row) => (
									<div
										key={row.itemIndex}
										className="flex justify-between border-b py-1"
									>
										<span>
											{row.itemIndex} · {row.description}
										</span>
										<span>{row.classification.join(", ")}</span>
									</div>
								))}
							</div>
						</div>
					) : null}
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
						disabled={!preview || conflicts.length > 0 || confirmPending}
						onClick={() =>
							preview && onConfirm(preview.batchId, preview.sourceVersionId)
						}
					>
						{confirmPending ? "Confirmando..." : "Confirmar versão"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
