export type OpenApiSchema = {
	$ref?: string;
	type?: string;
	format?: string;
	description?: string;
	example?: unknown;
	default?: unknown;
	enum?: unknown[];
	nullable?: boolean;
	properties?: Record<string, OpenApiSchema>;
	required?: string[];
	items?: OpenApiSchema;
	allOf?: OpenApiSchema[];
	oneOf?: OpenApiSchema[];
	anyOf?: OpenApiSchema[];
};

export type OpenApiParameter = {
	name: string;
	in: "path" | "query" | "header" | "cookie";
	required?: boolean;
	description?: string;
	example?: unknown;
	schema?: OpenApiSchema;
};

export type OpenApiMediaType = {
	schema?: OpenApiSchema;
	example?: unknown;
	examples?: Record<string, { value?: unknown }>;
};

export type OpenApiResponse = {
	description?: string;
	example?: unknown;
	examples?: Record<string, { value?: unknown }>;
	schema?: OpenApiSchema;
	content?: Record<string, OpenApiMediaType>;
};

export type OpenApiOperation = {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	parameters?: OpenApiParameter[];
	responses?: Record<string, OpenApiResponse>;
};

export type OpenApiPathItem = {
	get?: OpenApiOperation;
};

export type OpenApiDocument = {
	info?: {
		title?: string;
		version?: string;
		description?: string;
	};
	components?: {
		schemas?: Record<string, OpenApiSchema>;
	};
	paths?: Record<string, OpenApiPathItem>;
};

export type ApiDocumentationEntry = {
	path: string;
	operation: OpenApiOperation;
};
