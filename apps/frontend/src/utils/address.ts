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

/**
 * Keeps the optional address contract consistent across all registration forms.
 * An untouched address form is represented as null instead of an empty object,
 * so the API does not try to persist an incomplete address record.
 */
export function normalizeOptionalAddress(
	address: AddressValue | null | undefined,
): AddressValue | null {
	if (!address) return null;

	const hasAddressValue = [
		address.zipCode,
		address.street,
		address.district,
		address.number,
		address.city,
		address.state,
		address.complement,
	].some((value) => value?.trim().length);

	return hasAddressValue ||
		address.latitude != null ||
		address.longitude != null
		? address
		: null;
}

export function isCompleteAddress(address: AddressValue): boolean {
	return (
		address.zipCode.replace(/\D/g, "").length === 8 &&
		address.city.trim().length > 0 &&
		address.state.trim().length === 2
	);
}
