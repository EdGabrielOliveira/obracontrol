import { afterAll, beforeAll, expect } from "bun:test";
import { Elysia } from "elysia";
import { getOrCreateBaselineVersion } from "../../src/lib/budget-version-adapter";
import { handleConstructionError } from "../../src/lib/construction-error-handler";
import { configureLocalPrisma, prisma } from "../../src/lib/prisma";
import { createLocalPrisma } from "../../src/lib/prisma-local";
import { decimalToNumber } from "../../src/lib/serialize-helpers";
import { auditRoutes } from "../../src/modules/audit/routes";
import { constructionPlanningController } from "../../src/modules/construction-planning/routes";
import { governanceRoutes } from "../../src/modules/governance/routes";
import { resetAndSeedDatabase, sessionCookie } from "./seed";

export {
	ADMIN_USER,
	CC_A,
	CC_AD,
	CONTRACT_A,
	GESTOR_USER,
	IMPORT_A,
	IMPORT_AD,
	IMPORT_B,
	ITEM_A_STAGE,
	ITEM_A1,
	ITEM_AD1,
	ITEM_B_STAGE,
	ITEM_B1,
	ORG_A,
	ORG_AD,
	OWNER_A,
	OWNER_B,
	resetAndSeedDatabase,
	SERVICE_A1,
	SUPERVISOR_USER,
	sessionCookie,
	TEST_PASSWORD,
	truncateAllTables,
	WM_A1,
	WORK_A,
	WORK_AD,
	WORK_B,
} from "./seed";

export const API_BASE = "http://localhost:7000";

export const testApp = new Elysia({ name: "e2e-db-app" })
	.onError(handleConstructionError)
	.onAfterHandle(({ response }) => {
		if (response instanceof Response) return response;
		return decimalToNumber(response);
	})
	.use(constructionPlanningController)
	.use(governanceRoutes)
	.use(auditRoutes);

export async function api(
	userId: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	headers.set("cookie", sessionCookie(userId));
	return testApp.handle(
		new Request(`${API_BASE}${path}`, { ...init, headers }),
	);
}

export async function jsonBody(value: unknown): Promise<RequestInit> {
	return {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(value),
	};
}

export async function assertStatus(
	response: Response,
	expected: number,
): Promise<Record<string, unknown>> {
	expect(response.status).toBe(expected);
	const body = (await response.json()) as Record<string, unknown>;
	return body;
}

export async function ensureBudgetVersion(
	userId: string,
	workId: string,
): Promise<Record<string, unknown>> {
	return { budgetVersionId: await getOrCreateBaselineVersion(userId, workId) };
}

beforeAll(async () => {
	configureLocalPrisma(createLocalPrisma());
	await resetAndSeedDatabase();
});

afterAll(async () => {
	await prisma.$disconnect();
});
