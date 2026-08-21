import { describe, expect, it } from "bun:test";
import { parseAsOfDate } from "../../../src/lib/as-of-date";

describe("parseAsOfDate", () => {
	it("returns undefined when absent or empty", () => {
		expect(parseAsOfDate(undefined)).toBeUndefined();
		expect(parseAsOfDate("")).toBeUndefined();
	});

	it("parses a valid YYYY-MM-DD date as UTC midnight", () => {
		const date = parseAsOfDate("2026-01-15");
		expect(date?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
	});

	it("rejects malformed formats with 400", () => {
		for (const raw of ["not-a-date", "01-01-2026", "2026/01/15", "2026-01"]) {
			try {
				parseAsOfDate(raw);
				throw new Error(`expected rejection for ${raw}`);
			} catch (error) {
				expect(error).toMatchObject({
					code: "INVALID_AS_OF_DATE",
					status: 400,
				});
			}
		}
	});

	it("rejects non-existent calendar dates with 400", () => {
		for (const raw of ["2026-13-01", "2026-01-32", "2026-02-30"]) {
			try {
				parseAsOfDate(raw);
				throw new Error(`expected rejection for ${raw}`);
			} catch (error) {
				expect(error).toMatchObject({
					code: "INVALID_AS_OF_DATE",
					status: 400,
				});
			}
		}
	});

	it("rejects future dates with 422", () => {
		const year = new Date().getUTCFullYear() + 10;
		try {
			parseAsOfDate(`${year}-01-01`);
			throw new Error("expected rejection for future date");
		} catch (error) {
			expect(error).toMatchObject({
				code: "INVALID_AS_OF_DATE",
				status: 422,
				message: "Data de corte futura nao permitida",
			});
		}
	});

	it("accepts today", () => {
		const now = new Date();
		const today = `${now.getUTCFullYear()}-${String(
			now.getUTCMonth() + 1,
		).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
		expect(parseAsOfDate(today)).toBeInstanceOf(Date);
	});
});
