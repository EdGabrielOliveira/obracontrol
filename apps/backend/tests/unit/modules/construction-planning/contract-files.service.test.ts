import { beforeEach, describe, expect, it, mock } from "bun:test";
import { prisma } from "../../../../src/lib/prisma";

mock.module("../../../../src/lib/prisma", () => {
	const mockPrisma = {
		contract: {
			findFirst: mock(),
		},
		contractFolder: {
			findMany: mock(),
			findFirst: mock(),
			create: mock(),
		},
		contractFile: {
			create: mock(),
			findFirst: mock(),
			delete: mock(),
		},
	};
	return { prisma: mockPrisma };
});

const { contractFilesService } = await import(
	"../../../../src/modules/construction-planning/contract-files.service"
);

describe("contract files service", () => {
	beforeEach(() => {
		mock.restore();
	});

	it("lista pastas de um contrato com arquivos e filtro por ownerId", async () => {
		(prisma.contract.findFirst as ReturnType<typeof mock>).mockResolvedValue({
			id: "c-1",
		});
		(
			prisma.contractFolder.findMany as ReturnType<typeof mock>
		).mockResolvedValue([
			{
				id: "f-1",
				name: "Documentos",
				files: [
					{
						id: "file-1",
						name: "contrato.pdf",
						url: "https://example.com/contrato.pdf",
					},
				],
			},
		]);

		const result = await contractFilesService.listFolders("owner-1", "c-1");

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ id: "f-1", name: "Documentos" });
		expect(result[0].files).toHaveLength(1);
		expect(result[0].files[0]).toMatchObject({
			id: "file-1",
			name: "contrato.pdf",
		});
		expect(prisma.contract.findFirst).toHaveBeenCalledWith({
			where: { id: "c-1", ownerId: "owner-1" },
		});
		expect(prisma.contractFolder.findMany).toHaveBeenCalledWith({
			where: { contractId: "c-1" },
			include: { files: true },
			orderBy: { createdAt: "asc" },
		});
	});

	it("lanca 404 ao listar pastas de contrato inexistente", async () => {
		(prisma.contract.findFirst as ReturnType<typeof mock>).mockResolvedValue(
			null,
		);

		await expect(
			contractFilesService.listFolders("owner-1", "c-1"),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
		});
	});

	it("cria uma pasta", async () => {
		(prisma.contract.findFirst as ReturnType<typeof mock>).mockResolvedValue({
			id: "c-1",
		});
		(prisma.contractFolder.create as ReturnType<typeof mock>).mockResolvedValue(
			{
				id: "f-new",
				name: "Nova Pasta",
			},
		);

		const result = await contractFilesService.createFolder(
			"owner-1",
			"c-1",
			"Nova Pasta",
		);

		expect(result).toMatchObject({ id: "f-new", name: "Nova Pasta" });
	});

	it("upload de arquivo", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });
		(prisma.contractFile.create as ReturnType<typeof mock>).mockResolvedValue({
			id: "file-1",
			name: "nota.pdf",
			url: "https://example.com/nota.pdf",
		});

		const result = await contractFilesService.uploadFile(
			"owner-1",
			"c-1",
			"f-1",
			{
				name: "nota.pdf",
				url: "https://example.com/nota.pdf",
				size: 1024,
				mimeType: "application/pdf",
			},
		);

		expect(result).toMatchObject({ id: "file-1", name: "nota.pdf" });
	});

	it("rejeita arquivo muito grande", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });

		await expect(
			contractFilesService.uploadFile("owner-1", "c-1", "f-1", {
				name: "grande.pdf",
				url: "https://example.com/grande.pdf",
				size: 20 * 1024 * 1024,
				mimeType: "application/pdf",
			}),
		).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
	});

	it("rejeita tipo de arquivo invalido", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });

		await expect(
			contractFilesService.uploadFile("owner-1", "c-1", "f-1", {
				name: "script.exe",
				url: "https://example.com/script.exe",
				mimeType: "application/x-msdownload",
			}),
		).rejects.toMatchObject({ code: "INVALID_FILE_TYPE", status: 415 });
	});

	it("rejeita DOCX (nao permitido)", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });

		await expect(
			contractFilesService.uploadFile("owner-1", "c-1", "f-1", {
				name: "doc.docx",
				url: "https://example.com/doc.docx",
				mimeType:
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}),
		).rejects.toMatchObject({ code: "INVALID_FILE_TYPE", status: 415 });
	});

	it("aceita PDF ate 10MB", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });
		(prisma.contractFile.create as ReturnType<typeof mock>).mockResolvedValue({
			id: "file-pdf",
		});

		const result = await contractFilesService.uploadFile(
			"owner-1",
			"c-1",
			"f-1",
			{
				name: "doc.pdf",
				url: "https://example.com/doc.pdf",
				size: 10 * 1024 * 1024,
				mimeType: "application/pdf",
			},
		);

		expect(result).toMatchObject({ id: "file-pdf" });
	});

	it("rejeita PDF acima de 10MB", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });

		await expect(
			contractFilesService.uploadFile("owner-1", "c-1", "f-1", {
				name: "grande.pdf",
				url: "https://example.com/grande.pdf",
				size: 10 * 1024 * 1024 + 1,
				mimeType: "application/pdf",
			}),
		).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
	});

	it("aceita JPEG ate 5MB", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });
		(prisma.contractFile.create as ReturnType<typeof mock>).mockResolvedValue({
			id: "file-jpg",
		});

		const result = await contractFilesService.uploadFile(
			"owner-1",
			"c-1",
			"f-1",
			{
				name: "foto.jpg",
				url: "https://example.com/foto.jpg",
				size: 5 * 1024 * 1024,
				mimeType: "image/jpeg",
			},
		);

		expect(result).toMatchObject({ id: "file-jpg" });
	});

	it("rejeita imagem acima de 5MB", async () => {
		(
			prisma.contractFolder.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "f-1" });

		await expect(
			contractFilesService.uploadFile("owner-1", "c-1", "f-1", {
				name: "foto_grande.png",
				url: "https://example.com/foto_grande.png",
				size: 5 * 1024 * 1024 + 1,
				mimeType: "image/png",
			}),
		).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
	});

	it("deleta arquivo", async () => {
		(
			prisma.contractFile.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "file-1" });
		(prisma.contractFile.delete as ReturnType<typeof mock>).mockResolvedValue(
			{},
		);

		const result = await contractFilesService.deleteFile(
			"owner-1",
			"c-1",
			"f-1",
			"file-1",
		);

		expect(result).toMatchObject({ id: "file-1" });
	});

	it("updateFile rejeita tipo invalido", async () => {
		(
			prisma.contractFile.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "file-1" });

		await expect(
			contractFilesService.updateFile("owner-1", "c-1", "f-1", "file-1", {
				mimeType: "text/html",
			}),
		).rejects.toMatchObject({ code: "INVALID_FILE_TYPE", status: 415 });
	});

	it("updateFile rejeita PDF acima de 10MB", async () => {
		(
			prisma.contractFile.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "file-1" });

		await expect(
			contractFilesService.updateFile("owner-1", "c-1", "f-1", "file-1", {
				size: 11 * 1024 * 1024,
				mimeType: "application/pdf",
			}),
		).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
	});

	it("updateFile rejeita imagem acima de 5MB", async () => {
		(
			prisma.contractFile.findFirst as ReturnType<typeof mock>
		).mockResolvedValue({ id: "file-1" });

		await expect(
			contractFilesService.updateFile("owner-1", "c-1", "f-1", "file-1", {
				size: 6 * 1024 * 1024,
				mimeType: "image/png",
			}),
		).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
	});

	it("lanca 404 ao deletar arquivo inexistente", async () => {
		(
			prisma.contractFile.findFirst as ReturnType<typeof mock>
		).mockResolvedValue(null);

		await expect(
			contractFilesService.deleteFile("owner-1", "c-1", "f-1", "file-1"),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});
});
