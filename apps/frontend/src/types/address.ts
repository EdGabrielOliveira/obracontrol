export type AddressValue = {
	zipCode: string;
	street?: string;
	district?: string;
	number?: string;
	city: string;
	state: string;
	complement?: string;
	latitude?: number | null;
	longitude?: number | null;
};

/** Response returned by the CEP lookup endpoint.
 *
 * BrasilAPI does not guarantee a street, district, city, or state for every
 * valid CEP. Keep that nullability at the HTTP boundary and normalize it before
 * putting the response into a form value.
 */
export type CepLookup = {
	zipCode: string;
	street: string | null;
	district: string | null;
	city: string | null;
	state: string | null;
	latitude: number | null;
	longitude: number | null;
};
