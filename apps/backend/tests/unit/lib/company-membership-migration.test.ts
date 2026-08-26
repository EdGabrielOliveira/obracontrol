import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type CountRow = { count: number };
type LegacyUserRow = { id: string; role: string };

describe("0008_company_membership migration", () => {
	test("preserves legacy users and grants without promoting organization access", async () => {
		const database = new Database(":memory:");
		try {
			database.exec(`
				CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "role" TEXT NOT NULL);
				CREATE TABLE "Company" ("id" TEXT NOT NULL PRIMARY KEY);
				CREATE TABLE "Organization" ("id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT);
				CREATE TABLE "OrganizationMembership" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"organizationId" TEXT NOT NULL,
					"userId" TEXT NOT NULL,
					"role" TEXT NOT NULL
				);
				INSERT INTO "User" ("id", "role") VALUES ('legacy-operator', 'OPERADOR');
				INSERT INTO "Company" ("id") VALUES ('company-1');
				INSERT INTO "Organization" ("id", "companyId") VALUES ('organization-1', 'company-1');
				INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role")
				VALUES ('org-grant-1', 'organization-1', 'legacy-operator', 'SUPERVISOR');
			`);

			const migration = await readFile(
				resolve(
					import.meta.dir,
					"../../../prisma/migrations/0008_company_membership.sql",
				),
				"utf8",
			);
			database.exec(migration);

			expect(
				database
					.query<LegacyUserRow, []>(
						'SELECT "id", "role" FROM "User" WHERE "id" = \'legacy-operator\'',
					)
					.get(),
			).toEqual({ id: "legacy-operator", role: "OPERADOR" });
			expect(
				database
					.query<CountRow, []>(
						'SELECT COUNT(*) AS count FROM "OrganizationMembership" WHERE "userId" = \'legacy-operator\'',
					)
					.get()?.count,
			).toBe(1);
			expect(
				database
					.query<CountRow, []>(
						'SELECT COUNT(*) AS count FROM "CompanyMembership" WHERE "userId" = \'legacy-operator\'',
					)
					.get()?.count,
			).toBe(0);
		} finally {
			database.close();
		}
	});
});
