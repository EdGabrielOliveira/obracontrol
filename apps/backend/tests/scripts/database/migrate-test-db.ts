import { spawnSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "../../support/test-database-guard";

const resolved = resolveTestDatabaseUrl();

if (!resolved.ok) {
	console.error(`Guard de banco de teste: ${resolved.reason}`);
	process.exit(1);
}

console.log(
	`Aplicando migrations PostgreSQL no banco de teste: ${resolved.url}`,
);
const result = spawnSync("bun", ["prisma", "migrate", "deploy"], {
	env: { ...process.env, DATABASE_URL: resolved.url },
	stdio: "inherit",
});
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
