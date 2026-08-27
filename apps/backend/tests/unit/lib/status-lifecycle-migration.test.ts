import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type StatusRow = { id: string; status: string | null };

describe("0009_status_lifecycle migration", () => {
	test("preserves legacy measurements in accepted calculations", async () => {
		const database = new Database(":memory:");
		try {
			database.exec(`
				CREATE TABLE "ConstructionWork" ("id" TEXT NOT NULL PRIMARY KEY);
				CREATE TABLE "Contract" ("id" TEXT NOT NULL PRIMARY KEY);
				CREATE TABLE "WorkMeasurement" ("id" TEXT NOT NULL PRIMARY KEY);
				CREATE TABLE "ContractMeasurement" ("id" TEXT NOT NULL PRIMARY KEY);
				CREATE TABLE "ConstructionMeasurement" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"status" TEXT
				);
				INSERT INTO "WorkMeasurement" ("id") VALUES ('work-legacy');
				INSERT INTO "ContractMeasurement" ("id") VALUES ('contract-legacy');
				INSERT INTO "ConstructionMeasurement" ("id", "status")
				VALUES ('import-legacy', NULL), ('already-reviewed', 'RECUSADO');
			`);

			const migration = await readFile(
				resolve(
					import.meta.dir,
					"../../../prisma/migrations/0009_status_lifecycle.sql",
				),
				"utf8",
			);
			database.exec(migration);

			expect(
				database
					.query<StatusRow, []>('SELECT "id", "status" FROM "WorkMeasurement"')
					.get(),
			).toEqual({ id: "work-legacy", status: "ACEITO" });
			expect(
				database
					.query<StatusRow, []>(
						'SELECT "id", "status" FROM "ContractMeasurement"',
					)
					.get(),
			).toEqual({ id: "contract-legacy", status: "ACEITO" });
			expect(
				database
					.query<StatusRow, []>(
						'SELECT "id", "status" FROM "ConstructionMeasurement" ORDER BY "id"',
					)
					.all(),
			).toEqual([
				{ id: "already-reviewed", status: "RECUSADO" },
				{ id: "import-legacy", status: "ACEITO" },
			]);
		} finally {
			database.close();
		}
	});
});
