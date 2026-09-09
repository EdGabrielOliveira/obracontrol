import type { ConstructionTemplateKind } from "@/types/import";
import { api } from "./api";

export const TEMPLATE_FILENAMES: Record<ConstructionTemplateKind, string> = {
	orcamento: "modelo-orcamento.xlsx",
	"orcamento-aditivo": "modelo-orcamento-aditivo.xlsx",
	cronograma: "modelo-cronograma.xlsx",
	"medicao-obra": "modelo-medicao-obra.xlsx",
	"medicao-contrato": "modelo-medicao-contrato.xlsx",
	custos: "modelo-custos.xlsx",
	cotacao: "modelo-cotacao.xlsx",
};

export async function downloadTemplate(
	kind: ConstructionTemplateKind,
	workId?: string,
): Promise<Blob> {
	const scopedKinds = new Set<ConstructionTemplateKind>([
		"orcamento-aditivo",
		"cronograma",
		"medicao-obra",
	]);
	const endpoint =
		workId && scopedKinds.has(kind)
			? `/construction/templates/${kind}/${workId}`
			: `/construction/templates/${kind}`;
	const { data } = await api.get<Blob>(endpoint, {
		responseType: "blob",
	});
	return data;
}

export async function downloadBudgetAmendmentTemplate(
	workId: string,
): Promise<Blob> {
	return downloadTemplate("orcamento-aditivo", workId);
}

export async function downloadScheduleTemplate(workId: string): Promise<Blob> {
	return downloadTemplate("cronograma", workId);
}
