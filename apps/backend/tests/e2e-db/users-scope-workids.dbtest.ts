import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import { invitationService } from "../../src/modules/users/invitation.service";
import { userService } from "../../src/modules/users/service";
import {
	ADMIN_USER,
	CC_A,
	ORG_A,
	resetAndSeedDatabase,
	SUPERVISOR_USER,
	WORK_A,
} from "./setup.dbtest";

describe("AUTH-01 - workIds ponta a ponta", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("round-trip create -> detail -> edit -> convite -> aceite preserva workIds", async () => {
		const created = await userService.create(
			{
				name: "Supervisor WorkIds",
				email: "supervisor-workids@e2e.obra.bi",
				password: "SenhaForte@2026",
				role: "SUPERVISOR",
				scope: {
					organizationIds: [ORG_A],
					costCenterIds: [CC_A],
					workIds: [WORK_A],
				},
			},
			{ actorId: ADMIN_USER },
		);
		const userId = created.id;

		const detail = await userService.getByIdScoped(ADMIN_USER, userId);
		const activeWorkMemberships = detail.workMemberships.filter(
			(membership) => !membership.revokedAt,
		);
		expect(
			activeWorkMemberships.map((membership) => membership.workId),
		).toEqual([WORK_A]);
		const activeCenters = detail.costCenterMemberships.filter(
			(membership) => !membership.revokedAt,
		);
		expect(activeCenters.map((membership) => membership.costCenterId)).toEqual([
			CC_A,
		]);

		const updated = await userService.update(ADMIN_USER, userId, {
			scope: {
				organizationIds: [ORG_A],
				costCenterIds: [CC_A],
				workIds: [WORK_A],
			},
		});
		expect(updated.workMemberships.filter((m) => !m.revokedAt)).toHaveLength(1);
		expect(
			updated.costCenterMemberships.filter((m) => !m.revokedAt),
		).toHaveLength(1);

		const invitation = await invitationService.createInvitation(ADMIN_USER, {
			email: "gestor-convite@e2e.obra.bi",
			role: "SUPERVISOR",
			scope: {
				organizationIds: [ORG_A],
				costCenterIds: [CC_A],
				workIds: [WORK_A],
			},
		});
		expect(invitation.scope.workIds).toEqual([WORK_A]);

		const accepted = await invitationService.acceptInvitation(
			SUPERVISOR_USER,
			"gestor-convite@e2e.obra.bi",
			{ token: invitation.token },
		);
		expect(accepted.role).toBe("SUPERVISOR");

		const acceptedMemberships = await prisma.workMembership.findMany({
			where: { userId: SUPERVISOR_USER, revokedAt: null },
			select: { workId: true },
		});
		expect(acceptedMemberships.map((membership) => membership.workId)).toEqual([
			WORK_A,
		]);

		const acceptedCenterMemberships =
			await prisma.costCenterMembership.findMany({
				where: { userId: SUPERVISOR_USER, revokedAt: null },
				select: { costCenterId: true },
			});
		expect(
			acceptedCenterMemberships.map((membership) => membership.costCenterId),
		).toEqual([CC_A]);
	});

	it("workIds sem centro pai no mesmo escopo e rejeitado no write", async () => {
		let error: { code?: string; status?: number } | undefined;
		try {
			await userService.create(
				{
					name: "Supervisor Orfao",
					email: "supervisor-orfao@e2e.obra.bi",
					password: "SenhaForte@2026",
					role: "SUPERVISOR",
					scope: {
						organizationIds: [ORG_A],
						costCenterIds: [],
						workIds: [WORK_A],
					},
				},
				{ actorId: ADMIN_USER },
			);
		} catch (e: unknown) {
			error = e as { code?: string; status?: number };
		}
		expect(error?.code).toBe("WORK_WITHOUT_CENTER_ACCESS");
		expect(error?.status).toBe(422);
	});

	it("replaceScope troca workIds sem deixar membros antigos ativos", async () => {
		const target = await userService.create(
			{
				name: "Supervisor Replace",
				email: "supervisor-replace@e2e.obra.bi",
				password: "SenhaForte@2026",
				role: "SUPERVISOR",
				scope: {
					organizationIds: [ORG_A],
					costCenterIds: [CC_A],
					workIds: [WORK_A],
				},
			},
			{ actorId: ADMIN_USER },
		);

		const replaced = await userService.replaceScope(ADMIN_USER, target.id, {
			organizationIds: [ORG_A],
			costCenterIds: [CC_A],
			workIds: [],
		});
		const activeWorks = replaced.workMemberships.filter(
			(membership) => !membership.revokedAt,
		);
		expect(activeWorks).toHaveLength(0);

		const revoked = await prisma.workMembership.findMany({
			where: { userId: target.id, revokedAt: { not: null } },
			select: { workId: true },
		});
		expect(revoked.map((membership) => membership.workId)).toContain(WORK_A);
	});
});
