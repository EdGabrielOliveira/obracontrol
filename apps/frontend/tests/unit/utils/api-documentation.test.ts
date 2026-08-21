import { describe, expect, it } from "bun:test";
import {
	buildCurlExample,
	createResponseExample,
	getDocumentationNavigation,
	getGetOperations,
	getOperationAnchor,
	getOperationDescription,
	getOperationTitle,
	getParameterDescription,
	getResourceLabel,
	getResponseMediaType,
	groupGetOperations,
	isDocumentedGetOperation,
} from "@/utils/api-documentation";

describe("api documentation helpers", () => {
	it("keeps only documented operational GET routes and sorts paths", () => {
		const operations = getGetOperations({
			paths: {
				"/works": { post: {} },
				"/health": { get: { tags: ["Health"], summary: "Health" } },
				"/admin/users": { get: { tags: ["Admin"], summary: "Users" } },
				"/works/{workId}": { get: { tags: ["Works"], summary: "Work" } },
				"/construction/works/{workId}/budget": {
					get: { tags: ["Budget"], summary: "Budget" },
				},
			},
		});

		expect(operations.map((entry) => entry.path)).toEqual([
			"/construction/works/{workId}/budget",
			"/works/{workId}",
		]);
	});

	it("rejects sensitive paths even when their tag looks operational", () => {
		expect(
			isDocumentedGetOperation("/construction/works/gestores", {
				tags: ["Works"],
			}),
		).toBe(false);
		expect(
			isDocumentedGetOperation("/construction/works/work-1/statistics", {
				tags: ["BI"],
			}),
		).toBe(true);
		expect(
			isDocumentedGetOperation("/organizations/org-1/cost-centers", {
				tags: ["Cost Centers"],
			}),
		).toBe(false);
	});

	it("groups routes by their first OpenAPI tag in a predictable order", () => {
		const groups = groupGetOperations([
			{ path: "/works", operation: { tags: ["Works"] } },
			{ path: "/contracts", operation: { tags: ["Contracts"] } },
			{ path: "/budget", operation: { tags: ["Budget"] } },
		]);

		expect(groups.map((group) => group.label)).toEqual([
			"Obras",
			"Orçamento",
			"Contratos",
		]);
		expect(groups[0]?.operations[0]?.path).toBe("/works");
	});

	it("creates stable internal anchors for route navigation", () => {
		expect(getOperationAnchor("/works/{workId}/costs")).toBe(
			"api-route-works-workid-costs",
		);
		expect(getResourceLabel("Contract Services")).toBe("Serviços de contrato");
	});

	it("nests contract subresources under their parent resource", () => {
		const navigation = getDocumentationNavigation([
			{
				path: "/contracts",
				operation: { tags: ["Contracts"], summary: "Listar contratos" },
			},
			{
				path: "/contracts/:contractId/services",
				operation: {
					tags: ["Contract Services"],
					summary: "Listar serviços",
				},
			},
		]);

		const contracts = navigation.find((group) => group.key === "Contracts");

		expect(contracts?.label).toBe("Contratos");
		expect(contracts?.operations[0]?.operation.summary).toBe(
			"Listar contratos",
		);
		expect(contracts?.children[0]?.label).toBe("Serviços de contrato");
		expect(contracts?.children[0]?.operations[0]?.operation.summary).toBe(
			"Listar serviços",
		);
	});

	it("builds a curl request with path and required query samples", () => {
		const curl = buildCurlExample("/works/{workId}", {
			parameters: [
				{
					name: "workId",
					in: "path",
					required: true,
					schema: { type: "string", format: "uuid" },
				},
				{
					name: "page",
					in: "query",
					required: true,
					schema: { type: "integer" },
				},
			],
		});

		expect(curl).toContain("{{BASE_URL}}/works/<workId>?page=1");
		expect(curl).toContain("Authorization: Bearer <SUA_API_KEY>");
	});

	it("creates a readable JSON example from a referenced response schema", () => {
		const example = createResponseExample(
			{
				schema: { $ref: "#/components/schemas/Work" },
			},
			{
				components: {
					schemas: {
						Work: {
							type: "object",
							properties: {
								id: { type: "string", format: "uuid" },
								name: { type: "string", example: "Obra Centro" },
							},
						},
					},
				},
			},
		);

		expect(example).toContain('"id": "00000000-0000-0000-0000-000000000000"');
		expect(example).toContain('"name": "Obra Centro"');
	});

	it("reads a response body declared directly on HTTP 200", () => {
		const operation = {
			responses: {
				"200": {
					schema: {
						type: "object",
						properties: { ok: { type: "boolean" } },
					},
				},
			},
		};
		const example = createResponseExample(getResponseMediaType(operation), {});

		expect(example).toContain('"ok": true');
	});

	it("uses an example declared at the response level", () => {
		const operation = {
			responses: {
				"200": {
					content: { "application/json": {} },
					example: { data: [{ id: "work-1" }] },
				},
			},
		};

		const example = createResponseExample(getResponseMediaType(operation), {});

		expect(example).toContain('"id": "work-1"');
	});

	it("does not invent a body when the OpenAPI response is empty", () => {
		const example = createResponseExample(undefined, {});

		expect(example).toBeNull();
	});

	it("provides title and description fallbacks for undocumented routes", () => {
		const operation = { operationId: "listWorkCosts" };

		expect(getOperationTitle("/works/{workId}/costs", operation)).toBe(
			"List Work Costs",
		);
		expect(getOperationDescription("/works/{workId}/costs", operation)).toBe(
			"Consulta de leitura da rota /works/{workId}/costs.",
		);
	});

	it("describes parameter location and requiredness", () => {
		expect(
			getParameterDescription({
				name: "workId",
				in: "path",
				required: true,
				description: "Identificador da obra",
			}),
		).toBe("path · obrigatório · Identificador da obra");
	});
});
