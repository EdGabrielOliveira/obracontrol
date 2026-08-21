import { describe, expect, it } from "bun:test";

import { structuredAddressSchema } from "@/schemas/works";
import type { AddressValue, CepLookup } from "@/types/address";
import { applyCepLookup } from "@/utils/address";

const emptyAddress: AddressValue = {
	zipCode: "",
	street: "",
	district: "",
	number: "",
	city: "",
	state: "",
	complement: "",
	latitude: null,
	longitude: null,
};

describe("applyCepLookup", () => {
	it("keeps absent street and district valid for a work address", () => {
		const lookup: CepLookup = {
			zipCode: "59680000",
			street: null,
			district: null,
			city: "Campo Grande",
			state: "RN",
			latitude: null,
			longitude: null,
		};

		const address = applyCepLookup(emptyAddress, lookup);

		expect(address).toMatchObject({
			street: "",
			district: "",
			number: "",
			city: "Campo Grande",
			state: "RN",
		});
		expect(structuredAddressSchema.safeParse(address).success).toBe(true);
	});
});
