import { Prisma } from "../../generated/prisma/client";
import { prisma } from "./prisma";

export type SerializableRetryOptions = {
	attempts?: number;

	timeoutMs?: number;
};

export const serializableRetryStats = {
	attempts: 0,
	conflicts: 0,
};

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const BASE_BACKOFF_MS = 50;

function isRetryableConflict(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const candidate = error as Error & { code?: unknown };
	if (candidate.code === "P2034") return true;

	const message = candidate.message.toLowerCase();
	return message.includes("40001") || message.includes("serialization");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withSerializableRetry<T>(
	operation: (tx: Prisma.TransactionClient) => Promise<T>,
	options?: SerializableRetryOptions,
): Promise<T> {
	const attempts = Math.max(1, options?.attempts ?? DEFAULT_ATTEMPTS);
	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		serializableRetryStats.attempts++;
		try {
			return await prisma.$transaction(operation, {
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
				timeout: timeoutMs,
			});
		} catch (error) {
			lastError = error;
			if (!isRetryableConflict(error) || attempt === attempts) {
				throw error;
			}
			serializableRetryStats.conflicts++;
			await sleep(BASE_BACKOFF_MS * attempt);
		}
	}

	throw lastError;
}
