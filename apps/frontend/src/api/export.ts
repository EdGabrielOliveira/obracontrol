import { api } from "./api";

export type ExportMode = "raw" | "report";

function exportParams(asOfDate?: string, mode?: ExportMode) {
	return { ...(asOfDate ? { asOfDate } : {}), ...(mode ? { mode } : {}) };
}

async function getBlob(
	url: string,
	params?: Record<string, unknown>,
): Promise<Blob> {
	const { data } = await api.get<Blob>(url, {
		responseType: "blob",
		...(params ? { params } : {}),
	});
	return data;
}

function workExport(
	workId: string,
	kind: "orcamento" | "medicoes" | "custos" | "contratos" | "completo",
	asOfDate?: string,
	mode?: ExportMode,
) {
	return getBlob(
		`/construction/works/${workId}/export/${kind}`,
		exportParams(asOfDate, mode),
	);
}

export async function exportOrcamento(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	return workExport(workId, "orcamento", asOfDate, mode);
}

export async function exportMedicoes(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	return workExport(workId, "medicoes", asOfDate, mode);
}

export async function exportCustos(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	return workExport(workId, "custos", asOfDate, mode);
}

export async function exportContratos(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	return workExport(workId, "contratos", asOfDate, mode);
}

export async function exportCompleto(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	return workExport(workId, "completo", asOfDate, mode);
}

export async function exportEstatisticasObra(
	workId: string,
	period?: "daily" | "weekly" | "monthly",
): Promise<Blob> {
	return getBlob(
		`/construction/works/${workId}/export/estatisticas`,
		period ? { period } : undefined,
	);
}

export async function exportFornecedores(): Promise<Blob> {
	return getBlob("/construction/export/fornecedores");
}

export async function exportEstatisticasGerais(): Promise<Blob> {
	return getBlob("/construction/export/estatisticas-gerais");
}

export async function exportEstatisticasOrganizacao(
	organizationId: string,
): Promise<Blob> {
	return getBlob(`/organizations/${organizationId}/export/estatisticas`);
}

export async function exportEstatisticasCentroCusto(
	organizationId: string,
	costCenterId: string,
): Promise<Blob> {
	return getBlob(
		`/organizations/${organizationId}/cost-centers/${costCenterId}/export/estatisticas`,
	);
}
