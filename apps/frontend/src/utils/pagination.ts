import type { PaginatedResponse, PaginationMeta } from "@/types/shared";

export function getPaginationMeta(
	response: PaginatedResponse<unknown>,
): PaginationMeta {
	const totalItems = Number.isFinite(response.total) ? response.total : 0;
	const page = Number.isFinite(response.page) ? response.page : 1;
	const limit = Number.isFinite(response.limit) ? response.limit : 10;
	const totalPages =
		Number.isFinite(response.totalPages) && response.totalPages > 0
			? response.totalPages
			: Math.max(1, Math.ceil(totalItems / limit));
	return {
		page,
		limit,
		total: totalItems,
		totalPages,
		hasNextPage: response.hasNextPage ?? page < totalPages,
		hasPreviousPage: response.hasPreviousPage ?? page > 1,
	};
}
