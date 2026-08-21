import type { PrismaClient } from "../../generated/prisma/client";

type DatabaseMode = "unconfigured" | "sqlite-local";

let configuredClient: PrismaClient | undefined;
let configuredDatabaseMode: DatabaseMode = "unconfigured";
let transactionWarningLogged = false;

function getActiveClient(): PrismaClient | undefined {
	return configuredClient;
}

export function configureLocalPrisma(client: unknown): void {
	configuredClient = client as PrismaClient;
	configuredDatabaseMode = "sqlite-local";
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
			if (!transactionWarningLogged) {
				transactionWarningLogged = true;
				console.warn(
					"database.transaction_compatibility: Prisma transaction callbacks are sequential on SQLite; use the libsql adapter transaction for atomic multi-statement writes.",
				);
			}
			return async (operation: unknown): Promise<unknown> => {
				if (Array.isArray(operation)) {
					const results: unknown[] = [];
					for (const query of operation) results.push(await query);
					return results;
				}
				if (typeof operation !== "function") {
					throw new TypeError(
						"A operacao de transacao deve ser uma funcao ou uma lista de queries",
					);
				}
				return operation(activeClient);
			};
		}
		const value = Reflect.get(activeClient, property, activeClient);
		return typeof value === "function" ? value.bind(activeClient) : value;
	},
}) as PrismaClient;
