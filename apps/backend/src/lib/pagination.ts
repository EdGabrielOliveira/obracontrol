export function buildPaginatedResponse<T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
) {
	const totalPages = Math.ceil(total / limit);
	const hasNextPage = page < totalPages;
	const hasPreviousPage = page > 1;

	return {
		data,
		total,
		page,
		limit,
		totalPages,
		hasNextPage,
		hasPreviousPage,
	};
}
