import { ConstructionError } from "../../../lib/errors";
import * as managementRepo from "../management.repository";
import {
	CONTENT_WIDTH,
	drawKpiBox,
	drawYAxis,
	fmtCurrency,
	formatPct,
	generatePdf,
	MARGIN,
	PAGE_HEIGHT,
	TABLE_MARGIN,
} from "./layout";
import type { TableColumn } from "./table";
import { drawTableHeader, drawTableRow } from "./table";

function fmtPercent(value: number): string {
	return `${String(Math.round(value * 100) / 100).replace(".", ",")}%`;
}

export async function generateContractReportPdf(
	ownerId: string,
	contractId: string,
): Promise<Response> {
	const report = await managementRepo.getContractReport(ownerId, contractId);
	if (!report) {
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	}

	const title = report.contract.title ?? report.contract.code;
	const subtitle = `${report.contract.code} · ${report.contract.supplierName}`;

	const pdfBytes = await generatePdf(
		`Relatório Gerencial — ${title}`,
		subtitle,
		async (_doc, page, font, boldFont) => {
			let y = PAGE_HEIGHT - 90;

			drawYAxis(page, boldFont, y, "Indicadores");
			y -= 24;

			const kpiColWidth = (CONTENT_WIDTH - 30) / 4;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				kpiColWidth,
				"Contratado",
				fmtCurrency(report.value.contract),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + kpiColWidth + 10,
				y,
				kpiColWidth,
				"Medido",
				fmtCurrency(report.value.measured),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Pago",
				fmtCurrency(report.value.paid),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 3 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Saldo",
				fmtCurrency(report.value.balance),
			);
			y -= 76;

			drawYAxis(page, boldFont, y, "Valores do contrato");
			y -= 24;

			const columns: TableColumn[] = [
				{ label: "Item", width: 220, align: "left" },
				{ label: "Valor", width: 140, align: "right" },
				{ label: "Percentual", width: 120, align: "right" },
			];

			drawTableHeader(page, font, boldFont, MARGIN + TABLE_MARGIN, y, columns);
			y -= 24;

			const rows: Array<{ label: string; value: number; pct?: number }> = [
				{ label: "Valor contratado", value: report.value.contract },
				{ label: "Serviços", value: report.value.services },
				{ label: "Medido", value: report.value.measured },
				{ label: "Pago", value: report.value.paid },
				{ label: "Saldo a pagar", value: report.value.balance },
			];

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				drawTableRow(
					page,
					font,
					MARGIN + TABLE_MARGIN,
					y,
					columns,
					[
						row.label,
						fmtCurrency(row.value),
						row.pct !== undefined ? formatPct(row.pct) : "—",
					],
					i,
				);
				y -= 22;
			}

			y -= 8;

			drawYAxis(page, boldFont, y, "Resumo operacional");
			y -= 24;

			const summaryRows: Array<{ label: string; value: string }> = [
				{
					label: "Medições",
					value: String(report.measurementsCount),
				},
				{ label: "Pagamentos", value: String(report.paymentsCount) },
				// DEC-001: multa de 20% sobre o valor da empreitada (14.3).
				{
					label: `Multa contratual (${fmtPercent(report.penalty.percent)})`,
					value: fmtCurrency(report.penalty.value),
				},
			];

			for (let i = 0; i < summaryRows.length; i++) {
				drawTableRow(
					page,
					font,
					MARGIN + TABLE_MARGIN,
					y,
					columns,
					[summaryRows[i].label, summaryRows[i].value, "—"],
					i,
				);
				y -= 22;
			}
		},
	);

	const safeName = title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "contrato";
	return new Response(pdfBytes as unknown as Blob, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="relatorio-contrato-${safeName}.pdf"`,
		},
	});
}
