import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { managementService } from "../../../../src/modules/construction-planning/management.service";
import * as worksRepository from "../../../../src/modules/construction-planning/works/works.repository";

function makeFile(
	overrides: Partial<{
		name: string;
		type: string;
		size: number;
		bytes: Uint8Array;
	}> = {},
): File {
	const bytes = overrides.bytes ?? new Uint8Array([0x25, 0x50, 0x44, 0x46]);
	return {
		name: overrides.name ?? "foto.pdf",
		type: overrides.type ?? "application/pdf",
		size: overrides.size ?? bytes.byteLength,
		slice: (start?: number, end?: number) =>
			new Blob([bytes.slice(start, end)]),
		arrayBuffer: async () => bytes.buffer as ArrayBuffer,
	} as unknown as File;
}

describe("management service receiveWorkPhotoPdf (REL-003)", () => {
	beforeEach(() => {
		spyOn(worksRepository, "getWorkOrThrow").mockResolvedValue({
			id: "work-1",
		} as never);
	});

	it("aceita PDF valido e retorna metadata RECEIVED", async () => {
		const result = await managementService.receiveWorkPhotoPdf(
			"owner-1",
			"work-1",
			makeFile(),
		);

		expect(result).toMatchObject({
			workId: "work-1",
			fileName: "foto.pdf",
			contentType: "application/pdf",
			status: "RECEIVED",
		});
	});

	it("rejeita extensao diferente de .pdf", async () => {
		await expect(
			managementService.receiveWorkPhotoPdf(
				"owner-1",
				"work-1",
				makeFile({ name: "foto.png" }),
			),
		).rejects.toMatchObject({
			code: "INVALID_FILE_TYPE",
			status: 400,
			message: "Apenas arquivos PDF sao aceitos",
		});
	});

	it("rejeita MIME diferente de application/pdf", async () => {
		await expect(
			managementService.receiveWorkPhotoPdf(
				"owner-1",
				"work-1",
				makeFile({ type: "image/png" }),
			),
		).rejects.toMatchObject({
			code: "INVALID_FILE_TYPE",
			status: 400,
		});
	});

	it("rejeita arquivo acima de 10MB", async () => {
		await expect(
			managementService.receiveWorkPhotoPdf(
				"owner-1",
				"work-1",
				makeFile({ size: 11 * 1024 * 1024 }),
			),
		).rejects.toMatchObject({
			code: "FILE_TOO_LARGE",
			status: 413,
			message: "Arquivo deve ter no maximo 10MB",
		});
	});

	it("rejeita arquivo sem magic %PDF (conteudo nao e PDF)", async () => {
		await expect(
			managementService.receiveWorkPhotoPdf(
				"owner-1",
				"work-1",
				makeFile({ bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03]) }),
			),
		).rejects.toMatchObject({
			code: "INVALID_FILE_TYPE",
			status: 400,
			message: "Arquivo PDF invalido",
		});
	});

	it("obra de outro owner nao existe: getWorkOrThrow propaga 404", async () => {
		spyOn(worksRepository, "getWorkOrThrow").mockRejectedValueOnce(
			Object.assign(new Error("not found"), {
				code: "NOT_FOUND",
				status: 404,
			}),
		);

		await expect(
			managementService.receiveWorkPhotoPdf("owner-2", "work-1", makeFile()),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});
});
