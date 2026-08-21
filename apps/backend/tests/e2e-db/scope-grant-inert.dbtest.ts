import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import { resolveResourceScope } from "../../src/lib/resource-scope";
import {
	CC_A,
	ORG_A,
	resetAndSeedDatabase,
	SUPERVISOR_USER,
	WORK_A,
} from "./setup.dbtest";

describe("AUTH-03 - ScopeGrant nao concede acesso", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
		await prisma.userScopeGrant.createMany({
			data: [
				{
					id: "grant-org-1",
					userId: SUPERVISOR_USER,
					scopeType: "organization",
					scopeId: ORG_A,
					role: "SUPERVISOR",
				},
				{
					id: "grant-cc-1",
					userId: SUPERVISOR_USER,
					scopeType: "costCenter",
					scopeId: CC_A,
					role: "SUPERVISOR",
				},
				{
					id: "grant-work-1",
					userId: SUPERVISOR_USER,
					scopeType: "work",
					scopeId: WORK_A,
					role: "SUPERVISOR",
				},
			],
		});
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("grant isolado (sem memberships) nao concede read nem write", async () => {
		const work = await resolveResourceScope(SUPERVISOR_USER, {
			workId: WORK_A,
		});
		expect(work.canRead).toBe(false);
		expect(work.canWrite).toBe(false);
		expect(work.role).toBeNull();

		const center = await resolveResourceScope(SUPERVISOR_USER, {
			costCenterId: CC_A,
		});
		expect(center.canRead).toBe(false);
		expect(center.canWrite).toBe(false);

		const organization = await resolveResourceScope(SUPERVISOR_USER, {
			organizationId: ORG_A,
		});
		expect(organization.canRead).toBe(false);
	});
});
