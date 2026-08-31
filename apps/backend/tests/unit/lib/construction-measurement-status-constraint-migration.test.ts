import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type StatusColumn = {
	name: string;
	notnull: number;
	dflt_value: string | null;
};
type StatusRow = { id: string; status: string };

describe("0010_finalize_construction_measurement_status migration", () => {
	test("preserves rows while enforcing the Prisma status contract", async () => {
		const database = new Database(":memory:");
		try {
			database.exec(`
				CREATE TABLE "ConstructionMeasurement" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"ownerId" TEXT NOT NULL,
					"workId" TEXT NOT NULL,
					"importId" TEXT,
					"budgetItemId" TEXT NOT NULL,
					"rowNumber" INTEGER,
					"index" TEXT NOT NULL,
					"title" TEXT,
					"measurementDate" DATETIME,
					"measuredPercentageAccumulated" DECIMAL,
					"measuredQuantityAccumulated" DECIMAL,
					"measuredValue" DECIMAL,
					"status" TEXT,
					"notes" TEXT,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL
				);
				INSERT INTO "ConstructionMeasurement" (
					"id", "ownerId", "workId", "budgetItemId", "index", "status", "updatedAt"
				) VALUES
					('legacy-null', 'owner-1', 'work-1', 'item-1', '1', NULL, CURRENT_TIMESTAMP),
					('legacy-accepted', 'owner-1', 'work-1', 'item-1', '2', 'ACEITO', CURRENT_TIMESTAMP);
			`);

			const migration = await readFile(
				resolve(
					import.meta.dir,
					"../../../prisma/migrations/0010_finalize_construction_measurement_status.sql",
				),
				"utf8",
			);
			database.exec(migration);

			expect(
				database
					.query<StatusRow, []>(
						'SELECT "id", "status" FROM "ConstructionMeasurement" ORDER BY "id"',
					)
					.all(),
			).toEqual([
				{ id: "legacy-accepted", status: "ACEITO" },
				{ id: "legacy-null", status: "ACEITO" },
			]);
			const statusColumn = database
				.query<StatusColumn, []>('PRAGMA table_info("ConstructionMeasurement")')
				.all()
				.find((column) => column.name === "status");
			expect(statusColumn?.notnull).toBe(1);
			expect(statusColumn?.dflt_value).toBe("'RASCUNHO'");
			expect(() =>
				database
					.query(`
					INSERT INTO "ConstructionMeasurement" (
						"id", "ownerId", "workId", "budgetItemId", "index", "status", "updatedAt"
					) VALUES ('invalid-null', 'owner-1', 'work-1', 'item-1', '3', NULL, CURRENT_TIMESTAMP);
				`)
					.run(),
			).toThrow("NOT NULL constraint failed");
		} finally {
			database.close();
		}
	});
});

describe("0011_normalize_imported_measurement_status migration", () => {
	test("normalizes legacy approved imports without changing other statuses", async () => {
		const database = new Database(":memory:");
		try {
			database.exec(`
				CREATE TABLE "ConstructionMeasurement" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"status" TEXT NOT NULL
				);
				INSERT INTO "ConstructionMeasurement" ("id", "status") VALUES
					('approved', 'APROVADA'),
					('accepted', 'ACEITO'),
					('draft', 'RASCUNHO'),
					('rejected', 'RECUSADO');
			`);

			const migration = await readFile(
				resolve(
					import.meta.dir,
					"../../../prisma/migrations/0011_normalize_imported_measurement_status.sql",
				),
				"utf8",
			);
			database.exec(migration);
			database.exec(migration);

			expect(
				database
					.query<StatusRow, []>(
						'SELECT "id", "status" FROM "ConstructionMeasurement" ORDER BY "id"',
					)
					.all(),
			).toEqual([
				{ id: "accepted", status: "ACEITO" },
				{ id: "approved", status: "ACEITO" },
				{ id: "draft", status: "RASCUNHO" },
				{ id: "rejected", status: "RECUSADO" },
			]);
		} finally {
			database.close();
		}
	});
});
