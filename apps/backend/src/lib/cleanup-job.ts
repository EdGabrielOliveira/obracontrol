import { env } from "../env";
import { apiKeyService } from "./api-key.service";
import { reportException } from "./error-reporter";
import { importStorage } from "./import-storage";
import { logger } from "./logger";
import { prisma } from "./prisma";

function errorType(error: unknown): string {
	return error instanceof Error ? error.name : typeof error;
}

export interface CleanupResult {
	apiKeys: number;
	sessions: number;
	verifications: number;
	auditLogs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function cleanupExpiredImportBatches(now: Date): Promise<number> {
	// Keep this optional for lightweight unit-test Prisma doubles and for
	// deployments that predate the staging tables.
	const importBatch = (
		prisma as unknown as {
			importBatch?: {
				findMany: (
					args: unknown,
				) => Promise<Array<{ id: string; storageKey: string }>>;
				deleteMany: (args: unknown) => Promise<{ count: number }>;
			};
		}
	).importBatch;
	if (!importBatch) return 0;

	const expired = await importBatch.findMany({
		where: { expiresAt: { lt: now } },
		select: { id: true, storageKey: true },
	});
	if (expired.length === 0) return 0;

	const removableIds: string[] = [];
	for (const batch of expired) {
		try {
			await importStorage.remove(batch.storageKey);
			removableIds.push(batch.id);
		} catch (error) {
			logger.error("cleanup.import_batches.storage_failed", {
				errorType: errorType(error),
			});
			reportException(error);
		}
	}
	if (removableIds.length === 0) return 0;

	const deleted = await importBatch.deleteMany({
		where: { id: { in: removableIds } },
	});
	return deleted.count;
}

export async function runCleanup(): Promise<CleanupResult> {
	const auditCutoff = new Date(
		Date.now() - env.AUDIT_LOG_RETENTION_DAYS * DAY_MS,
	);
	const now = new Date();

	const result: CleanupResult = {
		apiKeys: 0,
		sessions: 0,
		verifications: 0,
		auditLogs: 0,
	};

	try {
		result.apiKeys = await apiKeyService.deleteExpired();
		logger.info("cleanup.api_keys", { deleted: result.apiKeys });
	} catch (error) {
		logger.error("cleanup.api_keys.failed", { errorType: errorType(error) });
		reportException(error);
	}

	try {
		const deleted = await cleanupExpiredImportBatches(now);
		logger.info("cleanup.import_batches", { deleted });
	} catch (error) {
		logger.error("cleanup.import_batches.failed", {
			errorType: errorType(error),
		});
		reportException(error);
	}

	try {
		const deleted = await prisma.session.deleteMany({
			where: { expiresAt: { lt: now } },
		});
		result.sessions = deleted.count;
		logger.info("cleanup.sessions", { deleted: result.sessions });
	} catch (error) {
		logger.error("cleanup.sessions.failed", { errorType: errorType(error) });
		reportException(error);
	}

	try {
		const deleted = await prisma.verification.deleteMany({
			where: { expiresAt: { lt: now } },
		});
		result.verifications = deleted.count;
		logger.info("cleanup.verifications", { deleted: result.verifications });
	} catch (error) {
		logger.error("cleanup.verifications.failed", {
			errorType: errorType(error),
		});
		reportException(error);
	}

	try {
		const deleted = await prisma.auditLog.deleteMany({
			where: { createdAt: { lt: auditCutoff } },
		});
		result.auditLogs = deleted.count;
		logger.info("cleanup.audit_logs", {
			deleted: result.auditLogs,
			retentionDays: env.AUDIT_LOG_RETENTION_DAYS,
		});
	} catch (error) {
		logger.error("cleanup.audit_logs.failed", {
			errorType: errorType(error),
		});
		reportException(error);
	}

	return result;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startCleanupJob(
	intervalMs: number = 24 * 60 * 60 * 1000,
): void {
	if (timer !== null) return;

	void runCleanup();

	timer = setInterval(() => {
		if (running) return;
		running = true;
		void runCleanup().finally(() => {
			running = false;
		});
	}, intervalMs);
}
