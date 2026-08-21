import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ?? "file:./prisma/test.db";
const BACKEND_DIR = resolve(import.meta.dir, "../..");

const createDb = spawnSync(
	"bun",
	["tests/scripts/database/create-test-db.ts"],
	{
		stdio: "inherit",
		cwd: BACKEND_DIR,
	},
);
if (createDb.status !== 0) process.exit(createDb.status ?? 1);

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.PORT = process.env.E2E_BACKEND_PORT ?? "7001";
process.env.FRONTEND_ORIGIN = `http://localhost:${process.env.E2E_FRONTEND_PORT ?? "7000"}`;

const migrate = spawnSync(
	"bun",
	["tests/scripts/database/migrate-test-db.ts"],
	{
		stdio: "inherit",
		cwd: BACKEND_DIR,
		env: process.env,
	},
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const { createLocalPrisma } = await import("../../src/lib/prisma-local");
const { configureLocalPrisma } = await import("../../src/lib/prisma");
configureLocalPrisma(createLocalPrisma());
const { resetAndSeedDatabase } = await import("../e2e-db/seed");
await resetAndSeedDatabase();

await import("../../src/index");
