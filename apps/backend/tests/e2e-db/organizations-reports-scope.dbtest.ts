import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { handleConstructionError } from "../../src/lib/construction-error-handler";
import { prisma } from "../../src/lib/prisma";
import { decimalToNumber } from "../../src/lib/serialize-helpers";
import { organizationController } from "../../src/modules/organizations/routes";
import {
	ADMIN_USER,
	CC_A,
	ORG_A,
	OWNER_A,
	resetAndSeedDatabase,
	SUPERVISOR_USER,
	sessionCookie,
} from "./setup.dbtest";

const app = new Elysia({ name: "organizations-reports-scope-app" })
	.onError(handleConstructionError)
	.onAfterHandle(({ response }) => {
		if (response instanceof Response) return response;
		return decimalToNumber(response);
	})
	.use(organizationController);

async function api(userId: string, path: string): Promise<Response> {
	const headers = new Headers();
	headers.set("cookie", sessionCookie(userId));
	return app.handle(new Request(`http://localhost:7000${path}`, { headers }));
}

describe("AUTH-01 - relatorios organizacionais resolvem owner pelo recurso", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("ADMIN (owner global) le relatorio do centro de outra org", async () => {
		const response = await api(
			ADMIN_USER,
			`/organizations/${ORG_A}/cost-centers/${CC_A}/reports`,
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			costCenter: { id: string };
			works: unknown[];
		};
		expect(body.costCenter.id).toBe(CC_A);
		expect(body.works.length).toBeGreaterThan(0);
	});

	it("owner da cadeia le relatorio do proprio centro", async () => {
		const response = await api(
			OWNER_A,
			`/organizations/${ORG_A}/cost-centers/${CC_A}/reports`,
		);
		expect(response.status).toBe(200);
	});

	it("usuario sem membership nao revela recurso de outra org (404)", async () => {
		const response = await api(
			SUPERVISOR_USER,
			`/organizations/${ORG_A}/cost-centers/${CC_A}/reports`,
		);
		expect(response.status).toBe(404);
	});

	it("relatorio de organizacao usa owner resolvido e inclui centros", async () => {
		const response = await api(ADMIN_USER, `/organizations/${ORG_A}/reports`);
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			costCenters: unknown[];
		};
		expect(body.costCenters.length).toBeGreaterThan(0);
	});
});
