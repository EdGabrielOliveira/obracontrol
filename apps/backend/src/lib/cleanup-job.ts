import { env } from "../env";
import { apiKeyService } from "./api-key.service";
import { logger } from "./logger";
import { prisma } from "./prisma";

export interface CleanupResult {
	apiKeys: number;
	sessions: number;
	verifications: number;
	auditLogs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
		logger.error("cleanup.api_keys.failed", { error: String(error) });
	}

	try {
		const deleted = await prisma.session.deleteMany({
			where: { expiresAt: { lt: now } },
		});
		result.sessions = deleted.count;
		logger.info("cleanup.sessions", { deleted: result.sessions });
	} catch (error) {
		logger.error("cleanup.sessions.failed", { error: String(error) });
	}

	try {
		const deleted = await prisma.verification.deleteMany({
			where: { expiresAt: { lt: now } },
		});
		result.verifications = deleted.count;
		logger.info("cleanup.verifications", { deleted: result.verifications });
	} catch (error) {
		logger.error("cleanup.verifications.failed", { error: String(error) });
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
		logger.error("cleanup.audit_logs.failed", { error: String(error) });
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
