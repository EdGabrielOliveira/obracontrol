export function ancestorIndexesOf(index: string): string[] {
	const parts = index.split(".");
	const ancestors: string[] = [];
	for (let i = parts.length - 1; i > 0; i--) {
		ancestors.push(parts.slice(0, i).join("."));
	}
	return ancestors;
}

/** Remove numeric padding while preserving the hierarchy of an index. */
export function normalizeHierarchyIndex(value: string): string {
	return value
		.trim()
		.split(".")
		.map((part) => {
			const segment = part.trim();
			return /^\d+$/.test(segment) ? String(Number(segment)) : segment;
		})
		.join(".");
}

export function closestAncestorIndex(
	index: string,
	candidates: ReadonlySet<string>,
): string | null {
	for (const candidate of [index, ...ancestorIndexesOf(index)]) {
		if (candidates.has(candidate)) return candidate;
	}
	return null;
}

export function compareIndexHierarchy(a: string, b: string): number {
	const aParts = a.split(".");
	const bParts = b.split(".");
	for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
		const aNum = Number(aParts[i]);
		const bNum = Number(bParts[i]);
		if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
			if (aParts[i] !== bParts[i]) return aParts[i].localeCompare(bParts[i]);
		} else if (aNum !== bNum) {
			return aNum - bNum;
		}
	}
	return aParts.length - bParts.length;
}
