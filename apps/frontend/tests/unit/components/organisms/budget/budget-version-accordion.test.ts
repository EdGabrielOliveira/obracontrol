import { describe, expect, it } from "bun:test";
import { getVersionedItemIndex } from "@/components/organisms/budget/budget-version-accordion";

describe("budget version item indexes", () => {
	it("does not prefix budget indexes with the baseline version number", () => {
		expect(getVersionedItemIndex("1")).toBe("1");
		expect(getVersionedItemIndex("1.1")).toBe("1.1");
		expect(getVersionedItemIndex("1.1.1")).toBe("1.1.1");
	});
});
