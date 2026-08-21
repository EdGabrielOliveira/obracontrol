import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { applySqliteMigrations } from "../src/lib/sqlite-migrations";

function databasePathFromUrl(databaseUrl: string): string {
	if (!databaseUrl.startsWith("file:")) {
		throw new Error("DATABASE_URL do container deve usar o protocolo file:.");
	}
	const rawPath = databaseUrl.slice("file:".length).split("?")[0];
	if (!rawPath) throw new Error("DATABASE_URL não contém um caminho SQLite.");
	return resolve(process.cwd(), rawPath);
}

const databasePath = databasePathFromUrl(
	process.env.DATABASE_URL ?? "file:/data/obracontrol.db",
);
const templatePath = process.env.SQLITE_TEMPLATE_PATH ?? "/app/schema.db";
const migrationsDirectory =
	process.env.SQLITE_MIGRATIONS_DIR ?? "/app/prisma/migrations";

await mkdir(dirname(databasePath), { recursive: true });
const exists = await stat(databasePath)
	.then((entry) => entry.isFile() && entry.size > 0)
	.catch(() => false);

if (!exists) {
	await copyFile(templatePath, databasePath);
	console.log("database.initialized", { databasePath });
}

const result = await applySqliteMigrations({
	databasePath,
	templatePath,
	migrationsDirectory,
});

console.log("database.migrations_ready", result);
