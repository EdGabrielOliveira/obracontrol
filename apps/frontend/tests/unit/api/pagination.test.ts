import { describe, expect, it } from "bun:test";
import { normalizePagination } from "@/api/api";

describe("normalizePagination", () => {
	it("preserves a valid backend pagination response", () => {
		const response = normalizePagination(
			{
				data: [{ id: "work-1" }],
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
				hasNextPage: false,
				hasPreviousPage: false,
			},
			10,
		);

		expect(response.data).toEqual([{ id: "work-1" }]);
		expect(response.total).toBe(1);
	});

	it("rejects an SPA HTML response instead of exposing undefined data", () => {
		expect(() => normalizePagination("<html>SPA</html>", 10)).toThrow(
			"a paginação não contém uma lista de dados",
		);
	});

	it("rejects incomplete pagination metadata", () => {
		expect(() =>
			normalizePagination({ data: [], total: 0 }, 10),
		).toThrow("metadados de paginação incompletos");
	});
});
