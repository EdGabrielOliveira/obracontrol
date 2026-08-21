import { describe, expect, it } from "bun:test";
import {
	buildActiveImportWhere,
	buildManualOrActiveWhere,
} from "../../../../../src/modules/construction-planning/calculators/active-scope";

describe("active scope", () => {
	it("scopes imported budget rows to active import only", () => {
		expect(buildActiveImportWhere("owner-1", "work-1", "imp-active")).toEqual({
			ownerId: "owner-1",
			workId: "work-1",
			importId: "imp-active",
		});
	});

	it("scopes to null import when no active import", () => {
		expect(buildActiveImportWhere("owner-1", "work-1", null)).toEqual({
			ownerId: "owner-1",
			workId: "work-1",
			importId: null,
		});
	});

	it("includes active imported and manual operational rows", () => {
		expect(buildManualOrActiveWhere("owner-1", "work-1", "imp-active")).toEqual(
			{
				OR: [
					{ ownerId: "owner-1", workId: "work-1", importId: "imp-active" },
					{ ownerId: "owner-1", workId: "work-1", importId: null },
				],
			},
		);
	});

	it("falls back to manual only when no active import", () => {
		expect(buildManualOrActiveWhere("owner-1", "work-1", null)).toEqual({
			ownerId: "owner-1",
			workId: "work-1",
			importId: null,
		});
	});
});
