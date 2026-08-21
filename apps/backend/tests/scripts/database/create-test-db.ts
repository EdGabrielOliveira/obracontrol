import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "file:./prisma/test.db";

if (!databaseUrl.startsWith("file:")) {
	throw new Error("TEST_DATABASE_URL deve usar o protocolo file: para SQLite.");
}

const databasePath = databaseUrl.slice("file:".length).split("?")[0];
await mkdir(dirname(databasePath), { recursive: true });
console.log(`Banco SQLite de teste pronto: ${databaseUrl}`);
