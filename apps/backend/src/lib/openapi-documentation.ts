const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

type OpenApiRecord = Record<string, unknown>;

function humanizePath(path: string): string {
	return path
		.replace(/^\/+/, "")
		.replace(/[{}]/g, "")
		.split("/")
		.filter(Boolean)
		.map((segment) =>
			segment.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2"),
		)
		.join(" / ");
}

function methodLabel(method: string): string {
	return (
		{
			get: "Consultar",
			post: "Executar",
			put: "Substituir",
			patch: "Atualizar",
			delete: "Excluir",
		}[method] ?? method.toUpperCase()
	);
}

function operationDescription(method: string, path: string): string {
	const resource = humanizePath(path);
	return `${methodLabel(method)} dados ou ações de ${resource}, respeitando autenticação, ownership e escopo resolvidos pelo backend.`;
}

function responseDescription(
	status: string,
	method: string,
	path: string,
): string {
	if (status === "200") {
		return `Retorno bem-sucedido da operação ${method.toUpperCase()} ${path}.`;
	}
	if (status === "201") return "Recurso criado com sucesso.";
	if (status === "202")
		return "Operação aceita para processamento ou aprovação.";
	if (status === "204") return "Operação concluída sem corpo de resposta.";
	return `Resposta HTTP ${status} da operação ${method.toUpperCase()} ${path}.`;
}

function isBinaryPath(path: string): boolean {
	return /\/(download|pdf|export|template|templates)(\/|$)/i.test(path);
}

function fallbackSuccessSchema(method: string, path: string): OpenApiRecord {
	if (method === "get" && isBinaryPath(path)) {
		return {
			content: {
				"application/octet-stream": {
					schema: { type: "string", format: "binary" },
				},
			},
		};
	}
	return {
		content: {
			"application/json": {
				schema: {
					type: "object",
					additionalProperties: true,
					description:
						"Estrutura JSON retornada pela rota; consulte as propriedades específicas do recurso quando declaradas pelo módulo.",
				},
				example: {},
			},
		},
	};
}

function hasResponseBody(response: OpenApiRecord): boolean {
	if (response.schema) return true;
	const content = response.content;
	return (
		!!content &&
		typeof content === "object" &&
		Object.keys(content as OpenApiRecord).length > 0
	);
}

export function enrichOpenApiDocument(document: unknown): unknown {
	if (!document || typeof document !== "object") return document;
	const openApi = document as OpenApiRecord;
	const paths = openApi.paths;
	if (!paths || typeof paths !== "object") return document;

	for (const [path, pathItemValue] of Object.entries(paths as OpenApiRecord)) {
		if (!pathItemValue || typeof pathItemValue !== "object") continue;
		const pathItem = pathItemValue as OpenApiRecord;
		for (const [method, operationValue] of Object.entries(pathItem)) {
			if (!HTTP_METHODS.has(method)) continue;
			const operation = operationValue as OpenApiRecord;
			operation.summary ??= `${methodLabel(method)} ${humanizePath(path)}`;
			operation.description ??= operationDescription(method, path);

			const parameters = Array.isArray(operation.parameters)
				? operation.parameters
				: [];
			for (const parameterValue of parameters) {
				const parameter = parameterValue as OpenApiRecord;
				parameter.description ??= `Parâmetro ${String(parameter.name ?? "")} em ${String(parameter.in ?? "query")}.`;
			}

			if (!operation.responses || typeof operation.responses !== "object") {
				operation.responses = {};
			}
			const responses = operation.responses as OpenApiRecord;
			for (const [status, responseValue] of Object.entries(responses)) {
				const response = (responseValue ?? {}) as OpenApiRecord;
				response.description ??= responseDescription(status, method, path);
				responses[status] = response;
			}

			const successStatuses = Object.keys(responses).filter(
				(status) => status.startsWith("2") && status !== "204",
			);
			if (!Object.keys(responses).some((status) => status.startsWith("2"))) {
				responses["200"] = {
					...fallbackSuccessSchema(method, path),
					description: responseDescription("200", method, path),
				};
				continue;
			}

			for (const successStatus of successStatuses) {
				const successResponse = responses[successStatus];
				if (!successResponse || typeof successResponse !== "object") continue;
				if (!hasResponseBody(successResponse as OpenApiRecord)) {
					Object.assign(successResponse, fallbackSuccessSchema(method, path));
				}
			}
		}
	}

	return document;
}
