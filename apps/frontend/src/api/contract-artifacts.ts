import { api } from "./api";

export type ContractArtifact = {
	id: string;
	version: number;
	filename: string;
	mimeType: string;
	sha256: string;
	templateSha256: string;
	catalogVersion: string;
	generatedBy: string;
	generatedAt: string;
};

export type ContractInstrumentRequirement = {
	code: string;
	field: string;
	message: string;
	resource: "EMPRESA" | "CONTRATO" | "FORNECEDOR" | "OBRA";
	complete: boolean;
};

export type ContractInstrumentReadiness = {
	ready: boolean;
	requirements: ContractInstrumentRequirement[];
};

export async function getContractInstrumentReadiness(
	workId: string,
	contractId: string,
) {
	const { data } = await api.get<ContractInstrumentReadiness>(
		`/construction/works/${workId}/contracts/${contractId}/instrument/readiness`,
	);
	return data;
}

export async function listContractArtifacts(
	workId: string,
	contractId: string,
) {
	const { data } = await api.get<ContractArtifact[]>(
		`/construction/works/${workId}/contracts/${contractId}/instrument/artifacts`,
	);
	return data;
}

export async function generateContractArtifact(
	workId: string,
	contractId: string,
) {
	const { data } = await api.post<ContractArtifact>(
		`/construction/works/${workId}/contracts/${contractId}/instrument/artifacts`,
	);
	return data;
}

export async function downloadContractArtifact(
	workId: string,
	contractId: string,
	artifactId: string,
) {
	const { data } = await api.get<Blob>(
		`/construction/works/${workId}/contracts/${contractId}/instrument/artifacts/${artifactId}/download`,
		{ responseType: "blob" },
	);
	return data;
}
