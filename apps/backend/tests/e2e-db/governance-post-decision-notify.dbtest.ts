import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import {
	decideApproval,
	registerApprovalEffectHandler,
} from "../../src/modules/governance/approval.service";
import { notificationService } from "../../src/modules/governance/notification.service";
import {
	GESTOR_USER,
	ORG_A,
	OWNER_A,
	resetAndSeedDatabase,
	SUPERVISOR_USER,
	WORK_A,
} from "./setup.dbtest";

registerApprovalEffectHandler({
	action: "TEST_ACTION",
	apply: async () => undefined,
	reject: async () => undefined,
});

const GERENTE_1 = "e2e-gerente-notif-1";
const GERENTE_2 = "e2e-gerente-notif-2";
const GERENTE_REVOGADO = "e2e-gerente-revogado";

async function createPendingSupervisorRequest() {
	const request = await prisma.approvalRequest.create({
		data: {
			ownerId: OWNER_A,
			actorId: SUPERVISOR_USER,
			actorRole: "SUPERVISOR",
			organizationId: ORG_A,
			costCenterId: "e2e-cc-a",
			resourceType: "WORK",
			resourceId: WORK_A,
			effectAction: "TEST_ACTION",
			payloadJson: { workId: WORK_A },
			payloadHash: "hash-test-gov02",
			expectedVersion: 1,
			idempotencyKey: `gov02-${crypto.randomUUID()}`,
			requiredApproverRole: "GESTOR",
			status: "PENDING",
		},
	});
	return request;
}

describe("GOV-02 - revisao de Gerente apos decisao de Supervisor", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
		await prisma.user.createMany({
			data: [
				{
					id: GERENTE_1,
					email: "gerente-notif-1@e2e.obra.bi",
					name: "Gerente Notif 1",
					role: "GERENTE",
				},
				{
					id: GERENTE_2,
					email: "gerente-notif-2@e2e.obra.bi",
					name: "Gerente Notif 2",
					role: "GERENTE",
				},
				{
					id: GERENTE_REVOGADO,
					email: "gerente-revogado@e2e.obra.bi",
					name: "Gerente Revogado",
					role: "GERENTE",
				},
			],
		});
		await prisma.organizationMembership.createMany({
			data: [
				{ organizationId: ORG_A, userId: GERENTE_1, role: "GERENTE" },
				{ organizationId: ORG_A, userId: GERENTE_2, role: "GERENTE" },
				{
					organizationId: ORG_A,
					userId: GERENTE_REVOGADO,
					role: "GERENTE",
					revokedAt: new Date(),
				},
			],
		});
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("aprovacao de Supervisor notifica Gerentes para revisao final", async () => {
		const request = await createPendingSupervisorRequest();
		await decideApproval({
			approverId: GESTOR_USER,
			requestId: request.id,
			decision: "APPROVE",
			reason: "Aprovacao de governanca",
		});
		const managerRequest = await prisma.approvalRequest.findFirst({
			where: {
				resourceId: WORK_A,
				actorRole: "GESTOR",
				requiredApproverRole: "GERENTE",
				status: "PENDING",
			},
			orderBy: { createdAt: "desc" },
		});
		expect(managerRequest?.id).toBeTruthy();

		const notifications = await prisma.notification.findMany({
			where: {
				eventType: "APPROVAL_MANAGER_REVIEW_REQUIRED",
				referenceId: managerRequest?.id,
			},
			orderBy: { recipientId: "asc" },
		});
		// A primeira decisao cria a segunda etapa; OWNER_A tambem e Gerente ativo.
		expect(notifications.map((n) => n.recipientId)).toEqual([
			GERENTE_1,
			GERENTE_2,
			OWNER_A,
		]);
		expect(
			notifications.every(
				(n) => n.eventType === "APPROVAL_MANAGER_REVIEW_REQUIRED",
			),
		).toBe(true);
		expect(notifications.every((n) => n.body?.includes("supervisor"))).toBe(
			true,
		);
		expect(notifications.every((n) => n.body?.includes(SUPERVISOR_USER))).toBe(
			true,
		);
		expect(
			notifications.every((n) => n.body?.includes(`/app/obras/${WORK_A}`)),
		).toBe(true);
	});

	it("repetir a decisao nao duplica notificacao (idempotencia)", async () => {
		const request = await createPendingSupervisorRequest();
		await decideApproval({
			approverId: GESTOR_USER,
			requestId: request.id,
			decision: "APPROVE",
			reason: "Aprovacao de governanca",
		});
		const managerRequest = await prisma.approvalRequest.findFirst({
			where: {
				resourceId: WORK_A,
				actorRole: "GESTOR",
				requiredApproverRole: "GERENTE",
				status: "PENDING",
			},
			orderBy: { createdAt: "desc" },
		});
		expect(managerRequest?.id).toBeTruthy();
		let conflict = false;
		try {
			await decideApproval({
				approverId: GESTOR_USER,
				requestId: request.id,
				decision: "APPROVE",
			});
		} catch {
			conflict = true;
		}
		expect(conflict).toBe(true);
		const count = await prisma.notification.count({
			where: {
				eventType: "APPROVAL_MANAGER_REVIEW_REQUIRED",
				referenceId: managerRequest?.id,
			},
		});
		expect(count).toBe(3);
	});

	it("service de notificacao permanece idempotente por destinatario", async () => {
		const first = await notificationService.create(
			{
				recipientId: GERENTE_1,
				eventType: "SUPERVISOR_REQUEST_EXECUTED",
				referenceId: "req-idempotente",
				title: "teste",
			},
			prisma as never,
		);
		const second = await notificationService.create(
			{
				recipientId: GERENTE_1,
				eventType: "SUPERVISOR_REQUEST_EXECUTED",
				referenceId: "req-idempotente",
				title: "teste",
			},
			prisma as never,
		);
		expect(first.id).toBe(second.id);
	});
});
