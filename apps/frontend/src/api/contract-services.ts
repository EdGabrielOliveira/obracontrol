import type {
	ContractService,
	CreateContractServiceInput,
} from "@/types/contracts";
import { api } from "./api";

export async function listContractServices(workId: string, contractId: string) {
	const { data } = await api.get<ContractService[]>(
		`/construction/works/${workId}/contracts/${contractId}/services`,
	);
	return data;
}

export async function updateContractService(
	workId: string,
	contractId: string,
	serviceId: string,
	input: Partial<CreateContractServiceInput>,
) {
	const { data } = await api.patch<ContractService>(
		`/construction/works/${workId}/contracts/${contractId}/services/${serviceId}`,
		input,
	);
	return data;
}
