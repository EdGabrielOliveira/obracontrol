import { generateContractReportPdf } from "../pdf/contract-report";
import {
	generateCostCenterPdf,
	generateOrganizationPdf,
} from "../pdf/cost-center-report";
import { generateWorkExecutionPdf } from "../pdf/execution-report";
import { generateWorkManagementPdf } from "../pdf/management-report";
import {
	generateContractMeasurementPdf,
	generateWorkMeasurementPdf,
} from "../pdf/measurement-report";
import { generateWorkPdf } from "../pdf/work-report";

class PdfReportService {
	generateWorkPdf = generateWorkPdf;
	generateWorkExecutionPdf = generateWorkExecutionPdf;
	generateCostCenterPdf = generateCostCenterPdf;
	generateOrganizationPdf = generateOrganizationPdf;
	generateWorkMeasurementPdf = generateWorkMeasurementPdf;
	generateContractMeasurementPdf = generateContractMeasurementPdf;
	generateWorkManagementPdf = generateWorkManagementPdf;
	generateContractReportPdf = generateContractReportPdf;
}

export const pdfReportService = new PdfReportService();
