import { prismaExecutionViewRepository } from "../bi/execution-view.repository";
import type { ExecutionViewResponse } from "../bi/execution-view.service";
import { ExecutionViewService } from "../bi/execution-view.service";
import { metricSourceResolver } from "../bi/metric-source-resolver";
import * as repository from "../repository";
import { ConstructionScheduleService } from "../schedule/schedule-service";
import {
	CONTENT_WIDTH,
	drawKpiBox,
	drawYAxis,
	fmtCurrency,
	generatePdf,
	MARGIN,
	PAGE_HEIGHT,
} from "./layout";
import { drawTableHeader, drawTableRow, type TableColumn } from "./table";

type ExecutionViewResolver = (
	ownerId: string,
	workId: string,
	asOf?: Date,
) => Promise<ExecutionViewResponse>;

const executionViewService = new ExecutionViewService(
	prismaExecutionViewRepository,
	metricSourceResolver,
	new ConstructionScheduleService(repository),
);

const DEVIATION_STATUS_LABEL: Record<string, string> = {
	ON_TRACK: "No prazo",
	AT_RISK: "Em risco",
	DELAYED: "Atrasado",
	NO_DATA: "Sem dados",
};

function metricLabel(
	_label: string,
	metric: ExecutionViewResponse["financial"]["grossMargin"],
): string {
	if (metric.completeness === "UNAVAILABLE") return "Indisponivel";
	if (metric.realized == null) return "Indisponivel";
	return fmtCurrency(metric.realized);
}

export async function generateWorkExecutionPdf(
	ownerId: string,
	workId: string,
	asOf?: Date,
	resolve: ExecutionViewResolver = (o, w, a) =>
		executionViewService.getExecutionView(o, w, a),
): Promise<Response> {
	const view = await resolve(ownerId, workId, asOf);

	const pdfBytes = await generatePdf(
		view.work.name,
		`Obra • ${view.work.code}`,
		async (_doc, page, font, boldFont) => {
			let y = PAGE_HEIGHT - 90;

			page.drawText(`Fonte: ${view.sourceMode} • Corte: ${view.asOfDate}`, {
				x: MARGIN,
				y: y - 6,
				size: 9,
				font,
			});
			y -= 30;

			drawYAxis(page, boldFont, y, "Financeiro");
			y -= 24;

			const kpiColWidth = (CONTENT_WIDTH - 20) / 3;
			const financialLabels = [
				["Margem bruta", view.financial.grossMargin],
				["Lucro bruto", view.financial.grossProfit],
				["Faturamento", view.financial.billing],
				["Custos", view.financial.costs],
			] as const;

			let x = MARGIN;
			let count = 0;
			for (const [label, metric] of financialLabels) {
				drawKpiBox(
					page,
					font,
					boldFont,
					x,
					y,
					kpiColWidth,
					label,
					metricLabel(label, metric),
				);
				x += kpiColWidth + 10;
				count += 1;
				if (count % 3 === 0) {
					x = MARGIN;
					y -= 66;
				}
			}
			y -= 66;

			const issues = view.financial.issues;
			if (issues.length > 0) {
				drawYAxis(page, boldFont, y, "Qualidade dos dados");
				y -= 22;
				for (const issue of issues) {
					page.drawText(`• ${issue.message}`, {
						x: MARGIN,
						y: y - 12,
						size: 8,
						font,
					});
					y -= 14;
				}
				y -= 10;
			}

			drawYAxis(page, boldFont, y, "Contratos vinculados");
			y -= 22;
			const contractColumns: TableColumn[] = [
				{ label: "Codigo", width: 90, align: "left" },
				{ label: "Fornecedor", width: 180, align: "left" },
				{ label: "Valor", width: 110, align: "right" },
				{ label: "Situacao", width: 115, align: "left" },
			];
			drawTableHeader(page, font, boldFont, MARGIN, y, contractColumns);
			y -= 20;
			if (view.contracts.length === 0) {
				page.drawText("Nenhum contrato vinculado.", {
					x: MARGIN,
					y: y - 12,
					size: 8,
					font,
				});
			} else {
				view.contracts.forEach((contract, index) => {
					drawTableRow(
						page,
						font,
						MARGIN,
						y,
						contractColumns,
						[
							contract.code,
							contract.supplierName,
							fmtCurrency(
								contract.contractValue + (contract.amendmentNet ?? 0),
							),
							contract.status,
						],
						index,
					);
					y -= 20;
				});
			}
			y -= 20;

			drawYAxis(page, boldFont, y, "Desvios do cronograma");
			y -= 22;
			const deviationColumns: TableColumn[] = [
				{ label: "Indice", width: 70, align: "left" },
				{ label: "Descricao", width: 220, align: "left" },
				{ label: "Situacao", width: 90, align: "left" },
				{ label: "Desvio (dias)", width: 115, align: "right" },
			];
			drawTableHeader(page, font, boldFont, MARGIN, y, deviationColumns);
			y -= 20;
			const deviations = view.schedule.deviations.filter(
				(deviation) => deviation.status !== "NO_DATA",
			);
			if (deviations.length === 0) {
				page.drawText("Nenhum desvio atrasado.", {
					x: MARGIN,
					y: y - 12,
					size: 8,
					font,
				});
			} else {
				deviations.forEach((deviation, index) => {
					drawTableRow(
						page,
						font,
						MARGIN,
						y,
						deviationColumns,
						[
							deviation.index,
							deviation.description,
							DEVIATION_STATUS_LABEL[deviation.status] ?? deviation.status,
							deviation.varianceDays != null
								? String(deviation.varianceDays)
								: "-",
						],
						index,
					);
					y -= 20;
				});
			}
		},
	);

	return new Response(pdfBytes as unknown as Blob, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="relatorio-execucao-${view.work.code}.pdf"`,
		},
	});
}
