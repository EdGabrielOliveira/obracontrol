import { beforeEach, describe, expect, it, mock } from "bun:test";

const deleteExpired = mock(async () => 4);
const sessionDeleteMany = mock(async () => ({ count: 2 }));
const verificationDeleteMany = mock(async () => ({ count: 1 }));
const auditLogDeleteMany = mock(async (_args: unknown) => ({ count: 9 }));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		session: { deleteMany: sessionDeleteMany },
		verification: { deleteMany: verificationDeleteMany },
		auditLog: { deleteMany: auditLogDeleteMany },
	},
}));

mock.module("../../../src/lib/api-key.service", () => ({
	apiKeyService: { deleteExpired },
}));

const { runCleanup } = await import("../../../src/lib/cleanup-job");

describe("cleanup job", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("deletes expired api keys, sessions, verifications and old audit logs", async () => {
		const result = await runCleanup();

		expect(deleteExpired).toHaveBeenCalledTimes(1);
		expect(sessionDeleteMany).toHaveBeenCalledWith({
			where: { expiresAt: { lt: expect.any(Date) } },
		});
		expect(verificationDeleteMany).toHaveBeenCalledWith({
			where: { expiresAt: { lt: expect.any(Date) } },
		});
		expect(auditLogDeleteMany).toHaveBeenCalledWith({
			where: { createdAt: { lt: expect.any(Date) } },
		});
		expect(result).toEqual({
			apiKeys: 4,
			sessions: 2,
			verifications: 1,
			auditLogs: 9,
		});
	});

	it("uses the retention window based on AUDIT_LOG_RETENTION_DAYS default (180 days)", async () => {
		await runCleanup();

		const call = auditLogDeleteMany.mock.calls[0][0] as {
			where: { createdAt: { lt: Date } };
		};
		const expectedCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
		expect(
			Math.abs(call.where.createdAt.lt.getTime() - expectedCutoff),
		).toBeLessThan(5000);
	});

	it("continues with the remaining steps when one cleanup step fails", async () => {
		sessionDeleteMany.mockRejectedValueOnce(new Error("db down"));

		const result = await runCleanup();

		expect(result.apiKeys).toBe(4);
		expect(result.sessions).toBe(0);
		expect(result.verifications).toBe(1);
		expect(result.auditLogs).toBe(9);
	});
});
