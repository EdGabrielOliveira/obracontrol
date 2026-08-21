import { expect } from "bun:test";

export const TEST_OWNER = "e2e-owner-1";
export const TEST_CC_ID = "e2e-cc-test";
export const TEST_ORG_ID = "e2e-org-test";
export const TEST_WORK_ID = "e2e-work-1";
export const TEST_IMPORT_ID = "e2e-import-1";
export const TEST_BUDGET_ITEM_ID = "e2e-budget-item-1";

export function makeTestWork(overrides: Record<string, unknown> = {}) {
	return {
		id: TEST_WORK_ID,
		ownerId: TEST_OWNER,
		code: "E2E-001",
		name: "Obra E2E Teste",
		costCenterId: TEST_CC_ID,
		clientName: "Cliente Teste",
		baseDate: "2026-01-15T00:00:00.000Z",
		plannedStart: "2026-01-01T00:00:00.000Z",
		plannedEnd: "2026-12-31T00:00:00.000Z",
		activeImportId: TEST_IMPORT_ID,
		areaM2: 500,
		operationalStatus: "IN_PROGRESS",
		responsibleName: "Engenheiro Teste",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

export function makeTestBudgetItem(overrides: Record<string, unknown> = {}) {
	return {
		id: TEST_BUDGET_ITEM_ID,
		ownerId: TEST_OWNER,
		workId: TEST_WORK_ID,
		importId: TEST_IMPORT_ID,
		parentId: null,
		index: "1.1",
		type: "ITEM",
		description: "Item de Orcamento E2E",
		unit: "m2",
		quantity: 100,
		totalCost: 50000,
		completionPercentage: 0.25,
		computedStatus: "IN_PROGRESS",
		sortOrder: 1,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

export function assertJsonResponse(response: Response, expectedStatus: number) {
	expect(response.status).toBe(expectedStatus);
	expect(response.headers.get("content-type")).toContain("application/json");
}

export function assertNoContentResponse(response: Response) {
	expect(response.status).toBe(204);
}
