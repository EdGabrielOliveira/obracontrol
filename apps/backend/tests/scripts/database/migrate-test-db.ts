import { spawnSync } from "node:child_process";
import { readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveTestDatabaseUrl } from "../../support/test-database-guard";

const resolved = resolveTestDatabaseUrl();

if (!resolved.ok) {
	console.error(`Guard de banco de teste: ${resolved.reason}`);
	process.exit(1);
}

const databasePath = resolve(
	process.cwd(),
	resolved.url.slice("file:".length).split("?")[0],
);

await unlink(databasePath).catch((error: NodeJS.ErrnoException) => {
	if (error.code !== "ENOENT") throw error;
});

const migrationsDirectory = resolve(process.cwd(), "prisma/migrations");
const migrations = (await readdir(migrationsDirectory))
	.filter((file) => file.endsWith(".sql"))
	.sort();

console.log(
	`Aplicando ${migrations.length} migrations SQLite no banco de teste: ${resolved.url}`,
);

for (const migration of migrations) {
	console.log(`  - ${migration}`);
	const result = spawnSync(
		"bun",
		[
			"x",
			"prisma",
			"db",
			"execute",
			"--url",
			resolved.url,
			"--file",
			join(migrationsDirectory, migration),
		],
		{
			env: { ...process.env, DATABASE_URL: resolved.url },
			stdio: "inherit",
		},
	);
	if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
