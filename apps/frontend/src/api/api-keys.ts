import type { ApiKey, CreateApiKeyResponse } from "@/types/api-keys";
import type { PaginatedResponse } from "@/types/shared";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import { api } from "./api";

export type ApiKeyFilter = {
	q?: string;
	page?: number;
	limit?: number;
};

export async function listApiKeys(filters: ApiKeyFilter = {}) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const { data } = await api.get<PaginatedResponse<ApiKey>>("/api-keys", {
		params: { ...cleaned, limit: filters.limit ?? 10, page: filters.page ?? 1 },
	});
	return data;
}

export async function createApiKey(input: {
	name: string;
	expiresInDays?: number;
	organizationId?: string;
}) {
	const { data } = await api.post<CreateApiKeyResponse>("/api-keys", input);
	return data;
}

export async function revokeApiKey(keyId: string) {
	await api.delete(`/api-keys/${keyId}`);
}
