import { describe, expect, it } from "bun:test";
import {
	ancestorIndexesOf,
	closestAncestorIndex,
	compareIndexHierarchy,
} from "../../../../../src/modules/construction-planning/imports/index-helpers";

describe("ancestorIndexesOf", () => {
	it("returns ancestor prefixes from closest to farthest", () => {
		expect(ancestorIndexesOf("1.2.3")).toEqual(["1.2", "1"]);
	});

	it("returns a single parent for two-part indexes", () => {
		expect(ancestorIndexesOf("1.1")).toEqual(["1"]);
	});

	it("returns an empty list for top-level indexes", () => {
		expect(ancestorIndexesOf("1")).toEqual([]);
	});
});

describe("closestAncestorIndex", () => {
	it("matches the index itself when it is a candidate", () => {
		expect(closestAncestorIndex("1.1", new Set(["1", "1.1"]))).toBe("1.1");
	});

	it("returns the closest ancestor present in the candidates", () => {
		expect(closestAncestorIndex("1.1.1", new Set(["1"]))).toBe("1");
		expect(closestAncestorIndex("1.1.1", new Set(["1.1", "1"]))).toBe("1.1");
	});

	it("returns null when neither the index nor any ancestor is a candidate", () => {
		expect(closestAncestorIndex("2.1", new Set(["1"]))).toBeNull();
	});

	it("does not match partial prefixes", () => {
		expect(closestAncestorIndex("1.1", new Set(["1."]))).toBeNull();
	});
});

describe("compareIndexHierarchy", () => {
	it("orders siblings numerically", () => {
		expect(compareIndexHierarchy("1.2", "1.10")).toBeLessThan(0);
		expect(compareIndexHierarchy("2", "1")).toBeGreaterThan(0);
	});

	it("places parents before children (depth tiebreak)", () => {
		expect(compareIndexHierarchy("1", "1.1")).toBeLessThan(0);
		expect(compareIndexHierarchy("1.1.1", "1.1")).toBeGreaterThan(0);
	});

	it("orders a full three-level tree", () => {
		const indexes = ["1.1.2", "1", "1.2", "1.1", "1.1.1", "2"];
		const sorted = [...indexes].sort(compareIndexHierarchy);
		expect(sorted).toEqual(["1", "1.1", "1.1.1", "1.1.2", "1.2", "2"]);
	});

	it("returns zero for equal indexes", () => {
		expect(compareIndexHierarchy("1.1", "1.1")).toBe(0);
	});
});
