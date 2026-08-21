import type { ImportValidationError } from "@/types/import";
import type { WorkSupplier } from "@/types/suppliers";
import { api } from "./api";

export type SupplierImportParseResult = {
	rows: Array<{
		rowNumber: number;
		name: string;
		document: string;
		contact: string | null;
	}>;
	errors: ImportValidationError[];
};

export async function listWorkSuppliers(workId: string) {
	const { data } = await api.get<WorkSupplier[]>(
		`/construction/works/${workId}/suppliers`,
	);
	return data;
}
