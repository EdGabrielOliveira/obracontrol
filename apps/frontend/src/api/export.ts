import { api } from "./api";

export type ExportMode = "raw" | "report";

function exportParams(asOfDate?: string, mode?: ExportMode) {
	return { ...(asOfDate ? { asOfDate } : {}), ...(mode ? { mode } : {}) };
}

export async function exportOrcamento(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/export/orcamento`,
		{
			responseType: "blob",
			params: exportParams(asOfDate, mode),
		},
	);
	return data;
}

export async function exportMedicoes(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/export/medicoes`,
		{
			responseType: "blob",
			params: exportParams(asOfDate, mode),
		},
	);
	return data;
}

export async function exportCustos(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/export/custos`,
		{
			responseType: "blob",
			params: exportParams(asOfDate, mode),
		},
	);
	return data;
}

export async function exportContratos(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/export/contratos`,
		{
			responseType: "blob",
			params: exportParams(asOfDate, mode),
		},
	);
	return data;
}

export async function exportCompleto(
	workId: string,
	asOfDate?: string,
	mode?: ExportMode,
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/export/completo`,
		{
			responseType: "blob",
			params: exportParams(asOfDate, mode),
		},
	);
	return data;
}

export async function exportEstatisticasObra(
	workId: string,
	period?: "daily" | "weekly" | "monthly",
): Promise<Blob> {
	const { data } = await api.get(
		`/construction/works/${workId}/export/estatisticas`,
		{ responseType: "blob", params: period ? { period } : undefined },
	);
	return data;
}

export async function exportFornecedores(): Promise<Blob> {
	const { data } = await api.get("/construction/export/fornecedores", {
		responseType: "blob",
	});
	return data;
}

export async function exportEstatisticasGerais(): Promise<Blob> {
	const { data } = await api.get("/construction/export/estatisticas-gerais", {
		responseType: "blob",
	});
	return data;
}

export async function exportEstatisticasOrganizacao(
	organizationId: string,
): Promise<Blob> {
	const { data } = await api.get(
		`/organizations/${organizationId}/export/estatisticas`,
		{ responseType: "blob" },
	);
	return data;
}

export async function exportEstatisticasCentroCusto(
	organizationId: string,
	costCenterId: string,
): Promise<Blob> {
	const { data } = await api.get(
		`/organizations/${organizationId}/cost-centers/${costCenterId}/export/estatisticas`,
		{ responseType: "blob" },
	);
	return data;
}
