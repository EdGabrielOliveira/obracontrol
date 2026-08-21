import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "../../../../src/lib/resource-scope";

const policyFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		approvalPolicy: { findMany: policyFindMany },
	},
}));

async function importService() {
	return import("../../../../src/modules/governance/approval-policy.service");
}

function makeScope(overrides: Partial<ScopeContext> = {}): ScopeContext {
	return {
		actorId: "user-1",
		resourceType: "WORK",
		resourceOwnerId: "owner-1",
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		role: "GERENTE",
		canRead: true,
		canWrite: true,
		canApprove: false,
		canAdmin: false,
		...overrides,
	};
}

function makePolicy(overrides: Record<string, unknown> = {}) {
	return {
		id: "policy-1",
		scopeType: "work",
		scopeId: "work-1",
		subjectType: "ROLE",
		subjectId: "GERENTE",
		action: "PAYMENT_CONFIRM",
		mode: "MANUAL",
		approverRole: "GERENTE",
		valueLimit: null,
		active: true,
		...overrides,
	};
}

describe("resolveApprovalPolicy", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		policyFindMany.mockResolvedValue([]);
	});

	it("usuario no escopo exato vence papel ancestral", async () => {
		policyFindMany.mockResolvedValue([
			makePolicy({
				id: "user-exact",
				scopeType: "work",
				scopeId: "work-1",
				subjectType: "USER",
				subjectId: "user-1",
				mode: "AUTONOMOUS",
			}),
			makePolicy({
				id: "role-org",
				scopeType: "organization",
				scopeId: "org-1",
				subjectType: "ROLE",
				subjectId: "GERENTE",
				mode: "MANUAL",
			}),
		]);
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"PAYMENT_CONFIRM",
		);

		expect(resolved.policyId).toBe("user-exact");
		expect(resolved.mode).toBe("AUTONOMOUS");
	});

	it("usuario ancestral vence papel no escopo exato", async () => {
		policyFindMany.mockResolvedValue([
			makePolicy({
				id: "user-org",
				scopeType: "organization",
				scopeId: "org-1",
				subjectType: "USER",
				subjectId: "user-1",
				mode: "MANUAL",
				approverRole: "GERENTE",
			}),
			makePolicy({
				id: "role-work",
				scopeType: "work",
				scopeId: "work-1",
				subjectType: "ROLE",
				subjectId: "GERENTE",
				mode: "AUTONOMOUS",
			}),
		]);
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"PAYMENT_CONFIRM",
		);

		expect(resolved.policyId).toBe("user-org");
		expect(resolved.mode).toBe("MANUAL");
	});

	it("papel no escopo exato vence papel ancestral", async () => {
		policyFindMany.mockResolvedValue([
			makePolicy({
				id: "role-work",
				scopeType: "work",
				scopeId: "work-1",
				subjectType: "ROLE",
				subjectId: "GERENTE",
				mode: "AUTONOMOUS",
			}),
			makePolicy({
				id: "role-org",
				scopeType: "organization",
				scopeId: "org-1",
				subjectType: "ROLE",
				subjectId: "GERENTE",
				mode: "MANUAL",
				approverRole: "GERENTE",
			}),
		]);
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"PAYMENT_CONFIRM",
		);

		expect(resolved.policyId).toBe("role-work");
		expect(resolved.mode).toBe("AUTONOMOUS");
	});

	it("papel ancestral aplica quando nao ha politica no escopo exato", async () => {
		policyFindMany.mockResolvedValue([
			makePolicy({
				id: "role-cc",
				scopeType: "costCenter",
				scopeId: "cc-1",
				subjectType: "ROLE",
				subjectId: "GERENTE",
				mode: "MANUAL",
				approverRole: "GERENTE",
			}),
		]);
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"PAYMENT_CONFIRM",
		);

		expect(resolved.policyId).toBe("role-cc");
		expect(resolved.mode).toBe("MANUAL");
		expect(resolved.approverRole).toBe("GERENTE");
	});

	it("sem politica, aplica o padrao da acao (MANUAL para PAYMENT_CONFIRM)", async () => {
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"PAYMENT_CONFIRM",
		);

		expect(resolved.mode).toBe("MANUAL");
		expect(resolved.policyId).toBeNull();
	});

	it("sem politica, acao sem padrao e AUTONOMOUS", async () => {
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"OUTRA_ACAO",
		);

		expect(resolved.mode).toBe("AUTONOMOUS");
	});

	it("filtra politica inativa na query (active: true)", async () => {
		// A query do service exige active: true; o mock devolve vazio
		// simulando o filtro aplicado pelo Prisma.
		policyFindMany.mockResolvedValue([]);
		const { resolveApprovalPolicy } = await importService();

		const resolved = await resolveApprovalPolicy(
			"user-1",
			makeScope(),
			"PAYMENT_CONFIRM",
		);

		expect(resolved.policyId).toBeNull();
		expect(resolved.mode).toBe("MANUAL");
		expect(policyFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ active: true }),
			}),
		);
	});
});
