import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	type ContractGatewayInput,
	createContractWithEffects,
} from "../../src/modules/construction-planning/contracts/contract-creation.service";
import {
	ensureBudgetVersion,
	ITEM_A1,
	OWNER_A,
	resetAndSeedDatabase,
	WORK_A,
} from "./setup.dbtest";

function buildInput(
	overrides: Partial<ContractGatewayInput> = {},
): ContractGatewayInput {
	return {
		resourceOwnerId: OWNER_A,
		actorId: OWNER_A,
		workId: WORK_A,
		origin: { type: "QUOTATION", quotationId: "con01-quotation-1" },
		supplier: { name: "Fornecedor Gateway", supplierId: null },
		contract: {
			code: "CT-GW-001",
			contractValue: 1000,
			serviceType: "OBRA",
			title: "Contrato Gateway",
		},
		services: [
			{
				budgetItemId: ITEM_A1,
				quantity: 10,
				unitCost: 100,
			},
		],
		idempotencyKey: "con01-key-1",
		...overrides,
	};
}

describe("CON-01 - gateway unico de criacao de contrato", () => {
	let itemId: string;

	beforeAll(async () => {
		await resetAndSeedDatabase();
		await ensureBudgetVersion(OWNER_A, WORK_A);
		itemId = ITEM_A1;

		await prisma.quotation.create({
			data: {
				id: "con01-quotation-1",
				ownerId: OWNER_A,
				workId: WORK_A,
				title: "Cotacao Gateway",
				status: "ESCOLHIDA",
			},
		});
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("cria contrato + servicos + compromisso + link de origem na mesma transacao", async () => {
		const result = await createContractWithEffects(
			buildInput({
				services: [{ budgetItemId: itemId, quantity: 10, unitCost: 100 }],
			}),
		);

		expect(result.replayed).toBe(false);
		expect(result.contract.code).toBe("CT-GW-001");

		const contract = await prisma.contract.findUnique({
			where: { id: result.contract.id },
			include: { services: true },
		});
		expect(contract).not.toBeNull();
		expect(contract?.services).toHaveLength(1);

		const quotation = await prisma.quotation.findUnique({
			where: { id: "con01-quotation-1" },
		});
		expect(quotation?.contractId).toBe(result.contract.id);
		expect(quotation?.status).toBe("CONTRATADA");

		const impact = await prisma.constructionBudgetImpact.findFirst({
			where: {
				sourceType: "CONTRACT_SERVICE",
				workId: WORK_A,
				impactType: "COMMITMENT",
			},
		});
		expect(impact).not.toBeNull();
		expect(impact?.amount.toNumber()).toBe(1000);
	});

	it("replay da mesma origem retorna o mesmo contrato sem duplicar", async () => {
		const replay = await createContractWithEffects(
			buildInput({
				services: [{ budgetItemId: itemId, quantity: 10, unitCost: 100 }],
			}),
		);

		expect(replay.replayed).toBe(true);
		expect(replay.contract.code).toBe("CT-GW-001");

		const contractCount = await prisma.contract.count({
			where: { code: "CT-GW-001" },
		});
		expect(contractCount).toBe(1);
	});

	it("mesma origem com payload diferente e rejeitado", async () => {
		let error: { code?: string; status?: number } | undefined;
		try {
			await createContractWithEffects(
				buildInput({
					contract: { code: "CT-GW-001", contractValue: 9999 },
					services: [{ budgetItemId: itemId, quantity: 10, unitCost: 100 }],
				}),
			);
		} catch (e: unknown) {
			error = e as { code?: string; status?: number };
		}
		expect(error?.code).toBe("CONTRACT_GATEWAY_PAYLOAD_CONFLICT");
		expect(error?.status).toBe(409);
	});
});
