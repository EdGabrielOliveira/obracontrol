import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Prisma } from "@prisma/client";

const transactionMock = mock<
	(
		operation: (tx: unknown) => Promise<unknown>,
		options?: unknown,
	) => Promise<unknown>
>(async (operation) => operation({}));

const resetRetryStats = mock(async () => {
	const { serializableRetryStats } = await import(
		"../../../src/lib/transaction-retry"
	);
	serializableRetryStats.attempts = 0;
	serializableRetryStats.conflicts = 0;
});

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transactionMock,
	},
}));

function p2034Error(): Error {
	const error = new Error(
		"Transaction failed due to a write conflict or a deadlock",
	);
	(error as Error & { code: string }).code = "P2034";
	return error;
}

function serializationFailureError(): Error {
	return new Error("Database error: 40001: could not serialize access");
}

beforeEach(() => {
	transactionMock.mockReset();
	transactionMock.mockImplementation(async (operation) => operation({}));
});

describe("withSerializableRetry", () => {
	it("retries on P2034 and resolves after the conflict clears", async () => {
		const { withSerializableRetry } = await import(
			"../../../src/lib/transaction-retry"
		);
		transactionMock.mockImplementation(async (operation) => {
			const calls = transactionMock.mock.calls.length;
			if (calls <= 2) throw p2034Error();
			return operation({});
		});

		const result = await withSerializableRetry(
			async (tx: Prisma.TransactionClient) => {
				expect(tx).toBeDefined();
				return "ok";
			},
		);

		expect(result).toBe("ok");
		expect(transactionMock.mock.calls.length).toBe(3);
	});

	it("retries on serialization failure surfaced as unknown error", async () => {
		const { withSerializableRetry } = await import(
			"../../../src/lib/transaction-retry"
		);
		transactionMock.mockImplementation(async (operation) => {
			const calls = transactionMock.mock.calls.length;
			if (calls <= 2) throw serializationFailureError();
			return operation({});
		});

		const result = await withSerializableRetry(async () => "ok");

		expect(result).toBe("ok");
		expect(transactionMock.mock.calls.length).toBe(3);
	});

	it("propagates non-retryable errors immediately without retrying", async () => {
		const { withSerializableRetry } = await import(
			"../../../src/lib/transaction-retry"
		);
		const domainError = new Error("dominio quebrado");
		transactionMock.mockImplementation(async () => {
			throw domainError;
		});

		await expect(withSerializableRetry(async () => "nunca")).rejects.toBe(
			domainError,
		);
		expect(transactionMock.mock.calls.length).toBe(1);
	});

	it("respects the maximum attempts limit and throws the last conflict", async () => {
		const { withSerializableRetry } = await import(
			"../../../src/lib/transaction-retry"
		);
		transactionMock.mockImplementation(async () => {
			throw p2034Error();
		});

		await expect(
			withSerializableRetry(async () => "nunca", { attempts: 2 }),
		).rejects.toMatchObject({ code: "P2034" });
		expect(transactionMock.mock.calls.length).toBe(2);
	});

	it("runs the operation with serializable isolation and a timeout", async () => {
		const { withSerializableRetry } = await import(
			"../../../src/lib/transaction-retry"
		);
		transactionMock.mockImplementation(async (operation) => operation({}));

		await withSerializableRetry(async () => "ok", { timeoutMs: 5_000 });

		const [, options] = transactionMock.mock.calls[0] as unknown as [
			unknown,
			{ isolationLevel?: string; timeout?: number },
		];
		expect(options?.isolationLevel).toBe("Serializable");
		expect(options?.timeout).toBe(5_000);
	});

	it("uses deterministic backoff between attempts (50ms * attempt)", async () => {
		const { withSerializableRetry } = await import(
			"../../../src/lib/transaction-retry"
		);
		transactionMock.mockImplementation(async () => {
			const calls = transactionMock.mock.calls.length;
			if (calls <= 2) throw p2034Error();
			return "ok";
		});

		const startedAt = Date.now();
		await withSerializableRetry(async () => "ok");
		const elapsed = Date.now() - startedAt;

		expect(elapsed).toBeGreaterThanOrEqual(140);
	});

	it("counts attempts and retried conflicts for observability", async () => {
		await resetRetryStats();
		const { withSerializableRetry, serializableRetryStats } = await import(
			"../../../src/lib/transaction-retry"
		);
		transactionMock.mockImplementation(async () => {
			const calls = transactionMock.mock.calls.length;
			if (calls <= 2) throw p2034Error();
			return "ok";
		});

		await withSerializableRetry(async () => "ok");

		expect(serializableRetryStats.attempts).toBe(3);
		expect(serializableRetryStats.conflicts).toBe(2);
	});
});
