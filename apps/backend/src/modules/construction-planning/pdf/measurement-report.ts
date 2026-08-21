import { rgb } from "pdf-lib";
import { ConstructionError } from "../../../lib/errors";
import * as cmRepository from "../contract-measurement.repository";
import * as wmRepository from "../work-measurement.repository";
import {
	drawFooter,
	drawHeader,
	drawSummaryLine,
	drawYAxis,
	flattenServiceItems,
	flattenTreeItems,
	fmtCurrency,
	formatNumber,
	formatPct,
	generatePdf,
	MARGIN,
	PAGE_HEIGHT,
	PAGE_WIDTH,
	TABLE_MARGIN,
	truncateText,
} from "./layout";
import type { TableColumn } from "./table";
import { drawTableHeader, drawTableRow } from "./table";

export async function generateWorkMeasurementPdf(
	ownerId: string,
	workId: string,
	measurementId: string,
): Promise<Response> {
	const detail = await wmRepository.getWorkMeasurementDetail(
		ownerId,
		workId,
		measurementId,
	);
	if (!detail) {
		throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
	}

	const { measurement, items, totals } = detail;

	const flatItems = flattenTreeItems(items as never[]);

	const pdfBytes = await generatePdf(
		`Boletim de Medição #${measurement.number}`,
		`${detail.work.name} • ${detail.work.code}`,
		async (doc, page, font, boldFont) => {
			let y = PAGE_HEIGHT - 90;

			page.drawText(
				`Data: ${new Date(measurement.date).toLocaleDateString("pt-BR")}`,
				{
					x: MARGIN,
					y: y - 12,
					size: 9,
					font,
					color: rgb(0.46, 0.5, 0.55),
				},
			);
			y -= 32;

			drawYAxis(page, boldFont, y, "Itens da Medição");
			y -= 28;

			const columns: TableColumn[] = [
				{ label: "Índice", width: 60, align: "center" },
				{ label: "Descrição", width: 160, align: "left" },
				{ label: "Qtd Medida", width: 65, align: "right" },
				{ label: "Valor Medido", width: 95, align: "right" },
				{ label: "% Medido", width: 65, align: "right" },
				{ label: "Qtd Acum.", width: 65, align: "right" },
				{ label: "Valor Acum.", width: 95, align: "right" },
				{ label: "% Acum.", width: 65, align: "right" },
			];

			drawTableHeader(page, font, boldFont, MARGIN + TABLE_MARGIN, y, columns);
			y -= 24;

			for (let i = 0; i < flatItems.length; i++) {
				const item = flatItems[i];
				if (y < 80) {
					drawFooter(page, font, doc.getPageCount());
					const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
					drawHeader(
						newPage,
						font,
						boldFont,
						`Boletim de Medição #${measurement.number}`,
						`${detail.work.name} • ${detail.work.code}`,
					);
					y = PAGE_HEIGHT - 60;
					drawTableHeader(
						newPage,
						font,
						boldFont,
						MARGIN + TABLE_MARGIN,
						y,
						columns,
					);
					y -= 24;
					page = newPage;
				}
				drawTableRow(
					page,
					font,
					MARGIN + TABLE_MARGIN,
					y,
					columns,
					[
						item.index,
						truncateText(item.description, 40),
						formatNumber(item.measuredCurrent.quantity),
						fmtCurrency(item.measuredCurrent.value),
						formatPct(item.measuredCurrent.percentage / 100),
						formatNumber(item.measuredAccumulated.quantity),
						fmtCurrency(item.measuredAccumulated.value),
						formatPct(item.measuredAccumulated.percentage / 100),
					],
					i,
				);
				y -= 22;
			}

			y -= 12;

			drawSummaryLine(
				page,
				font,
				boldFont,
				MARGIN + TABLE_MARGIN,
				y,
				"Total Medido (Atual)",
				fmtCurrency(totals.current.measuredValue),
				columns.reduce((s, c) => s + c.width, 0),
			);
			y -= 22;
			drawSummaryLine(
				page,
				font,
				boldFont,
				MARGIN + TABLE_MARGIN,
				y,
				"Total Medido (Acumulado)",
				fmtCurrency(totals.accumulated.measuredValue),
				columns.reduce((s, c) => s + c.width, 0),
			);
			y -= 22;

			const discountValue = Number(measurement.discountValue ?? 0);
			const retentionValue = Number(measurement.retentionValue ?? 0);

			if (discountValue > 0 || retentionValue > 0) {
				y -= 8;
				drawYAxis(page, boldFont, y, "Descontos e Retenções");
				y -= 28;

				const financialColumns: TableColumn[] = [
					{ label: "Descrição", width: 350, align: "left" },
					{ label: "Valor", width: 150, align: "right" },
				];
				drawTableHeader(
					page,
					font,
					boldFont,
					MARGIN + TABLE_MARGIN,
					y,
					financialColumns,
				);
				y -= 24;

				if (discountValue > 0) {
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						financialColumns,
						["Desconto", fmtCurrency(discountValue)],
						0,
					);
					y -= 22;
				}
				if (retentionValue > 0) {
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						financialColumns,
						["Retenção", fmtCurrency(retentionValue)],
						1,
					);
					y -= 22;
				}

				const netValue =
					totals.current.measuredValue - discountValue - retentionValue;
				y -= 8;
				drawSummaryLine(
					page,
					font,
					boldFont,
					MARGIN + TABLE_MARGIN,
					y,
					"Valor Líquido",
					fmtCurrency(netValue),
					financialColumns.reduce((s, c) => s + c.width, 0),
				);
				y -= 36;
			}

			if (measurement.notes) {
				y -= 8;
				drawYAxis(page, boldFont, y, "Observações");
				y -= 24;
				page.drawText(measurement.notes, {
					x: MARGIN,
					y: y - 12,
					size: 8,
					font,
					color: rgb(0.2, 0.24, 0.3),
				});
				y -= Math.max(30, (measurement.notes.length / 80) * 14);
			}

			y -= 16;
			drawYAxis(page, boldFont, y, "Assinaturas");
			y -= 28;
			const signatureY = y;
			page.drawLine({
				start: { x: MARGIN, y: signatureY },
				end: { x: MARGIN + 200, y: signatureY },
				color: rgb(0.4, 0.44, 0.5),
			});
			page.drawText("Responsável pela Medição", {
				x: MARGIN,
				y: signatureY - 14,
				size: 8,
				font,
				color: rgb(0.46, 0.5, 0.55),
			});
			page.drawLine({
				start: { x: MARGIN + 230, y: signatureY },
				end: { x: MARGIN + 430, y: signatureY },
				color: rgb(0.4, 0.44, 0.5),
			});
			page.drawText("Proprietário / Cliente", {
				x: MARGIN + 230,
				y: signatureY - 14,
				size: 8,
				font,
				color: rgb(0.46, 0.5, 0.55),
			});
		},
	);

	return new Response(pdfBytes as unknown as Blob, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="boletim-medicao-${detail.work.code}-${measurement.number}.pdf"`,
		},
	});
}

export async function generateContractMeasurementPdf(
	ownerId: string,
	_workId: string,
	contractId: string,
	measurementId: string,
): Promise<Response> {
	const detail = await cmRepository.getMeasurementDetail(
		ownerId,
		contractId,
		measurementId,
	);
	if (!detail) {
		throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
	}

	const { measurement, totals } = detail;
	const contractLabel = `${detail.contract.code} - ${detail.contract.supplierName}`;

	const flatItems = flattenServiceItems(detail.serviceTree);

	const pdfBytes = await generatePdf(
		`Boletim de Medição de Contrato #${measurement.number}`,
		contractLabel,
		async (doc, page, font, boldFont) => {
			let y = PAGE_HEIGHT - 90;

			page.drawText(
				`Data: ${new Date(measurement.date).toLocaleDateString("pt-BR")}`,
				{
					x: MARGIN,
					y: y - 12,
					size: 9,
					font,
					color: rgb(0.46, 0.5, 0.55),
				},
			);
			y -= 32;

			drawYAxis(page, boldFont, y, "Serviços Medidos");
			y -= 28;

			const columns: TableColumn[] = [
				{ label: "Serviço", width: 170, align: "left" },
				{ label: "Qtd Medida", width: 65, align: "right" },
				{ label: "Valor Medido", width: 95, align: "right" },
				{ label: "% Medido", width: 65, align: "right" },
				{ label: "Qtd Acum.", width: 65, align: "right" },
				{ label: "Valor Acum.", width: 95, align: "right" },
				{ label: "% Acum.", width: 65, align: "right" },
			];

			drawTableHeader(page, font, boldFont, MARGIN + TABLE_MARGIN, y, columns);
			y -= 24;

			for (let i = 0; i < flatItems.length; i++) {
				const item = flatItems[i];
				if (y < 80) {
					drawFooter(page, font, doc.getPageCount());
					const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
					drawHeader(
						newPage,
						font,
						boldFont,
						`Boletim de Medição de Contrato #${measurement.number}`,
						contractLabel,
					);
					y = PAGE_HEIGHT - 60;
					drawTableHeader(
						newPage,
						font,
						boldFont,
						MARGIN + TABLE_MARGIN,
						y,
						columns,
					);
					y -= 24;
					page = newPage;
				}
				drawTableRow(
					page,
					font,
					MARGIN + TABLE_MARGIN,
					y,
					columns,
					[
						truncateText(item.description, 40),
						formatNumber(item.measuredCurrent.quantity),
						fmtCurrency(item.measuredCurrent.value),
						formatPct(item.measuredCurrent.percentage / 100),
						formatNumber(item.measuredAccumulated.quantity),
						fmtCurrency(item.measuredAccumulated.value),
						formatPct(item.measuredAccumulated.percentage / 100),
					],
					i,
				);
				y -= 22;
			}

			y -= 12;

			const totalWidth = columns.reduce((s, c) => s + c.width, 0);
			drawSummaryLine(
				page,
				font,
				boldFont,
				MARGIN + TABLE_MARGIN,
				y,
				"Total Medido (Atual)",
				fmtCurrency(totals.measuredCurrent),
				totalWidth,
			);
			y -= 22;
			drawSummaryLine(
				page,
				font,
				boldFont,
				MARGIN + TABLE_MARGIN,
				y,
				"Total Medido (Acumulado)",
				fmtCurrency(totals.measuredAccumulated),
				totalWidth,
			);
			y -= 22;

			const discountValue = Number(measurement.discountValue ?? 0);
			const retentionValue = Number(measurement.retentionValue ?? 0);

			if (discountValue > 0 || retentionValue > 0) {
				y -= 8;
				drawYAxis(page, boldFont, y, "Descontos e Retenções");
				y -= 28;

				const financialColumns: TableColumn[] = [
					{ label: "Descrição", width: 350, align: "left" },
					{ label: "Valor", width: 150, align: "right" },
				];
				drawTableHeader(
					page,
					font,
					boldFont,
					MARGIN + TABLE_MARGIN,
					y,
					financialColumns,
				);
				y -= 24;

				let rowIdx = 0;
				if (discountValue > 0) {
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						financialColumns,
						["Desconto", fmtCurrency(discountValue)],
						rowIdx++,
					);
					y -= 22;
				}
				if (retentionValue > 0) {
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						financialColumns,
						["Retenção", fmtCurrency(retentionValue)],
						rowIdx++,
					);
					y -= 22;
				}

				const netValue =
					totals.measuredCurrent - discountValue - retentionValue;
				y -= 8;
				drawSummaryLine(
					page,
					font,
					boldFont,
					MARGIN + TABLE_MARGIN,
					y,
					"Valor Líquido",
					fmtCurrency(netValue),
					financialColumns.reduce((s, c) => s + c.width, 0),
				);
				y -= 36;
			}

			if (measurement.notes) {
				y -= 8;
				drawYAxis(page, boldFont, y, "Observações");
				y -= 24;
				page.drawText(measurement.notes, {
					x: MARGIN,
					y: y - 12,
					size: 8,
					font,
					color: rgb(0.2, 0.24, 0.3),
				});
				y -= Math.max(30, (measurement.notes.length / 80) * 14);
			}

			y -= 16;
			drawYAxis(page, boldFont, y, "Assinaturas");
			y -= 28;
			page.drawLine({
				start: { x: MARGIN, y },
				end: { x: MARGIN + 200, y },
				color: rgb(0.4, 0.44, 0.5),
			});
			page.drawText("Contratante", {
				x: MARGIN,
				y: y - 14,
				size: 8,
				font,
				color: rgb(0.46, 0.5, 0.55),
			});
			page.drawLine({
				start: { x: MARGIN + 230, y },
				end: { x: MARGIN + 430, y },
				color: rgb(0.4, 0.44, 0.5),
			});
			page.drawText("Contratada", {
				x: MARGIN + 230,
				y: y - 14,
				size: 8,
				font,
				color: rgb(0.46, 0.5, 0.55),
			});
		},
	);

	return new Response(pdfBytes as unknown as Blob, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="boletim-medicao-contrato-${detail.contract.code}-${measurement.number}.pdf"`,
		},
	});
}
