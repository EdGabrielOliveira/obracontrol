import type { MeasurementCoverage } from "@/types/measurements";
import { api } from "./api";

export async function listMeasurementCoverages(workId: string) {
	const { data } = await api.get<MeasurementCoverage[]>(
		`/construction/works/${workId}/measurement-coverages`,
	);
	return data;
}
