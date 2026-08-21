import { describe, expect, it } from "bun:test";

import { organizationEditSchema } from "@/schemas/organizations";
import { workFormSchema } from "@/schemas/works";

const addressWithoutStreetFields = {
	zipCode: "01310100",
	city: "São Paulo",
	state: "SP",
};

describe("structured address schemas", () => {
	it("accepts a work address without street, district, or number", () => {
		const result = workFormSchema.safeParse({
			code: "OBR-001",
			name: "Obra teste",
			costCenterId: "cc-1",
			structuredAddress: addressWithoutStreetFields,
		});

		expect(result.success).toBe(true);
	});

	it("accepts an organization address without street, district, or number", () => {
		const result = organizationEditSchema.safeParse({
			name: "Organização teste",
			structuredAddress: addressWithoutStreetFields,
		});

		expect(result.success).toBe(true);
	});
});
