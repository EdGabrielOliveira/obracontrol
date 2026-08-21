import type {
	ApiDocumentationEntry,
	OpenApiDocument,
	OpenApiMediaType,
	OpenApiOperation,
	OpenApiParameter,
	OpenApiSchema,
} from "@/types/api-documentation";

const MAX_EXAMPLE_DEPTH = 4;
const MAX_OBJECT_PROPERTIES = 16;

const RESOURCE_LABELS: Record<string, string> = {
	Admin: "Usuários",
	"API Keys": "Chaves de API",
	Audit: "Auditoria",
	Auth: "Autenticação",
	BI: "BI",
	Budget: "Orçamento",
	BudgetControl: "Controle orçamentário",
	Companies: "Empresas",
	"Contract Amendments": "Aditivos de contrato",
	Contracts: "Contratos",
	"Contract Files": "Arquivos de contrato",
	"Contract Measurements": "Medições de contrato",
	"Contract Payments": "Pagamentos de contrato",
	"Contract Services": "Serviços de contrato",
	"Cost Centers": "Centros de custo",
	Export: "Exportações",
	Governance: "Governança",
	Health: "Saúde da API",
	Import: "Importações",
	Invitations: "Convites",
	Management: "Gestão",
	Measurements: "Medições",
	Organizations: "Organizações",
	Reports: "Relatórios",
	Schedule: "Cronograma",
	Templates: "Modelos",
	Works: "Obras",
	"Work Measurements": "Medições de obra",
};

const RESOURCE_ORDER = [
	"Works",
	"Budget",
	"BudgetControl",
	"Measurements",
	"Work Measurements",
	"Schedule",
	"BI",
	"Management",
	"Reports",
	"Contracts",
	"Contract Amendments",
	"Contract Services",
	"Contract Measurements",
	"Contract Payments",
	"Contract Files",
];

const DOCUMENTATION_TAGS = new Set([
	"BI",
	"Budget",
	"BudgetControl",
	"Contract Amendments",
	"Contract Files",
	"Contract Measurements",
	"Contract Payments",
	"Contract Services",
	"Contracts",
	"Management",
	"Measurements",
	"Reports",
	"Schedule",
	"Work Measurements",
	"Works",
]);

const SENSITIVE_DOCUMENTATION_PATHS = [
	"/admin/users",
	"/api-keys",
	"/auth",
	"/companies",
	"/organizations",
	"/construction/imports",
	"/construction/exports",
	"/construction/templates",
	"/gestores",
];

const RESOURCE_PARENT_BY_TAG: Record<string, string> = {
	Budget: "Works",
	BudgetControl: "Works",
	Companies: "Organizations",
	"Contract Amendments": "Contracts",
	"Contract Files": "Contracts",
	"Contract Measurements": "Contracts",
	"Contract Payments": "Contracts",
	"Contract Services": "Contracts",
	"Cost Centers": "Organizations",
	Export: "Works",
	Import: "Works",
	Invitations: "Admin",
	Management: "Works",
	Measurements: "Works",
	Reports: "Works",
	Schedule: "Works",
	BI: "Works",
	"Work Measurements": "Works",
};

export type ApiDocumentationGroup = {
	key: string;
	label: string;
	operations: ApiDocumentationEntry[];
};

export type ApiDocumentationNavigationGroup = ApiDocumentationGroup & {
	children: ApiDocumentationGroup[];
};

export function getGetOperations(
	document: OpenApiDocument,
): ApiDocumentationEntry[] {
	return Object.entries(document.paths ?? {})
		.flatMap(([path, pathItem]) =>
			pathItem.get && isDocumentedGetOperation(path, pathItem.get)
				? [{ path, operation: pathItem.get }]
				: [],
		)
		.sort((left, right) => left.path.localeCompare(right.path));
}

export function isDocumentedGetOperation(
	path: string,
	operation: OpenApiOperation,
): boolean {
	const primaryTag = operation.tags?.[0];
	if (!primaryTag || !DOCUMENTATION_TAGS.has(primaryTag)) return false;
	const normalizedPath = path.toLowerCase();
	return !SENSITIVE_DOCUMENTATION_PATHS.some((sensitivePath) =>
		normalizedPath.includes(sensitivePath),
	);
}

function humanizeResourceTag(tag: string): string {
	return tag
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.replace(/^./, (character) => character.toUpperCase());
}

export function getResourceLabel(tag: string | undefined): string {
	if (!tag) return "Outros";
	return RESOURCE_LABELS[tag] ?? humanizeResourceTag(tag);
}

export function getOperationGroupKey(operation: OpenApiOperation): string {
	return operation.tags?.[0] ?? "other";
}

export function groupGetOperations(
	operations: ApiDocumentationEntry[],
): ApiDocumentationGroup[] {
	const groups = new Map<string, ApiDocumentationEntry[]>();

	for (const entry of operations) {
		const key = getOperationGroupKey(entry.operation);
		const entries = groups.get(key) ?? [];
		entries.push(entry);
		groups.set(key, entries);
	}

	return [...groups.entries()]
		.sort(([left], [right]) => {
			const leftIndex = RESOURCE_ORDER.indexOf(left);
			const rightIndex = RESOURCE_ORDER.indexOf(right);
			if (leftIndex !== -1 || rightIndex !== -1) {
				return (
					(leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
					(rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
				);
			}
			return getResourceLabel(left).localeCompare(getResourceLabel(right));
		})
		.map(([key, entries]) => ({
			key,
			label: getResourceLabel(key === "other" ? undefined : key),
			operations: entries,
		}));
}

export function getDocumentationNavigation(
	operations: ApiDocumentationEntry[],
): ApiDocumentationNavigationGroup[] {
	const navigation = new Map<string, ApiDocumentationNavigationGroup>();

	for (const group of groupGetOperations(operations)) {
		const parentKey = RESOURCE_PARENT_BY_TAG[group.key] ?? group.key;
		const parent = navigation.get(parentKey) ?? {
			key: parentKey,
			label: getResourceLabel(parentKey === "other" ? undefined : parentKey),
			operations: [],
			children: [],
		};

		if (parentKey === group.key) {
			parent.operations = group.operations;
		} else {
			parent.children.push(group);
		}
		navigation.set(parentKey, parent);
	}

	return [...navigation.values()]
		.sort((left, right) => {
			const leftIndex = RESOURCE_ORDER.indexOf(left.key);
			const rightIndex = RESOURCE_ORDER.indexOf(right.key);
			return (
				(leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
				(rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
			);
		})
		.map((group) => ({
			...group,
			children: group.children.sort((left, right) => {
				const leftIndex = RESOURCE_ORDER.indexOf(left.key);
				const rightIndex = RESOURCE_ORDER.indexOf(right.key);
				return (
					(leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
					(rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
				);
			}),
		}));
}

export function getOperationAnchor(path: string): string {
	const slug = path
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
	return `api-route-${slug || "root"}`;
}

export function getGroupAnchor(key: string): string {
	const slug = key
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
	return `api-group-${slug || "other"}`;
}

export function getResponseMediaType(
	operation: OpenApiOperation,
): OpenApiMediaType | undefined {
	const response = Object.entries(operation.responses ?? {}).find(
		([status]) => status.startsWith("2") || status === "default",
	)?.[1];
	if (!response) return undefined;
	const content = response?.content;
	if (content) {
		const mediaType = content["application/json"] ?? Object.values(content)[0];
		if (
			mediaType?.schema ||
			mediaType?.example !== undefined ||
			Object.keys(mediaType?.examples ?? {}).length > 0
		) {
			return mediaType;
		}
	}
	if (
		response?.schema ||
		response?.example !== undefined ||
		Object.keys(response?.examples ?? {}).length > 0
	) {
		return {
			schema: response.schema,
			example: response.example,
			examples: response.examples,
		};
	}
	return content
		? (content["application/json"] ?? Object.values(content)[0])
		: undefined;
}

export function getSuccessResponse(operation: OpenApiOperation): {
	status: string;
	description: string;
	mediaType?: OpenApiMediaType;
} | null {
	const response = Object.entries(operation.responses ?? {}).find(
		([status]) => status.startsWith("2") || status === "default",
	);
	if (!response) return null;

	return {
		status: response[0],
		description: response[1].description ?? "Resposta da operação",
		mediaType: getResponseMediaType(operation),
	};
}

function humanizeOperationId(operationId: string): string {
	return operationId
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.replace(/^./, (character) => character.toUpperCase());
}

export function getOperationTitle(
	path: string,
	operation: OpenApiOperation,
): string {
	if (operation.summary?.trim()) return operation.summary.trim();
	if (operation.operationId?.trim()) {
		return humanizeOperationId(operation.operationId.trim());
	}
	return `Consultar ${path}`;
}

export function getOperationDescription(
	path: string,
	operation: OpenApiOperation,
): string {
	return (
		operation.description?.trim() || `Consulta de leitura da rota ${path}.`
	);
}

function resolveSchema(
	schema: OpenApiSchema | undefined,
	document: OpenApiDocument,
): OpenApiSchema | undefined {
	if (!schema?.$ref) return schema;
	const schemaName = schema.$ref.split("/").pop();
	return schemaName ? document.components?.schemas?.[schemaName] : undefined;
}

function exampleForSchema(
	schema: OpenApiSchema | undefined,
	document: OpenApiDocument,
	depth: number,
	seenRefs: Set<string>,
): unknown {
	if (!schema) return undefined;
	if (depth > MAX_EXAMPLE_DEPTH) return "…";
	if (schema.example !== undefined) return schema.example;
	if (schema.default !== undefined) return schema.default;
	if (schema.enum?.length) return schema.enum[0];
	if (schema.$ref) {
		if (seenRefs.has(schema.$ref)) return "…";
		const nextSeenRefs = new Set(seenRefs).add(schema.$ref);
		return exampleForSchema(
			resolveSchema(schema, document),
			document,
			depth + 1,
			nextSeenRefs,
		);
	}
	if (schema.oneOf?.[0] || schema.anyOf?.[0]) {
		return exampleForSchema(
			schema.oneOf?.[0] ?? schema.anyOf?.[0],
			document,
			depth + 1,
			seenRefs,
		);
	}
	if (schema.allOf?.length) {
		return Object.assign(
			{},
			...schema.allOf.map((part) =>
				exampleForSchema(part, document, depth + 1, seenRefs),
			),
		);
	}
	if (schema.type === "array" || schema.items) {
		return [exampleForSchema(schema.items, document, depth + 1, seenRefs)];
	}
	if (schema.type === "object" || schema.properties) {
		return Object.fromEntries(
			Object.entries(schema.properties ?? {})
				.slice(0, MAX_OBJECT_PROPERTIES)
				.map(([name, property]) => [
					name,
					exampleForSchema(property, document, depth + 1, seenRefs),
				]),
		);
	}
	if (!schema.type && !schema.format) return {};

	switch (schema.format) {
		case "date":
			return "2026-01-01";
		case "date-time":
			return "2026-01-01T00:00:00.000Z";
		case "uuid":
			return "00000000-0000-0000-0000-000000000000";
		default:
			switch (schema.type) {
				case "integer":
				case "number":
					return 0;
				case "boolean":
					return true;
				default:
					return schema.nullable ? null : "string";
			}
	}
}

export function createResponseExample(
	mediaType: OpenApiMediaType | undefined,
	document: OpenApiDocument,
): string | null {
	const explicitExample =
		mediaType?.example ?? Object.values(mediaType?.examples ?? {})[0]?.value;
	const value =
		explicitExample ??
		exampleForSchema(mediaType?.schema, document, 0, new Set());
	if (value === undefined) return null;

	return JSON.stringify(value, null, 2);
}

function sampleValue(parameter: OpenApiParameter): string {
	if (parameter.example !== undefined) return String(parameter.example);
	const schema = parameter.schema;
	if (schema?.example !== undefined) return String(schema.example);
	if (schema?.enum?.[0] !== undefined) return String(schema.enum[0]);
	if (schema?.format === "date") return "2026-01-01";
	if (schema?.format === "date-time") return "2026-01-01T00:00:00.000Z";
	if (schema?.type === "integer" || schema?.type === "number") return "1";
	if (schema?.type === "boolean") return "true";
	return `<${parameter.name}>`;
}

export function getPathParameters(
	operation: OpenApiOperation,
): OpenApiParameter[] {
	return (operation.parameters ?? []).filter(
		(parameter) => parameter.in === "path",
	);
}

export function buildCurlExample(
	path: string,
	operation: OpenApiOperation,
): string {
	const pathParameters = getPathParameters(operation);
	const pathWithSamples = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
		const parameter = pathParameters.find((item) => item.name === name);
		return parameter ? sampleValue(parameter) : `<${name}>`;
	});
	const requiredQuery = (operation.parameters ?? []).filter(
		(parameter) => parameter.in === "query" && parameter.required,
	);
	const queryString = requiredQuery.length
		? `?${requiredQuery.map((parameter) => `${parameter.name}=${encodeURIComponent(sampleValue(parameter))}`).join("&")}`
		: "";

	return [
		`curl --request GET "{{BASE_URL}}${pathWithSamples}${queryString}"`,
		'  --header "Authorization: Bearer <SUA_API_KEY>"',
		'  --header "Accept: application/json"',
	].join(" \\\n");
}

export function getParameterDescription(parameter: OpenApiParameter): string {
	const requiredLabel = parameter.required ? "obrigatório" : "opcional";
	return `${parameter.in} · ${requiredLabel}${parameter.description ? ` · ${parameter.description}` : ""}`;
}
