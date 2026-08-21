export type VersionChangeKind = "NEW" | "ALTERED";

export type VersionChangeInfo = {
	kind: VersionChangeKind;
	previousTotal: number | null;
	currentTotal: number;
};

type VersionDiffRow = {
	index: string;
	totalCost: number | null;
};

export function buildVersionChangeMap(
	activeItems: VersionDiffRow[],
	sourceItems: VersionDiffRow[],
): Map<string, VersionChangeInfo> {
	const sourceByIndex = new Map(
		sourceItems.map((item) => [item.index, item.totalCost]),
	);
	const changes = new Map<string, VersionChangeInfo>();

	for (const item of activeItems) {
		const previousTotal = sourceByIndex.get(item.index) ?? null;
		if (previousTotal === null) {
			changes.set(item.index, {
				kind: "NEW",
				previousTotal: null,
				currentTotal: item.totalCost ?? 0,
			});
			continue;
		}
		if (item.totalCost !== previousTotal) {
			changes.set(item.index, {
				kind: "ALTERED",
				previousTotal,
				currentTotal: item.totalCost ?? 0,
			});
		}
	}

	return changes;
}
