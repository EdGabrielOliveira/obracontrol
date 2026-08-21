import { describe, expect, it } from "bun:test";
import { convertDocxToPdf } from "../../../../../src/modules/construction-planning/instrument/pdf-converter";

describe("instrument PDF converter", () => {
	it("returns an explicit unavailable error when LibreOffice cannot start", async () => {
		const previous = process.env.LIBREOFFICE_BIN;
		process.env.LIBREOFFICE_BIN = "__missing_libreoffice__";
		try {
			await expect(
				convertDocxToPdf(new Uint8Array([1, 2, 3])),
			).rejects.toMatchObject({
				code: "PDF_CONVERSION_UNAVAILABLE",
				status: 503,
			});
		} finally {
			if (previous === undefined) delete process.env.LIBREOFFICE_BIN;
			else process.env.LIBREOFFICE_BIN = previous;
		}
	});
});
