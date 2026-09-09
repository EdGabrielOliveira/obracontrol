import { ConstructionError } from "../../../lib/errors";
import { MAX_IMPORT_UPLOAD_BYTES } from "../imports/import-limits";

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
	if (file.size > MAX_IMPORT_UPLOAD_BYTES) {
		throw new ConstructionError(
			"FILE_TOO_LARGE",
			"Arquivo deve ter no maximo 25MB",
			413,
		);
	}
}
