import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import { OWNER_A, resetAndSeedDatabase, WORK_A } from "./setup.dbtest";

describe("CON - solicitacao de contratacao (fronteira persistida)", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("persiste a solicitacao com itens e propostas do lote", async () => {
		const batch = await prisma.importBatch.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_A,
				model: "quotation-map",
				version: "1",
				fileName: "mapa.xlsx",
				fileSha256: "sha-map-1",
				storageKey: "storage/mapa-1.xlsx",
				status: "READY",
				rowCount: 1,
				expiresAt: new Date(Date.now() + 60_000),
			},
		});
		const item = await prisma.constructionBudgetItem.findFirst({
			where: { ownerId: OWNER_A, workId: WORK_A },
			orderBy: { createdAt: "asc" },
			select: { id: true },
		});
		if (!item) throw new Error("seed sem item de orcamento");

		const request = await prisma.contractRequest.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_A,
				title: "Fundacao",
				serviceType: "Execucao",
				confirmedBatchId: batch.id,
				items: {
					create: {
						ownerId: OWNER_A,
						workId: WORK_A,
						budgetItemId: item.id,
						quantity: 10,
					},
				},
			},
			include: { items: true },
		});

		expect(request.status).toBe("EM_ESPERA");
		expect(request.items).toHaveLength(1);
		expect(request.items[0]?.budgetItemId).toBe(item.id);

		await prisma.contractRequestProposal.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_A,
				batchId: batch.id,
				normalizedCnpj: "12345678000190",
				supplierName: "Fornecedor A",
				proposalValue: 50_000,
				rowNumber: 2,
			},
		});
	});

	it("permite um unico contrato resultante por solicitacao", async () => {
		const request = await prisma.contractRequest.findFirst({
			where: { ownerId: OWNER_A, workId: WORK_A },
			orderBy: { createdAt: "desc" },
		});
		if (!request) throw new Error("solicitacao nao criada");

		const first = await prisma.contract.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_A,
				code: "CT-REQ-1",
				supplierName: "Fornecedor A",
				contractValue: 50_000,
				status: "RASCUNHO",
				contractRequestId: request.id,
			},
		});
		expect(first.contractRequestId).toBe(request.id);

		let secondError: unknown;
		try {
			await prisma.contract.create({
				data: {
					ownerId: OWNER_A,
					workId: WORK_A,
					code: "CT-REQ-2",
					supplierName: "Fornecedor B",
					contractValue: 60_000,
					status: "RASCUNHO",
					contractRequestId: request.id,
				},
			});
		} catch (caught) {
			secondError = caught;
		}
		expect(secondError).toMatchObject({ code: "P2002" });
	});
});
