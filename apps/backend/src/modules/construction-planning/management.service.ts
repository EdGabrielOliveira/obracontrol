import { ConstructionError } from "../../lib/errors";
import type { SchedulePeriod } from "../../lib/period-utils";
import * as managementRepository from "./management.repository";
import { getWorkOrThrow } from "./works/works.repository";

const maxPhotoPdfBytes = 10 * 1024 * 1024;

export class ManagementService {
	async getDashboard(ownerId: string, workId: string, asOf?: Date) {
		const result = await managementRepository.getWorkManagementDashboard(
			ownerId,
			workId,
			asOf,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return result;
	}

	async getPhysicalFinancialSchedule(
		ownerId: string,
		workId: string,
		period: SchedulePeriod = "monthly",
		asOf?: Date,
	) {
		return managementRepository.getPhysicalFinancialSchedule(
			ownerId,
			workId,
			period,
			asOf,
		);
	}

	async getWorkReport(ownerId: string, workId: string, asOf?: Date) {
		const result = await managementRepository.getWorkReport(
			ownerId,
			workId,
			asOf,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return result;
	}

	async getContractReport(ownerId: string, contractId: string) {
		const result = await managementRepository.getContractReport(
			ownerId,
			contractId,
		);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return result;
	}

	async getCostCenterReport(ownerId: string, ccId: string) {
		const result = await managementRepository.getCostCenterReport(
			ownerId,
			ccId,
		);
		if (!result) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Centro de custo nao encontrado",
				404,
			);
		}
		return result;
	}

	async receiveWorkPhotoPdf(ownerId: string, workId: string, file: File) {
		await getWorkOrThrow(ownerId, workId);

		if (!file.name.toLowerCase().endsWith(".pdf")) {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Apenas arquivos PDF sao aceitos",
				400,
			);
		}
		if (file.type && file.type !== "application/pdf") {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Tipo de arquivo invalido",
				400,
			);
		}
		if (file.size > maxPhotoPdfBytes) {
			throw new ConstructionError(
				"FILE_TOO_LARGE",
				"Arquivo deve ter no maximo 10MB",
				413,
			);
		}

		const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
		const isPdf =
			signature[0] === 0x25 &&
			signature[1] === 0x50 &&
			signature[2] === 0x44 &&
			signature[3] === 0x46;
		if (!isPdf) {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Arquivo PDF invalido",
				400,
			);
		}

		return {
			workId,
			fileName: file.name,
			size: file.size,
			contentType: file.type || "application/pdf",
			status: "RECEIVED" as const,
		};
	}
}

export const managementService = new ManagementService();
