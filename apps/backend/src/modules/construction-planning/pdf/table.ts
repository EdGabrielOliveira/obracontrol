import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

export interface TableColumn {
	label: string;
	width: number;
	align: "left" | "right" | "center";
}

export function drawTableHeader(
	page: PDFPage,
	font: PDFFont,
	boldFont: PDFFont,
	x: number,
	y: number,
	columns: TableColumn[],
) {
	let cx = x;
	page.drawRectangle({
		x: cx,
		y: y - 22,
		width: columns.reduce((s, c) => s + c.width, 0),
		height: 22,
		color: rgb(0.06, 0.16, 0.28),
	});
	for (const col of columns) {
		const textWidth = font.widthOfTextAtSize(col.label, 9);
		let tx = cx + 6;
		if (col.align === "right") {
			tx = cx + col.width - textWidth - 6;
		} else if (col.align === "center") {
			tx = cx + (col.width - textWidth) / 2;
		}
		page.drawText(col.label, {
			x: tx,
			y: y - 16,
			size: 9,
			font: boldFont,
			color: rgb(1, 1, 1),
		});
		cx += col.width;
	}
}

export function drawTableRow(
	page: PDFPage,
	font: PDFFont,
	x: number,
	y: number,
	columns: TableColumn[],
	values: string[],
	rowIndex: number,
) {
	const rowHeight = 20;
	const bgColor = rowIndex % 2 === 0 ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1);

	let cx = x;
	page.drawRectangle({
		x: cx,
		y: y - rowHeight,
		width: columns.reduce((s, c) => s + c.width, 0),
		height: rowHeight,
		color: bgColor,
		borderColor: rgb(0.9, 0.91, 0.93),
		borderWidth: 0.5,
	});
	for (let i = 0; i < columns.length; i++) {
		const col = columns[i];
		const textWidth = font.widthOfTextAtSize(values[i] ?? "", 8);
		let tx = cx + 6;
		if (col.align === "right") {
			tx = cx + col.width - textWidth - 6;
		} else if (col.align === "center") {
			tx = cx + (col.width - textWidth) / 2;
		}
		page.drawText(values[i] ?? "", {
			x: tx,
			y: y - 15,
			size: 8,
			font,
			color: rgb(0.2, 0.24, 0.3),
		});
		cx += col.width;
	}
}
