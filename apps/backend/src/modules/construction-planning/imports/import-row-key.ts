import type { ImportValidationError } from "../types";

function canonicalIssueSheet(sheet: string): string {
	const normalized = sheet
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
	return normalized === "medicoes" || normalized === "medicoes obra"
		? "Medicoes Obra"
		: sheet;
}

export function importIssueKey(error: ImportValidationError): string {
	return `${canonicalIssueSheet(error.sheet ?? "")}:${error.row ?? ""}`;
}
