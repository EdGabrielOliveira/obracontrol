import type { AddressValue, CepLookup } from "@/types/address";

/**
 * Converts nullable CEP data into a value accepted by address forms.
 * Street and district are optional in the persisted address, while city and
 * state remain empty for manual completion when the lookup cannot provide them.
 */
export function applyCepLookup(
	address: AddressValue,
	lookup: CepLookup,
): AddressValue {
	return {
		...address,
		zipCode: lookup.zipCode,
		street: lookup.street ?? "",
		district: lookup.district ?? "",
		city: lookup.city ?? "",
		state: lookup.state ?? "",
		latitude: lookup.latitude,
		longitude: lookup.longitude,
	};
}
