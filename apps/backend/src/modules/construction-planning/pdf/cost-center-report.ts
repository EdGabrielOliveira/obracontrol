import { ConstructionError } from "../../../lib/errors";
import * as orgRepo from "../../organizations/repository";
import * as managementRepo from "../management.repository";
import {
	CONTENT_WIDTH,
	drawKpiBox,
	drawYAxis,
	fmtCurrency,
	generatePdf,
	MARGIN,
	PAGE_HEIGHT,
	TABLE_MARGIN,
} from "./layout";
import type { TableColumn } from "./table";
import { drawTableHeader, drawTableRow } from "./table";

export async function generateCostCenterPdf(
	ownerId: string,
	ccId: string,
): Promise<Response> {
	const report = await managementRepo.getCostCenterReport(ownerId, ccId);
	if (!report) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Centro de custo nao encontrado",
			404,
		);
	}

	const pdfBytes = await generatePdf(
		report.costCenter.name,
		"Centro de Custo",
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
				"Obras",
				String(report.summary.totalWorks),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + kpiColWidth + 10,
				y,
				kpiColWidth,
				"Orçado",
				fmtCurrency(report.summary.totalBudgeted),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Gasto",
				fmtCurrency(report.summary.totalSpent),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 3 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Saldo",
				fmtCurrency(report.summary.balance),
			);
			y -= 76;

			if (report.works.length > 0) {
				drawYAxis(page, boldFont, y, "Obras");
				y -= 28;

				const columns: TableColumn[] = [
					{ label: "Código", width: 70, align: "center" },
					{ label: "Nome", width: 180, align: "left" },
					{ label: "Status", width: 70, align: "center" },
					{ label: "Orçado", width: 110, align: "right" },
					{ label: "Gasto", width: 110, align: "right" },
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

				for (let i = 0; i < report.works.length; i++) {
					const w = report.works[i];
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						columns,
						[
							w.code,
							w.name,
							w.status ?? "-",
							fmtCurrency(w.budgeted),
							fmtCurrency(w.spent),
						],
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
			"content-disposition": `attachment; filename="relatorio-cc-${report.costCenter.name}.pdf"`,
		},
	});
}

export async function generateOrganizationPdf(
	ownerId: string,
	orgId: string,
): Promise<Response> {
	const report = await orgRepo.getOrganizationReport(ownerId, orgId);
	if (!report) {
		throw new ConstructionError("NOT_FOUND", "Organizacao nao encontrada", 404);
	}

	const pdfBytes = await generatePdf(
		report.organization.name,
		"Organização",
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
				"Centros de Custo",
				String(report.summary.totalCostCenters),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + kpiColWidth + 10,
				y,
				kpiColWidth,
				"Obras",
				String(report.summary.totalWorks),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 2 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Orçado",
				fmtCurrency(report.summary.totalBudgeted),
			);
			drawKpiBox(
				page,
				font,
				boldFont,
				MARGIN + 3 * (kpiColWidth + 10),
				y,
				kpiColWidth,
				"Gasto",
				fmtCurrency(report.summary.totalSpent),
			);
			y -= 76;

			if (report.costCenters.length > 0) {
				drawYAxis(page, boldFont, y, "Centros de Custo");
				y -= 28;

				const columns: TableColumn[] = [
					{ label: "Nome", width: 180, align: "left" },
					{ label: "Obras", width: 80, align: "center" },
					{ label: "Orçado", width: 145, align: "right" },
					{ label: "Gasto", width: 145, align: "right" },
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

				for (let i = 0; i < report.costCenters.length; i++) {
					const cc = report.costCenters[i];
					drawTableRow(
						page,
						font,
						MARGIN + TABLE_MARGIN,
						y,
						columns,
						[
							cc.name,
							String(cc.works),
							fmtCurrency(cc.budgeted),
							fmtCurrency(cc.spent),
						],
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
			"content-disposition": `attachment; filename="relatorio-org-${report.organization.name}.pdf"`,
		},
	});
}
