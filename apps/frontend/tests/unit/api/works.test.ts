import { describe, expect, it } from "bun:test";
import { api } from "@/api/api";
import {
	buildWorkWithBudgetPayload,
	isCreateWorkWithBudgetResponse,
	type WorkCreateInput,
} from "@/api/works";

const input: WorkCreateInput = {
	name: "Obra teste",
	costCenterId: "cost-center-1",
	structuredAddress: {
		zipCode: "59680-000",
		city: "Campo Grande",
		state: "RN",
	},
	plannedStart: "2026-08-01",
};

describe("buildWorkWithBudgetPayload", () => {
	it("uses JSON without a file when no budget file is selected", () => {
		const payload = buildWorkWithBudgetPayload(input);

		expect(payload).toBe(input);
	});

	it("uses multipart and serializes structured fields when a file is selected", () => {
		const file = new File(["xlsx"], "orcamento.xlsx", {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		const payload = buildWorkWithBudgetPayload(input, file);

		expect(payload).toBeInstanceOf(FormData);
		expect(Object.fromEntries(payload.entries())).toEqual({
			name: "Obra teste",
			costCenterId: "cost-center-1",
			structuredAddress: JSON.stringify(input.structuredAddress),
			plannedStart: "2026-08-01",
			file,
		});
	});
});

describe("api upload defaults", () => {
	it("does not force JSON content type for FormData requests", () => {
		expect(api.defaults.headers.common["Content-Type"]).toBeUndefined();
	});
});

describe("isCreateWorkWithBudgetResponse", () => {
	it("accepts successful responses and the documented import rejection", () => {
		expect(isCreateWorkWithBudgetResponse(201)).toBe(true);
		expect(isCreateWorkWithBudgetResponse(422)).toBe(true);
		expect(isCreateWorkWithBudgetResponse(400)).toBe(false);
		expect(isCreateWorkWithBudgetResponse(500)).toBe(false);
	});
});
