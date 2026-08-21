import { describe, expect, it } from "bun:test";

import { workFormSchema } from "@/schemas/works";

describe("workFormSchema", () => {
	it("accepts a create payload without code", () => {
		const result = workFormSchema.safeParse({
			name: "Obra teste",
			costCenterId: "cc-1",
			responsibleName: "Gestor",
			plannedStart: "2026-01-01",
			plannedEnd: "2026-12-31",
			structuredAddress: null,
		});

		expect(result.success).toBe(true);
	});

	it("still accepts an edit payload with code", () => {
		const result = workFormSchema.safeParse({
			code: "OBR-001",
			name: "Obra teste",
			costCenterId: "cc-1",
			clientName: "Cliente",
			areaM2: "1200",
			responsibleName: "Gestor",
			structuredAddress: null,
		});

		expect(result.success).toBe(true);
	});

	it("requires name and costCenterId", () => {
		const result = workFormSchema.safeParse({
			structuredAddress: null,
		});

		expect(result.success).toBe(false);
	});
});
