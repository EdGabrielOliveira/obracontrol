import type { PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import { ConstructionError } from "../../../lib/errors";
import * as managementRepo from "../management.repository";
import {
	CONTENT_WIDTH,
	drawFooter,
	drawHeader,
	drawKpiBox,
	drawYAxis,
	fmtCurrency,
	formatNumber,
	formatPct,
	generatePdf,
	MARGIN,
	PAGE_HEIGHT,
	PAGE_WIDTH,
	TABLE_MARGIN,
} from "./layout";
import type { TableColumn } from "./table";
import { drawTableHeader, drawTableRow } from "./table";

export async function generateWorkManagementPdf(
	ownerId: string,
	workId: string,
	asOf?: Date,
): Promise<Response> {
	const context = await managementRepo.getWorkManagementReportContext(
		ownerId,
		workId,
		asOf,
	);
	if (!context) {
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	}

	const { report, dashboard, schedule: sCurveData } = context;

	const pdfBytes = await generatePdf(
		`Relatório Gerencial • ${report.work.name}`,
		`${report.work.code}${report.costCenter ? ` • ${report.costCenter.name}` : ""}`,
		async (doc, page, font, boldFont) => {
			let y = PAGE_HEIGHT - 90;

			page.drawText(
				`Relatório gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
				{
					x: MARGIN,
					y: y - 12,
					size: 8,
					font,
					color: rgb(0.46, 0.5, 0.55),
				},
			);
			y -= 28;

			drawYAxis(page, boldFont, y, "Indicadores de Desempenho");
			y -= 24;

			const kpiColWidth = (CONTENT_WIDTH - 30) / 4;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				kpiColWidth,
				"Orçamento Ativo",
				fmtCurrency(report.budget.total),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + kpiColWidth + 10,
				y,
				kpiColWidth,
				"Valor Agregado (EV)",
				fmtCurrency(report.measurements.total),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Custo Real (AC)",
				fmtCurrency(dashboard?.spent ?? 0),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 3 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Saldo",
				fmtCurrency(report.costs.balance),
			);
			y -= 66;

			const pctColWidth = (CONTENT_WIDTH - 20) / 3;
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN,
				y,
				pctColWidth,
				"% Medido",
				formatPct(report.measurements.percentage),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + pctColWidth + 10,
				y,
				pctColWidth,
				"IDC (CPI)",
				formatNumber(report.evm.costPerformanceIndex ?? NaN),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (pctColWidth + 10),
				y,
				pctColWidth,
				"IDP (SPI)",
				formatNumber(report.evm.schedulePerformanceIndex ?? NaN),
			);
			y -= 76;

			if (sCurveData?.totals?.months?.length) {
				drawYAxis(page, boldFont, y, "Curva S — Valores Mensais");
				y -= 28;

				const columns: TableColumn[] = [
					{ label: "Mês", width: 60, align: "center" },
					{ label: "Planejado", width: 90, align: "right" },
					{ label: "Medido", width: 90, align: "right" },
					{ label: "Real", width: 90, align: "right" },
					{ label: "Plan. Acum.", width: 90, align: "right" },
					{ label: "Med. Acum.", width: 90, align: "right" },
					{ label: "Real Acum.", width: 90, align: "right" },
				];

				drawTableHeader(
					page,
					font,
					boldFont,
					MARGIN + TABLE_MARGIN,
					y,
					columns,
				);
				y -= 24;
				let pageRef: PDFPage = page;

				for (let i = 0; i < sCurveData.totals.months.length; i++) {
					const month = sCurveData.totals.months[i];
					if (y < 80) {
						drawFooter(pageRef, font, doc.getPageCount());
						const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
						drawHeader(
							newPage,
							font,
							boldFont,
							`Relatório Gerencial • ${report.work.name}`,
							`${report.work.code}${report.costCenter ? ` • ${report.costCenter.name}` : ""}`,
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
						pageRef = newPage;
					}
					drawTableRow(
						pageRef,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						columns,
						[
							month,
							fmtCurrency(sCurveData.totals.plannedByMonth[i]),
							fmtCurrency(sCurveData.totals.measuredByMonth[i]),
							fmtCurrency(sCurveData.totals.actualByMonth[i]),
							fmtCurrency(sCurveData.totals.plannedAccumulated[i]),
							fmtCurrency(sCurveData.totals.measuredAccumulated[i]),
							fmtCurrency(sCurveData.totals.actualAccumulated[i]),
						],
						i,
					);
					y -= 22;
				}

				y -= 16;
			}

			if (dashboard?.costsByCategory?.length) {
				if (y < 120) {
					drawFooter(page, font, doc.getPageCount());
					const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
					drawHeader(
						newPage,
						font,
						boldFont,
						`Relatório Gerencial • ${report.work.name}`,
						`${report.work.code}${report.costCenter ? ` • ${report.costCenter.name}` : ""}`,
					);
					y = PAGE_HEIGHT - 60;
					page = newPage;
				}

				drawYAxis(page, boldFont, y, "Custos por Categoria");
				y -= 28;

				const catColumns: TableColumn[] = [
					{ label: "Categoria", width: 250, align: "left" },
					{ label: "Valor", width: 140, align: "right" },
					{ label: "%", width: 100, align: "right" },
				];

				drawTableHeader(
					page,
					font,
					boldFont,
					MARGIN + TABLE_MARGIN,
					y,
					catColumns,
				);
				y -= 24;

				for (let i = 0; i < dashboard.costsByCategory.length; i++) {
					const cat = dashboard.costsByCategory[i];
					if (y < 60) {
						drawFooter(page, font, doc.getPageCount());
						const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
						drawHeader(
							newPage,
							font,
							boldFont,
							`Relatório Gerencial • ${report.work.name}`,
							`${report.work.code}${report.costCenter ? ` • ${report.costCenter.name}` : ""}`,
						);
						y = PAGE_HEIGHT - 60;
						drawTableHeader(
							newPage,
							font,
							boldFont,
							MARGIN + TABLE_MARGIN,
							y,
							catColumns,
						);
						y -= 24;
						page = newPage;
					}
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						catColumns,
						[cat.category, fmtCurrency(cat.amount), formatPct(cat.percentage)],
						i,
					);
					y -= 22;
				}
			}
		},
	);

	return new Response(pdfBytes as unknown as Blob, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="relatorio-gerencial-${report.work.code}.pdf"`,
		},
	});
}
