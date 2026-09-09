import type { PrismaClient } from "../../generated/prisma/client";

type DatabaseMode = "unconfigured" | "postgresql";

let configuredClient: PrismaClient | undefined;
let configuredDatabaseMode: DatabaseMode = "unconfigured";

function getActiveClient(): PrismaClient | undefined {
	return configuredClient;
}

export function configureLocalPrisma(client: unknown): void {
	configuredClient = client as PrismaClient;
	configuredDatabaseMode = "postgresql";
}

export function getDatabaseMode(): DatabaseMode {
	return configuredDatabaseMode;
}

export const prisma = new Proxy(Object.create(null) as PrismaClient, {
	get(_target, property) {
		const activeClient = getActiveClient();
		if (!activeClient) {
			throw new Error(
				"Database client is not configured. Call configureLocalPrisma before using Prisma.",
			);
		}
		if (property === "$transaction") {
			// Preserve Prisma's real transaction implementation. The previous
			// compatibility wrapper executed callbacks against the root client,
			// making multi-write operations non-atomic.
			return activeClient.$transaction.bind(activeClient);
		}
		const value = Reflect.get(activeClient, property, activeClient);
		return typeof value === "function" ? value.bind(activeClient) : value;
	},
}) as PrismaClient;
