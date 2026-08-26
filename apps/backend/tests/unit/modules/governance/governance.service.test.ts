import { describe, expect, it } from "bun:test";
import type { GovernanceRecord } from "@prisma/client";
import {
	type GovernanceAudit,
	type GovernanceRepository,
	GovernanceService,
	normalizeGovernanceRole,
	normalizeMeasurementRole,
} from "../../../../src/modules/governance/governance.service";

function createRepository(initial: GovernanceRecord | null = null) {
	let record = initial;
	const calls = { create: 0, update: 0 };
	const repository: GovernanceRepository = {
		find: async () => record,
		create: async (input) => {
			calls.create += 1;
			record = {
				...input,
				id: "governance-1",
				createdAt: input.changedAt,
				updatedAt: input.changedAt,
			};
			return record;
		},
		update: async (id, input) => {
			calls.update += 1;
			if (!record || record.id !== id) throw new Error("record not found");
			record = { ...record, ...input, updatedAt: input.changedAt };
			return record;
		},
	};
	return { repository, calls, getRecord: () => record };
}

function createAudit() {
	const entries: Array<Record<string, unknown>> = [];
	const audit: GovernanceAudit = {
		log: async (input) => {
			entries.push(input as unknown as Record<string, unknown>);
		},
	};
	return { audit, entries };
}

function createService(
	repository: GovernanceRepository,
	audit: GovernanceAudit,
) {
	return new GovernanceService(repository, audit, async (fn) =>
		fn({} as never),
	);
}

describe("GovernanceService", () => {
	it("allows mutations when the entity is not accepted or locked", async () => {
		const store = createRepository();
		const service = createService(store.repository, createAudit().audit);

		await expect(
			service.assertWritable("owner-1", "BUDGET", "work-1"),
		).resolves.toBeUndefined();
	});

	it("blocks mutations for accepted and locked entities", async () => {
		for (const status of ["ACEITO", "TRAVADO"] as const) {
			const date = new Date("2026-08-01T12:00:00.000Z");
			const store = createRepository({
				id: "governance-1",
				ownerId: "owner-1",
				entityType: "BUDGET",
				entityId: "work-1",
				status,
				version: 2,
				reason: null,
				changedBy: "user-1",
				changedAt: date,
				createdAt: date,
				updatedAt: date,
			});
			const service = createService(store.repository, createAudit().audit);

			await expect(
				service.assertWritable("owner-1", "BUDGET", "work-1"),
			).rejects.toMatchObject({
				code: "GOVERNANCE_MUTATION_BLOCKED",
				status: 423,
			});
		}
	});

	it("creates a versioned record and audit entry on the first transition", async () => {
		const store = createRepository();
		const audit = createAudit();
		const service = createService(store.repository, audit.audit);

		const result = await service.transition({
			ownerId: "owner-1",
			userId: "user-1",
			entityType: "BUDGET",
			entityId: "budget-1",
			toStatus: "EM_REVISAO",
			role: "GERENTE",
		});

		expect(result).toMatchObject({
			status: "EM_REVISAO",
			version: 1,
			changedBy: "user-1",
		});
		expect(store.calls.create).toBe(1);
		expect(audit.entries[0]).toMatchObject({
			entityType: "GOVERNANCE_RECORD",
			previousState: { status: "RASCUNHO", version: 0 },
			newState: { status: "EM_REVISAO", version: 1 },
		});
	});

	it("increments the version and persists the reason when reopening", async () => {
		const changedAt = new Date("2026-08-01T12:00:00.000Z");
		const store = createRepository({
			id: "governance-1",
			ownerId: "owner-1",
			entityType: "BUDGET",
			entityId: "budget-1",
			status: "ACEITO",
			version: 2,
			reason: null,
			changedBy: "user-1",
			changedAt,
			createdAt: changedAt,
			updatedAt: changedAt,
		});
		const audit = createAudit();
		const service = createService(store.repository, audit.audit);

		const result = await service.transition({
			ownerId: "owner-1",
			userId: "user-2",
			entityType: "BUDGET",
			entityId: "budget-1",
			toStatus: "EM_REVISAO",
			role: "GERENTE",
			reason: "Atualizar baseline aprovada",
		});

		expect(result).toMatchObject({
			status: "EM_REVISAO",
			version: 3,
			reason: "Atualizar baseline aprovada",
			changedBy: "user-2",
		});
		expect(store.calls.update).toBe(1);
	});

	it("does not write on an idempotent transition", async () => {
		const store = createRepository();
		const audit = createAudit();
		const service = createService(store.repository, audit.audit);

		const result = await service.transition({
			ownerId: "owner-1",
			userId: "user-1",
			entityType: "BUDGET",
			entityId: "budget-1",
			toStatus: "RASCUNHO",
			role: "GERENTE",
		});

		expect(result).toMatchObject({ status: "RASCUNHO", version: 0 });
		expect(store.calls.create).toBe(0);
		expect(store.calls.update).toBe(0);
		expect(audit.entries).toHaveLength(0);
	});

	it("allows a gerente to reopen a locked record with a reason", async () => {
		const date = new Date("2026-08-01T12:00:00.000Z");
		const store = createRepository({
			id: "governance-1",
			ownerId: "owner-1",
			entityType: "BUDGET",
			entityId: "budget-1",
			status: "TRAVADO",
			version: 4,
			reason: null,
			changedBy: "admin-1",
			changedAt: date,
			createdAt: date,
			updatedAt: date,
		});
		const service = createService(store.repository, createAudit().audit);

		await expect(
			service.transition({
				ownerId: "owner-1",
				userId: "user-1",
				entityType: "BUDGET",
				entityId: "budget-1",
				toStatus: "EM_REVISAO",
				role: "GERENTE",
				reason: "Necessita ajuste",
			}),
		).resolves.toMatchObject({ status: "EM_REVISAO", version: 5 });
	});

	it("maps a concurrent unique violation to 409 without duplicating the decision", async () => {
		const repository: GovernanceRepository = {
			find: async () => null,
			create: async () => {
				throw { code: "P2002", message: "unique constraint" };
			},
			update: async () => {
				throw new Error("should not be called");
			},
		};
		const service = createService(repository, createAudit().audit);

		await expect(
			service.transition({
				ownerId: "owner-1",
				userId: "user-1",
				entityType: "BUDGET",
				entityId: "budget-1",
				toStatus: "EM_REVISAO",
				role: "GERENTE",
			}),
		).rejects.toMatchObject({
			code: "GOVERNANCE_CONFLICT",
			status: 409,
		});
	});

	describe("normalizeGovernanceRole", () => {
		it("rejects legacy roles without a safe compatibility mapping", () => {
			expect(() => normalizeGovernanceRole("APROVADOR")).toThrow();
			expect(() => normalizeGovernanceRole("VISUALIZADOR")).toThrow();
		});

		it("keeps ADMIN, GERENTE, GESTOR and SUPERVISOR", () => {
			expect(normalizeGovernanceRole("ADMIN")).toBe("ADMIN");
			expect(normalizeGovernanceRole("GERENTE")).toBe("GERENTE");
			expect(normalizeGovernanceRole("GESTOR")).toBe("GESTOR");
			expect(normalizeGovernanceRole("SUPERVISOR")).toBe("SUPERVISOR");
		});

		it("rejects unknown or null roles", () => {
			expect(() => normalizeGovernanceRole("UNKNOWN")).toThrow();
			expect(() => normalizeGovernanceRole(null)).toThrow();
			expect(() => normalizeGovernanceRole(undefined)).toThrow();
		});

		it("maps legacy OPERADOR to SUPERVISOR in governance and measurement roles", () => {
			expect(normalizeGovernanceRole("OPERADOR")).toBe("SUPERVISOR");
			expect(normalizeMeasurementRole("OPERADOR")).toBe("SUPERVISOR");
			expect(normalizeMeasurementRole("GESTOR")).toBe("GESTOR");
		});
	});
});
