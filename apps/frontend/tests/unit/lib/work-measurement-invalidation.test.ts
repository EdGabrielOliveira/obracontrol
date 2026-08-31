import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import {
	biKeys,
	dashboardKeys,
	governanceKeys,
	workKeys,
} from "@/api/query-keys";
import { invalidateWorkMeasurementQueries } from "@/lib/work-measurement-invalidation";

test("invalidates all work measurement projections for a work", () => {
	const client = new QueryClient();
	const workId = "work-1";
	const queryKeys = [
		workKeys.list(),
		biKeys.multiworks(),
		biKeys.compare(["work-1", "work-2"]),
		dashboardKeys.summary,
		workKeys.detail(workId),
		workKeys.schedule(workId),
		["work-statistics", workId, "monthly"],
		["work-statistics-schedule", workId, "monthly"],
		workKeys.measurementMap(workId),
		workKeys.bi(workId, "2026-08-01"),
		governanceKeys.pendingApprovals(workId),
	];

	for (const queryKey of queryKeys) client.setQueryData(queryKey, {});

	invalidateWorkMeasurementQueries(client, workId);

	for (const queryKey of queryKeys) {
		expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
	}
});
