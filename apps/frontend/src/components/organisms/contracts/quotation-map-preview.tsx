import {
	IMPORT_PREVIEW_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ImportPreviewPage, ImportPreviewRow } from "@/types/import";
import { formatCurrency, formatDate } from "@/utils/format";

interface QuotationMapPreviewProps {
	preview: ImportPreviewPage;
	selectedRowIds?: string[];
	onSelectionChange?: (rowIds: string[]) => void;
	readOnly?: boolean;
}

const COLUMNS: Array<{ label: string; aliases: string[] }> = [
	{ label: "CNPJ", aliases: ["CNPJ", "Documento", "supplierDocument"] },
	{
		label: "Razão Social",
		aliases: [
			"Razão Social",
			"Razão Social / Nome da Empresa",
			"Fornecedor",
			"supplierName",
		],
	},
	{
		label: "Endereço Completo",
		aliases: ["Endereço Completo", "Endereco Completo", "supplierAddress"],
	},
	{ label: "Telefone", aliases: ["Telefone", "supplierPhone"] },
	{ label: "E-mail", aliases: ["E-mail", "Email", "supplierEmail"] },
	{
		label: "Responsável",
		aliases: ["Responsável", "Responsavel", "supplierResponsible"],
	},
	{
		label: "Descrição do Serviço",
		aliases: [
			"Descrição do Serviço",
			"Descrição do Serviço / Empreitada",
			"Descricao do Servico",
			"serviceDescription",
		],
	},
	{
		label: "Valor do Serviço",
		aliases: [
			"Valor do Serviço",
			"Valor da Empreitada (R$)",
			"Valor da proposta",
			"value",
		],
	},
	{
		label: "Data de Início",
		aliases: ["Data de Início", "Data de inicio", "serviceStartDate"],
	},
	{
		label: "Prazo de Execução",
		aliases: [
			"Prazo de Execução",
			"Prazo de Execução (dias)",
			"executionTermDays",
		],
	},
	{
		label: "Condição de Pagamento",
		aliases: [
			"Condição de Pagamento",
			"Condições de Pagamento",
			"paymentTerms",
		],
	},
	{ label: "Observações", aliases: ["Observações", "Observacoes", "notes"] },
];

function cellValue(row: ImportPreviewRow, aliases: string[]): unknown {
	for (const alias of aliases) {
		const value = row.values[alias];
		if (value !== null && value !== undefined && String(value).trim() !== "") {
			return value;
		}
	}
	return null;
}

function formatCell(
	row: ImportPreviewRow,
	column: { label: string; aliases: string[] },
): string {
	const value = cellValue(row, column.aliases);
	if (value === null) return "Indisponível";
	if (typeof value === "number") {
		if (column.label === "Valor do Serviço") return formatCurrency(value);
		if (column.label === "Prazo de Execução") return String(value);
		return String(value);
	}
	const text = String(value);
	if (column.label === "Data de Início") {
		const date = new Date(text);
		if (Number.isNaN(date.getTime())) return text;
		return formatDate(text);
	}
	return text;
}

export function QuotationMapPreview({
	preview,
	selectedRowIds = [],
	onSelectionChange,
	readOnly = false,
}: QuotationMapPreviewProps) {
	const selected = new Set(selectedRowIds);
	const rowLabel = preview.summary.total === 1 ? "linha" : "linhas";

	const toggle = (rowId: string, checked: boolean) => {
		const next = new Set(selected);
		if (checked) next.add(rowId);
		else next.delete(rowId);
		onSelectionChange?.([...next]);
	};

	return (
		<section className="space-y-4 rounded-xl border bg-card p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 className="font-semibold">Prévia do mapa de cotação</h2>
					<p className="text-sm text-muted-foreground">
						{preview.summary.total} {rowLabel} · {preview.summary.valid} válidas
						· {preview.summary.invalid} inválidas
					</p>
				</div>
				{!readOnly ? (
					<p className="text-sm text-muted-foreground">
						{selectedRowIds.length} selecionada(s)
					</p>
				) : null}
			</div>
			{preview.summary.total === 0 ? (
				<div className="status-warning rounded-lg p-3 text-sm">
					<p className="font-medium">
						Nenhuma linha de proposta foi encontrada.
					</p>
					<p className="mt-1">
						Use o modelo de mapa de cotação e mantenha a aba “Mapa de Cotacao”
						com as colunas CNPJ, Razão Social e Valor do Serviço. O arquivo pode
						ter colunas adicionais, mas precisa conter pelo menos uma linha de
						fornecedor.
					</p>
				</div>
			) : null}

			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full min-w-[1280px] text-sm">
					<thead className="bg-muted/50 text-left">
						<tr>
							{!readOnly ? <th className="w-12 p-3">Usar</th> : null}
							<th className="p-3">Linha</th>
							{COLUMNS.map((column) => (
								<th key={column.label} className="p-3">
									{column.label}
								</th>
							))}
							<th className="p-3">Status</th>
						</tr>
					</thead>
					<tbody>
						{preview.rows.map((row) => (
							<tr key={row.id} className="border-t align-top">
								{!readOnly ? (
									<td className="p-3">
										<Checkbox
											checked={selected.has(row.id)}
											disabled={row.status === "INVALID"}
											onCheckedChange={(checked) =>
												toggle(row.id, checked === true)
											}
											aria-label={`Selecionar linha ${row.rowNumber}`}
										/>
									</td>
								) : null}
								<td className="p-3">{row.rowNumber}</td>
								{COLUMNS.map((column) => (
									<td key={column.label} className="p-3">
										{formatCell(row, column)}
										{column.label === "CNPJ" && row.issues.length > 0 ? (
											<div className="mt-1 space-y-1 text-xs text-destructive">
												{row.issues.map((issue) => (
													<p
														key={`${issue.code}-${issue.column ?? "row"}-${issue.message}`}
													>
														{issue.message}
													</p>
												))}
											</div>
										) : null}
									</td>
								))}
								<td className="p-3">
									<StatusBadge
										status={row.status}
										map={IMPORT_PREVIEW_STATUS_MAP}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
