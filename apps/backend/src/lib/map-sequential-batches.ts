/**
 * Applies an operation to fixed-size batches, in order, without overlapping
 * database requests. Callers should use this for large `IN` filters to keep
 * database parameter counts and query payloads bounded.
 */
export async function mapSequentialBatches<T, R>(
	values: readonly T[],
	batchSize: number,
	mapper: (batch: T[], batchIndex: number) => Promise<R>,
): Promise<R[]> {
	if (!Number.isInteger(batchSize) || batchSize <= 0) {
		throw new Error("batchSize must be a positive integer");
	}
	const results: R[] = [];
	for (
		let offset = 0, batchIndex = 0;
		offset < values.length;
		offset += batchSize, batchIndex += 1
	) {
		results.push(
			await mapper(
				Array.from(values.slice(offset, offset + batchSize)),
				batchIndex,
			),
		);
	}
	return results;
}
