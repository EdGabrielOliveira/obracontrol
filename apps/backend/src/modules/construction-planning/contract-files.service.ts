import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"image/jpeg",
	"image/png",
]);

function getMaxSizeForMime(mimeType: string): number | null {
	if (mimeType === "application/pdf") return MAX_PDF_SIZE;
	if (mimeType === "image/jpeg" || mimeType === "image/png")
		return MAX_IMAGE_SIZE;
	return null;
}

function getSizeLimitMessage(mimeType: string): string {
	if (mimeType === "application/pdf")
		return "O arquivo deve ter no maximo 10MB";
	if (mimeType === "image/jpeg" || mimeType === "image/png")
		return "A imagem deve ter no maximo 5MB";
	return "Arquivo muito grande";
}

export class ContractFilesService {
	async listFolders(ownerId: string, contractId: string) {
		const contract = await prisma.contract.findFirst({
			where: { id: contractId, ownerId },
		});
		if (!contract) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return prisma.contractFolder.findMany({
			where: { contractId },
			include: { files: true },
			orderBy: { createdAt: "asc" },
		});
	}

	async createFolder(ownerId: string, contractId: string, name: string) {
		const contract = await prisma.contract.findFirst({
			where: { id: contractId, ownerId },
		});
		if (!contract) {
			throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
		}
		return prisma.contractFolder.create({
			data: { contractId, name },
		});
	}

	async uploadFile(
		ownerId: string,
		contractId: string,
		folderId: string,
		file: { name: string; url: string; size?: number; mimeType?: string },
	) {
		const folder = await prisma.contractFolder.findFirst({
			where: { id: folderId, contractId, contract: { ownerId } },
		});
		if (!folder) {
			throw new ConstructionError("NOT_FOUND", "Pasta nao encontrada", 404);
		}

		if (file.mimeType) {
			if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
				throw new ConstructionError(
					"INVALID_FILE_TYPE",
					"Tipo de arquivo nao permitido. Apenas PDF, JPEG e PNG sao aceitos",
					415,
				);
			}
			const maxSize = getMaxSizeForMime(file.mimeType);
			if (maxSize !== null && file.size && file.size > maxSize) {
				throw new ConstructionError(
					"FILE_TOO_LARGE",
					getSizeLimitMessage(file.mimeType),
					413,
				);
			}
		} else if (file.size && file.size > MAX_PDF_SIZE) {
			throw new ConstructionError(
				"FILE_TOO_LARGE",
				"Arquivo deve ter no maximo 10MB",
				413,
			);
		}

		return prisma.contractFile.create({
			data: {
				folderId,
				name: file.name,
				url: file.url,
				size: file.size ?? null,
				mimeType: file.mimeType ?? null,
			},
		});
	}

	async deleteFile(
		ownerId: string,
		contractId: string,
		folderId: string,
		fileId: string,
	) {
		const file = await prisma.contractFile.findFirst({
			where: {
				id: fileId,
				folderId,
				folder: { contractId, contract: { ownerId } },
			},
		});
		if (!file) {
			throw new ConstructionError("NOT_FOUND", "Arquivo nao encontrado", 404);
		}
		await prisma.contractFile.delete({ where: { id: fileId, folderId } });
		return file;
	}

	async updateFile(
		ownerId: string,
		contractId: string,
		folderId: string,
		fileId: string,
		input: { name?: string; url?: string; size?: number; mimeType?: string },
	) {
		const file = await prisma.contractFile.findFirst({
			where: {
				id: fileId,
				folderId,
				folder: { contractId, contract: { ownerId } },
			},
		});
		if (!file) {
			throw new ConstructionError("NOT_FOUND", "Arquivo nao encontrado", 404);
		}

		if (input.mimeType) {
			if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
				throw new ConstructionError(
					"INVALID_FILE_TYPE",
					"Tipo de arquivo nao permitido. Apenas PDF, JPEG e PNG sao aceitos",
					415,
				);
			}
			const maxSize = getMaxSizeForMime(input.mimeType);
			if (maxSize !== null && input.size && input.size > maxSize) {
				throw new ConstructionError(
					"FILE_TOO_LARGE",
					getSizeLimitMessage(input.mimeType),
					413,
				);
			}
		} else if (input.size && input.size > MAX_PDF_SIZE) {
			throw new ConstructionError(
				"FILE_TOO_LARGE",
				"Arquivo deve ter no maximo 10MB",
				413,
			);
		}

		return prisma.contractFile.update({
			where: { id: fileId, folderId },
			data: {
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.url !== undefined ? { url: input.url } : {}),
				...(input.size !== undefined ? { size: input.size } : {}),
				...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
			},
		});
	}
}

export const contractFilesService = new ContractFilesService();
