export function flattenTree<T extends { children?: T[] }>(
	items: T[],
	depth = 0,
): Array<T & { depth: number }> {
	const result: Array<T & { depth: number }> = [];
	for (const item of items) {
		result.push({ ...item, depth });
		if (item.children && item.children.length > 0) {
			result.push(...flattenTree(item.children, depth + 1));
		}
	}
	return result;
}
