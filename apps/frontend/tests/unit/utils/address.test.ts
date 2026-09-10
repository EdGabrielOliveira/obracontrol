import { describe, expect, it } from "bun:test";

import { structuredAddressSchema } from "@/schemas/works";
import type { AddressValue, CepLookup } from "@/types/address";
import {
	applyCepLookup,
	isCompleteAddress,
	normalizeOptionalAddress,
} from "@/utils/address";

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

	it("normalizes an untouched address form to null", () => {
		expect(normalizeOptionalAddress(emptyAddress)).toBeNull();
	});

	it("keeps a filled address for persistence", () => {
		const address = {
			...emptyAddress,
			zipCode: "01310100",
			city: "São Paulo",
			state: "SP",
		};

		expect(normalizeOptionalAddress(address)).toMatchObject(address);
		expect(isCompleteAddress(address)).toBe(true);
	});

	it("rejects a partially filled address before persistence", () => {
		expect(
			isCompleteAddress({ ...emptyAddress, street: "Rua sem CEP" }),
		).toBe(false);
	});
});
