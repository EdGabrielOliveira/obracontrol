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
	const endpoint =
		kind === "medicao-obra" && workId
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
	const { data } = await api.get<Blob>(
		`/construction/templates/orcamento-aditivo/${workId}`,
		{ responseType: "blob" },
	);
	return data;
}

export async function downloadScheduleTemplate(workId: string): Promise<Blob> {
	const { data } = await api.get<Blob>(
		`/construction/templates/cronograma/${workId}`,
		{ responseType: "blob" },
	);
	return data;
}
