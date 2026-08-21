import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import { requestReversal } from "../../src/modules/governance/approval.service";
import {
	CC_A,
	ensureBudgetVersion,
	ORG_A,
	OWNER_A,
	resetAndSeedDatabase,
	WORK_A,
} from "./setup.dbtest";

describe("GOV-03 - reversao compensatoria real (BUDGET_IMPACT_APPROVE)", () => {
	let impactId: string;
	let requestId: string;

	beforeAll(async () => {
		await resetAndSeedDatabase();
		await ensureBudgetVersion(OWNER_A, WORK_A);

		const versionItem = await prisma.budgetVersionItem.findFirst({
			where: { version: { workId: WORK_A, isActive: true } },
			select: { id: true, identityId: true },
		});
		if (!versionItem) throw new Error("seed sem item de versao");

		const impact = await prisma.constructionBudgetImpact.create({
			data: {
				ownerId: OWNER_A,
				workId: WORK_A,
				budgetItemIdentityId: versionItem.identityId,
				budgetVersionItemId: versionItem.id,
				sourceType: "TEST_SOURCE",
				sourceId: "gov03-source-1",
				componentId: "gov03-component",
				impactType: "CONSUMPTION",
				status: "APPROVED",
				amount: 100,
			},
		});
		impactId = impact.id;

		const request = await prisma.approvalRequest.create({
			data: {
				ownerId: OWNER_A,
				actorId: OWNER_A,
				actorRole: "SUPERVISOR",
				organizationId: ORG_A,
				costCenterId: CC_A,
				resourceType: "WORK",
				resourceId: WORK_A,
				effectAction: "BUDGET_IMPACT_APPROVE",
				payloadJson: { workId: WORK_A, impactIds: [impact.id] },
				payloadHash: "hash-gov03",
				expectedVersion: 1,
				idempotencyKey: `gov03-reversal-${crypto.randomUUID()}`,
				requiredApproverRole: "GESTOR",
				status: "EXECUTED",
				executedAt: new Date(),
			},
		});
		requestId = request.id;
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("reverte o impacto aprovado, persiste reversal e audita", async () => {
		const result = await requestReversal({
			actorId: OWNER_A,
			requestId,
			reason: "Erro de lancamento identificado na revisao",
			expectedVersion: 1,
		});

		expect(result.status).toBe("EXECUTED");

		const reversal = await prisma.approvalReversalRequest.findUnique({
			where: { requestId },
		});
		expect(reversal).not.toBeNull();
		expect(reversal?.actorId).toBe(OWNER_A);
		expect(reversal?.reason).toBe("Erro de lancamento identificado na revisao");

		const updated = await prisma.constructionBudgetImpact.findUnique({
			where: { id: impactId },
		});
		expect(updated?.reversedAt).not.toBeNull();

		const reversalImpact = await prisma.constructionBudgetImpact.findFirst({
			where: { parentImpactId: impactId, impactType: "REVERSAL" },
		});
		expect(reversalImpact).not.toBeNull();

		const reversalEvent = await prisma.constructionLedgerEvent.findFirst({
			where: { sourceId: "gov03-source-1", eventType: "INCURRED_REVERSAL" },
		});
		expect(reversalEvent).not.toBeNull();

		const originalRequest = await prisma.approvalRequest.findUnique({
			where: { id: requestId },
		});
		expect(originalRequest?.status).toBe("EXECUTED");
		// A reversao nao grava ApprovalDecision: trilha propria.
		const decisionCount = await prisma.approvalDecision.count({
			where: { requestId },
		});
		expect(decisionCount).toBe(0);
	});

	it("segunda reversao e bloqueada sem alterar nada", async () => {
		let error: { code?: string; status?: number; message?: string } | undefined;
		try {
			await requestReversal({
				actorId: OWNER_A,
				requestId,
				reason: "Tentativa duplicada",
				expectedVersion: 1,
			});
		} catch (e: unknown) {
			error = e as { code?: string; status?: number; message?: string };
		}
		// O efeito ja nao e mais reversivel (impacto revertido): o guard do
		// handler dispara antes do guard de registro duplicado.
		expect(
			error?.code === "REVERSAL_ALREADY_EXISTS" ||
				error?.code === "REVERSAL_NOT_AVAILABLE",
		).toBe(true);
		expect(error?.status === 409 || error?.status === 422).toBe(true);
	});
});
