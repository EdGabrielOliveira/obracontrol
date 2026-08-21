import { env } from "../src/env";
import { prisma } from "../src/lib/prisma";

export function assertResetConfirmed(value: string | undefined): void {
	if (value !== "yes") {
		throw new Error(
			"Reset abortado: defina RESET_CONFIRM=yes para confirmar a destruicao dos dados.",
		);
	}
}

export async function truncateAllTables(): Promise<void> {
	const rows: Array<{ name: string }> = await prisma.$queryRaw`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
	`;
	for (const row of rows) {
		if (row.name === "_prisma_migrations") continue;
		await prisma.$executeRawUnsafe(
			`DELETE FROM "${row.name.replaceAll('"', '""')}"`,
		);
	}
}

async function main(): Promise<void> {
	assertResetConfirmed(env.RESET_CONFIRM);
	console.log("Reset destrutivo confirmado. Truncando tabelas publicas...");
	await truncateAllTables();
	console.log("Banco limpo. Executando seed canonico...");
	const { runSeed } = await import("../prisma/seed");
	await runSeed();
	console.log("Reset e seed concluidos.");
}

if (import.meta.main) {
	await main();
	await prisma.$disconnect();
}
