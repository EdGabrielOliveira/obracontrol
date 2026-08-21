import { describe, expect, it } from "bun:test";
import { createApp } from "../../src/app";

type OpenApiMedia = {
	schema?: { type?: string; format?: string };
	example?: unknown;
};

type OpenApiResponse = {
	description?: string;
	schema?: unknown;
	content?: Record<string, OpenApiMedia>;
};

type OpenApiOperation = {
	summary?: string;
	description?: string;
	responses?: Record<string, OpenApiResponse>;
};

describe("OpenAPI documentation", () => {
	it("publishes a title and description for every operation", async () => {
		const response = await createApp().handle(
			new Request("http://localhost/openapi/json"),
		);
		const document = (await response.json()) as {
			paths?: Record<string, Record<string, OpenApiOperation>>;
		};

		expect(response.status).toBe(200);
		for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
			for (const [method, operation] of Object.entries(pathItem)) {
				if (!["get", "post", "put", "patch", "delete"].includes(method))
					continue;
				expect(
					operation.summary?.trim(),
					`${method.toUpperCase()} ${path}`,
				).toBeTruthy();
				expect(
					operation.description?.trim(),
					`${method.toUpperCase()} ${path}`,
				).toBeTruthy();
			}
		}
	});

	it("documents a schema for every JSON GET success response", async () => {
		const response = await createApp().handle(
			new Request("http://localhost/openapi/json"),
		);
		const document = (await response.json()) as {
			paths?: Record<string, Record<string, OpenApiOperation>>;
		};

		for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
			const operation = pathItem.get;
			if (!operation) continue;

			const success = Object.entries(operation.responses ?? {}).find(
				([status]) => status.startsWith("2"),
			);
			expect(success, `GET ${path} sem resposta 2xx`).toBeTruthy();

			const [status, successResponse] = success ?? ["", undefined];
			expect(
				successResponse?.description,
				`GET ${path} ${status} sem descrição`,
			).toBeTruthy();

			const mediaTypes = Object.values(successResponse?.content ?? {});
			const isBinary = mediaTypes.some(
				(media) => media.schema?.format === "binary",
			);
			if (!isBinary) {
				expect(
					successResponse?.content ?? successResponse?.schema,
					`GET ${path} ${status} sem schema`,
				).toBeTruthy();
			}
		}
	});

	it("documents the costs export response as a binary download", async () => {
		const response = await createApp().handle(
			new Request("http://localhost/openapi/json"),
		);
		const document = (await response.json()) as {
			paths?: Record<string, Record<string, OpenApiOperation>>;
		};
		const operation =
			document.paths?.["/construction/works/{workId}/export/custos"]?.get;
		const success = operation?.responses?.["200"];

		expect(operation?.summary?.trim()).toBeTruthy();
		expect(operation?.description?.trim()).toBeTruthy();
		expect(success?.description?.trim()).toBeTruthy();
		expect(success?.content?.["application/octet-stream"]?.schema).toEqual({
			type: "string",
			format: "binary",
		});
	});

	it("documents a body for every success response that is not 204", async () => {
		const response = await createApp().handle(
			new Request("http://localhost/openapi/json"),
		);
		const document = (await response.json()) as {
			paths?: Record<string, Record<string, OpenApiOperation>>;
		};

		for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
			for (const [method, operation] of Object.entries(pathItem)) {
				if (!["get", "post", "put", "patch", "delete"].includes(method))
					continue;

				for (const [status, successResponse] of Object.entries(
					operation.responses ?? {},
				)) {
					if (!status.startsWith("2") || status === "204") continue;
					expect(
						successResponse.content ?? successResponse.schema,
						`${method.toUpperCase()} ${path} ${status} sem body documentado`,
					).toBeTruthy();
				}
			}
		}
	});

	it("publishes an example for generic JSON responses", async () => {
		const response = await createApp().handle(
			new Request("http://localhost/openapi/json"),
		);
		const document = (await response.json()) as {
			paths?: Record<string, Record<string, OpenApiOperation>>;
		};
		const responseBody =
			document.paths?.["/construction/imports/"]?.get?.responses?.["200"];

		expect(responseBody?.content?.["application/json"]?.example).toEqual({});
	});
});
