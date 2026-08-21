import { ConstructionError } from "../../../lib/errors";

const maxUploadBytes = 10 * 1024 * 1024;
const allowedUploadTypes = new Set([
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/octet-stream",
	"",
]);

export function assertValidXlsxUpload(file: {
	name: string;
	type: string;
	size: number;
}): void {
	if (!file) {
		throw new ConstructionError("MISSING_FILE", "Arquivo obrigatorio", 400);
	}
	if (!file.name.toLowerCase().endsWith(".xlsx")) {
		throw new ConstructionError(
			"INVALID_FILE_TYPE",
			"Apenas arquivos .xlsx sao aceitos",
			400,
		);
	}
	if (!allowedUploadTypes.has(file.type)) {
		throw new ConstructionError(
			"INVALID_FILE_TYPE",
			"Tipo de arquivo invalido",
			400,
		);
	}
	if (file.size > maxUploadBytes) {
		throw new ConstructionError(
			"FILE_TOO_LARGE",
			"Arquivo deve ter no maximo 10MB",
			413,
		);
	}
}
