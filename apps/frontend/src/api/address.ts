import type { CepLookup } from "@/types/address";
import { api } from "./api";

export async function lookupCep(cep: string) {
	const { data } = await api.get<CepLookup>(
		`/organizations/address/cep/${encodeURIComponent(cep)}`,
	);
	return data;
}
