import { ConstructionError } from "../../../lib/errors";
import * as managementRepo from "../management.repository";
import {
	CONTENT_WIDTH,
	drawKpiBox,
	drawYAxis,
	fmtCurrency,
	generatePdf,
	MARGIN,
	PAGE_HEIGHT,
} from "./layout";

export async function generateWorkPdf(
	ownerId: string,
	workId: string,
	asOf?: Date,
): Promise<Response> {
	const report = await managementRepo.getWorkReport(ownerId, workId, asOf);
	if (!report) {
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	}

	const pdfBytes = await generatePdf(
		report.work.name,
		`Obra • ${report.work.code}`,
		async (_doc, page, font, boldFont) => {
			let y = PAGE_HEIGHT - 90;

			drawYAxis(page, boldFont, y, "Orçamento");
			y -= 24;

			const kpiColWidth = (CONTENT_WIDTH - 20) / 3;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				kpiColWidth,
				"Total Orçado",
				fmtCurrency(report.budget.total),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + kpiColWidth + 10,
				y,
				kpiColWidth,
				"Itens no Orçamento",
				String(report.budget.itemsCount),
			);
			y -= 66;

			drawYAxis(page, boldFont, y, "Status do Orçamento");
			y -= 24;

			const statusColWidth = (CONTENT_WIDTH - 20) / 3;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				statusColWidth,
				"Em Andamento",
				String(report.budget.byStatus.active),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + statusColWidth + 10,
				y,
				statusColWidth,
				"Concluídos",
				String(report.budget.byStatus.done),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (statusColWidth + 10),
				y,
				statusColWidth,
				"Não Iniciados",
				String(report.budget.byStatus.notStarted),
			);
			y -= 66;

			drawYAxis(page, boldFont, y, "Medições");
			y -= 24;

			const medColWidth = (CONTENT_WIDTH - 20) / 3;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				medColWidth,
				"Total Medido",
				fmtCurrency(report.measurements.total),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + medColWidth + 10,
				y,
				medColWidth,
				"Medições Realizadas",
				String(report.measurements.count),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (medColWidth + 10),
				y,
				medColWidth,
				"% Medido",
				`${(report.measurements.percentage * 100).toFixed(1)}%`,
			);
			y -= 66;

			drawYAxis(page, boldFont, y, "Custos");
			y -= 24;

			const costColWidth = (CONTENT_WIDTH - 10) / 2;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				costColWidth,
				"Total de Custos",
				fmtCurrency(report.costs.total),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + costColWidth + 10,
				y,
				costColWidth,
				"Saldo",
				fmtCurrency(report.costs.balance),
			);
		},
	);

	return new Response(pdfBytes as unknown as Blob, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="relatorio-obra-${report.work.code}.pdf"`,
		},
	});
}
