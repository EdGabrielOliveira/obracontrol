import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { PDFDocument as PDFDoc, rgb, StandardFonts } from "pdf-lib";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 50;
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
export const TABLE_MARGIN = 10;

export function drawHeader(
	page: PDFPage,
	font: PDFFont,
	boldFont: PDFFont,
	title: string,
	subtitle: string,
) {
	const dateStr = new Date().toLocaleDateString("pt-BR");
	page.drawRectangle({
		x: 0,
		y: PAGE_HEIGHT - 60,
		width: PAGE_WIDTH,
		height: 60,
		color: rgb(0.06, 0.16, 0.28),
	});
	page.drawText(title, {
		x: MARGIN,
		y: PAGE_HEIGHT - 42,
		size: 18,
		font: boldFont,
		color: rgb(1, 1, 1),
	});
	page.drawText(subtitle, {
		x: MARGIN,
		y: PAGE_HEIGHT - 60,
		size: 9,
		font,
		color: rgb(0.8, 0.82, 0.85),
	});
	page.drawText(`Gerado em ${dateStr}`, {
		x: PAGE_WIDTH - MARGIN,
		y: PAGE_HEIGHT - 60,
		size: 8,
		font,
		color: rgb(0.8, 0.82, 0.85),
	});
}

export function drawFooter(page: PDFPage, font: PDFFont, pageNum: number) {
	page.drawRectangle({
		x: 0,
		y: 0,
		width: PAGE_WIDTH,
		height: 30,
		color: rgb(0.94, 0.95, 0.96),
	});
	page.drawText(`ObraControl © ${new Date().getFullYear()}`, {
		x: MARGIN,
		y: 8,
		size: 8,
		font,
		color: rgb(0.46, 0.5, 0.55),
	});
	page.drawText(`Página ${pageNum}`, {
		x: PAGE_WIDTH - MARGIN,
		y: 8,
		size: 8,
		font,
		color: rgb(0.46, 0.5, 0.55),
	});
}

export function drawYAxis(
	page: PDFPage,
	boldFont: PDFFont,
	y: number,
	text: string,
) {
	page.drawText(text, {
		x: MARGIN,
		y: y - 12,
		size: 11,
		font: boldFont,
		color: rgb(0.14, 0.18, 0.24),
	});
}

export function drawKpiBox(
	page: PDFPage,
	font: PDFFont,
	boldFont: PDFFont,
	x: number,
	y: number,
	width: number,
	label: string,
	value: string,
) {
	const boxHeight = 54;
	page.drawRectangle({
		x,
		y: y - boxHeight,
		width,
		height: boxHeight,
		color: rgb(0.97, 0.98, 0.99),
		borderColor: rgb(0.88, 0.9, 0.92),
		borderWidth: 1,
	});
	page.drawText(label, {
		x: x + 10,
		y: y - boxHeight + 8,
		size: 8,
		font,
		color: rgb(0.46, 0.5, 0.55),
	});
	page.drawText(value, {
		x: x + 10,
		y: y - boxHeight + 24,
		size: 16,
		font: boldFont,
		color: rgb(0.06, 0.16, 0.28),
	});
}

export function drawSummaryLine(
	page: PDFPage,
	font: PDFFont,
	boldFont: PDFFont,
	x: number,
	y: number,
	label: string,
	value: string,
	totalWidth: number,
) {
	page.drawRectangle({
		x,
		y: y - 22,
		width: totalWidth,
		height: 22,
		color: rgb(0.94, 0.95, 0.96),
		borderColor: rgb(0.88, 0.9, 0.92),
		borderWidth: 0.5,
	});
	page.drawText(label, {
		x: x + 6,
		y: y - 16,
		size: 9,
		font: boldFont,
		color: rgb(0.14, 0.18, 0.24),
	});
	const valueWidth = font.widthOfTextAtSize(value, 9);
	page.drawText(value, {
		x: x + totalWidth - valueWidth - 6,
		y: y - 16,
		size: 9,
		font: boldFont,
		color: rgb(0.06, 0.16, 0.28),
	});
}

export async function generatePdf(
	title: string,
	subtitle: string,
	drawContent: (
		doc: PDFDocument,
		page: PDFPage,
		font: PDFFont,
		boldFont: PDFFont,
	) => Promise<void>,
): Promise<Uint8Array> {
	const doc = await PDFDoc.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

	const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	drawHeader(page, font, boldFont, title, subtitle);

	await drawContent(doc, page, font, boldFont);

	drawFooter(page, font, 1);

	return doc.save();
}

export function fmtCurrency(value: number): string {
	return value.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

export function formatNumber(value: number): string {
	return Number.isFinite(value)
		? value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
		: "—";
}

export function formatPct(value: number): string {
	return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
}

export function truncateText(text: string, maxLen: number): string {
	return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

export function flattenTreeItems(
	items: Array<{
		index: string;
		description: string;
		measuredCurrent: { quantity: number; value: number; percentage: number };
		measuredAccumulated: {
			quantity: number;
			value: number;
			percentage: number;
		};
		children?: Array<Record<string, unknown>>;
	}>,
): Array<{
	index: string;
	description: string;
	measuredCurrent: { quantity: number; value: number; percentage: number };
	measuredAccumulated: { quantity: number; value: number; percentage: number };
}> {
	const result: Array<{
		index: string;
		description: string;
		measuredCurrent: { quantity: number; value: number; percentage: number };
		measuredAccumulated: {
			quantity: number;
			value: number;
			percentage: number;
		};
	}> = [];
	for (const item of items) {
		result.push(item);
		if (item.children && item.children.length > 0) {
			result.push(
				...flattenTreeItems(
					item.children as Array<{
						index: string;
						description: string;
						measuredCurrent: {
							quantity: number;
							value: number;
							percentage: number;
						};
						measuredAccumulated: {
							quantity: number;
							value: number;
							percentage: number;
						};
						children?: Array<Record<string, unknown>>;
					}>,
				),
			);
		}
	}
	return result;
}

export function flattenServiceItems(
	items: Array<{
		description: string;
		measuredCurrent: { quantity: number; value: number; percentage: number };
		measuredAccumulated: {
			quantity: number;
			value: number;
			percentage: number;
		};
		children?: Array<Record<string, unknown>>;
	}>,
): Array<{
	description: string;
	measuredCurrent: { quantity: number; value: number; percentage: number };
	measuredAccumulated: { quantity: number; value: number; percentage: number };
}> {
	const result: Array<{
		description: string;
		measuredCurrent: { quantity: number; value: number; percentage: number };
		measuredAccumulated: {
			quantity: number;
			value: number;
			percentage: number;
		};
	}> = [];
	for (const item of items) {
		result.push(item);
		if (item.children && item.children.length > 0) {
			result.push(
				...flattenServiceItems(
					item.children as Array<{
						description: string;
						measuredCurrent: {
							quantity: number;
							value: number;
							percentage: number;
						};
						measuredAccumulated: {
							quantity: number;
							value: number;
							percentage: number;
						};
						children?: Array<Record<string, unknown>>;
					}>,
				),
			);
		}
	}
	return result;
}
