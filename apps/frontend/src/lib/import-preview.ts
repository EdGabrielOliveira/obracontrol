import type { ImportPreviewRow, ImportPreviewRowStatus } from "@/types/import";

export type PreviewTableRow = {
	id: string;
	sheet: string;
	rowNumber: number;
	column: string;
	originalValue: string;
	normalizedValue: string;
	status: ImportPreviewRowStatus;
	code: string;
	message: string;
};

function stringifyValue(value: unknown): string {
	if (value == null || value === "") return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function toPreviewTableRow(row: ImportPreviewRow): PreviewTableRow {
	const firstIssue = row.issues[0];
	const rawValues = Object.values(row.values ?? {});

	return {
		id: row.id,
		sheet: row.sheet,
		rowNumber: row.rowNumber,
		column: firstIssue?.column ?? "",
		originalValue:
			rawValues.length > 0 ? rawValues.map(stringifyValue).join(" · ") : "—",
		normalizedValue: firstIssue?.value ?? "",
		status: row.status,
		code: firstIssue?.code ?? "OK",
		message: firstIssue?.message ?? "",
	};
}
