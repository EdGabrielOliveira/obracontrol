import type { ImportPreviewRow } from "@/types/import";
import { normalizePortugueseText } from "@/utils/api-error";

const FIELD_LABELS: Record<string, string> = {
	index: "Índice",
	itemName: "Nome do item",
	measurementDate: "Data da medição",
	measuredPercentageAccumulated: "% medido acumulado",
	measuredQuantityAccumulated: "Quantidade medida acumulada",
	notes: "Observação",
	type: "Tipo",
	description: "Descrição",
	unit: "Unidade",
	quantity: "Quantidade",
	laborUnitCost: "Mão de obra unitária",
	materialUnitCost: "Material unitário",
	equipmentUnitCost: "Equipamento unitário",
	otherUnitCost: "Outros unitário",
	unitCost: "Custo unitário",
	totalCost: "Custo total",
	providedStatus: "Situação",
	plannedStart: "Início previsto",
	plannedEnd: "Fim previsto",
	plannedWeight: "Peso planejado",
	version: "Versão",
	replannedStart: "Início replanejado",
	replannedEnd: "Fim replanejado",
	revisionDate: "Data da revisão",
	reason: "Motivo",
	code: "Código",
	supplierName: "Fornecedor",
	contractValue: "Valor do contrato",
	serviceType: "Tipo de serviço",
	title: "Título",
	startDate: "Início",
	endDate: "Fim",
	status: "Situação",
	date: "Data",
	number: "Número",
	value: "Valor",
	paidValue: "Valor pago",
	discountValue: "Desconto",
	retentionValue: "Retenção",
	taxValue: "Impostos",
	costDate: "Data do lançamento",
	budgetIndex: "Índice apropriado",
	category: "Categoria",
	amount: "Valor realizado",
	costType: "Tipo de custo",
	sourceDocument: "Documento de origem",
	costGroup: "Grupo de custo",
	paymentStatus: "Situação do pagamento",
	competenceDate: "Data de competência",
	dueDate: "Data de vencimento",
	paymentDate: "Data de pagamento",
	documentNumber: "Número do documento",
	supplierDocument: "CNPJ/CPF do fornecedor",
	supplierAddress: "Endereço do fornecedor",
	supplierPhone: "Telefone do fornecedor",
	supplierEmail: "E-mail do fornecedor",
	supplierResponsible: "Responsável do fornecedor",
	serviceDescription: "Descrição do serviço",
	serviceStartDate: "Início do serviço",
	executionTermDays: "Prazo de execução (dias)",
	paymentTerms: "Condições de pagamento",
	quotationCode: "Código da cotação",
	suggestedWinner: "Vencedor sugerido",
};

const FIELD_ORDER = Object.keys(FIELD_LABELS);
const HIDDEN_PREVIEW_FIELDS = new Set(["rowNumber", "notes"]);

const SHEET_LABELS: Record<string, string> = {
	Medicoes: "Medições",
	"Medicoes Obra": "Medições de Obra",
	"Medicoes Contrato": "Medições de Contrato",
	Orcamento: "Orçamento",
	"Itens do Orcamento": "Itens do Orçamento",
	"Cronograma Original": "Cronograma Original",
	Replanejamento: "Replanejamento",
	Contrato: "Contrato",
	Servicos: "Serviços",
	Pagamentos: "Pagamentos",
	"Custos Realizados": "Custos Realizados",
	"Mapa de Cotacao": "Mapa de Cotação",
};

const DATE_FIELDS = new Set([
	"measurementDate",
	"plannedStart",
	"plannedEnd",
	"replannedStart",
	"replannedEnd",
	"revisionDate",
	"startDate",
	"endDate",
	"date",
	"costDate",
	"competenceDate",
	"dueDate",
	"paymentDate",
	"serviceStartDate",
]);

const FIELD_ALIASES: Record<string, string> = {
	Indice: "index",
	"Nome do item": "itemName",
	"Data da medicao": "measurementDate",
	"Percentual medido acumulado": "measuredPercentageAccumulated",
	"Quantidade medida acumulada": "measuredQuantityAccumulated",
	Observacao: "notes",
	Descricao: "description",
	Unidade: "unit",
	Situacao: "status",
	"Data do lancamento": "costDate",
	"Indice apropriado": "budgetIndex",
};

export function previewFieldLabel(field: string): string {
	return (
		FIELD_LABELS[field] ?? FIELD_LABELS[FIELD_ALIASES[field] ?? ""] ?? field
	);
}

function stringifyValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "object") {
		if (value instanceof Date) return value.toLocaleDateString("pt-BR");
		return JSON.stringify(value);
	}
	return String(value);
}

function excelSerialToDate(value: number): Date | null {
	if (!Number.isFinite(value) || value <= 0) return null;
	const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(value: unknown): string | null {
	if (value instanceof Date) {
		return `${String(value.getUTCDate()).padStart(2, "0")}/${String(
			value.getUTCMonth() + 1,
		).padStart(2, "0")}/${value.getUTCFullYear()}`;
	}
	if (typeof value === "number") {
		const date = excelSerialToDate(value);
		if (date) {
			return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
				date.getUTCMonth() + 1,
			).padStart(2, "0")}/${date.getUTCFullYear()}`;
		}
	}
	if (typeof value === "string") {
		const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
		if (/^\d{4,6}(?:\.\d+)?$/.test(value.trim())) {
			const date = excelSerialToDate(Number(value));
			if (date) {
				return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
					date.getUTCMonth() + 1,
				).padStart(2, "0")}/${date.getUTCFullYear()}`;
			}
		}
	}
	return null;
}

export function previewFieldValue(field: string, value: unknown): string {
	if (DATE_FIELDS.has(field)) {
		const formattedDate = formatDateValue(value);
		if (formattedDate) return formattedDate;
	}
	const rendered = stringifyValue(value);
	if (
		field === "measuredPercentageAccumulated" &&
		typeof value === "number" &&
		value >= 0 &&
		value <= 100
	) {
		const percentage = value <= 1 ? value * 100 : value;
		return `${percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
	}
	return rendered;
}

export function previewFieldKeys(rows: ImportPreviewRow[]): string[] {
	const keys = new Set(
		rows.flatMap((row) =>
			Object.keys(row.values ?? {}).filter(
				(field) =>
					!HIDDEN_PREVIEW_FIELDS.has(field) && FIELD_ALIASES[field] !== "notes",
			),
		),
	);
	return [
		...FIELD_ORDER.filter((field) => keys.has(field)),
		...Array.from(keys).filter((field) => !FIELD_ORDER.includes(field)),
	];
}

export function previewSheetLabel(sheet: string): string {
	return SHEET_LABELS[sheet] ?? normalizePortugueseText(sheet);
}

export function previewIssueLabel(
	issue: ImportPreviewRow["issues"][number],
): string {
	const field = issue.column ? `${previewFieldLabel(issue.column)}: ` : "";
	return `${field}${normalizePortugueseText(issue.message)}`;
}
