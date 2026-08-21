import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySqliteMigrations } from "../../../src/lib/sqlite-migrations";

const directories: string[] = [];

async function fixture() {
	const directory = await mkdtemp(join(tmpdir(), "obracontrol-migrations-"));
	directories.push(directory);
	const databasePath = join(directory, "database.db");
	const templatePath = join(directory, "template.db");
	const migrationsDirectory = join(directory, "migrations");
	await mkdir(migrationsDirectory);
	for (const path of [databasePath, templatePath]) {
		const database = new Database(path);
		database.exec('CREATE TABLE "Example" ("id" TEXT PRIMARY KEY)');
		database.close();
	}
	await writeFile(
		join(migrationsDirectory, "0001_init.sql"),
		'CREATE TABLE "Example" ("id" TEXT PRIMARY KEY);',
	);
	return { databasePath, templatePath, migrationsDirectory };
}

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("applySqliteMigrations", () => {
	test("creates a checked baseline for an existing matching schema", async () => {
		const paths = await fixture();
		const result = await applySqliteMigrations(paths);
		expect(result).toEqual({ baselineCreated: true, applied: [] });

		const database = new Database(paths.databasePath, { readonly: true });
		const count = database
			.query<{ count: number }, []>(
				'SELECT COUNT(*) AS count FROM "_obracontrol_migrations"',
			)
			.get()?.count;
		database.close();
		expect(count).toBe(1);
	});

	test("baselines a database with an empty migration history", async () => {
		const paths = await fixture();
		const database = new Database(paths.databasePath);
		database.exec(`
			CREATE TABLE "_obracontrol_migrations" (
				"name" TEXT NOT NULL PRIMARY KEY,
				"checksum" TEXT NOT NULL,
				"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`);
		database.close();

		expect(await applySqliteMigrations(paths)).toEqual({
			baselineCreated: true,
			applied: [],
		});
	});

	test("applies a pending migration once", async () => {
		const paths = await fixture();
		await applySqliteMigrations(paths);
		await writeFile(
			join(paths.migrationsDirectory, "0002_name.sql"),
			'ALTER TABLE "Example" ADD COLUMN "name" TEXT;',
		);

		expect(await applySqliteMigrations(paths)).toEqual({
			baselineCreated: false,
			applied: ["0002_name.sql"],
		});
		expect(await applySqliteMigrations(paths)).toEqual({
			baselineCreated: false,
			applied: [],
		});
	});

	test("rejects an untracked divergent database", async () => {
		const paths = await fixture();
		const database = new Database(paths.databasePath);
		database.exec('ALTER TABLE "Example" ADD COLUMN "unexpected" TEXT');
		database.close();

		await expect(applySqliteMigrations(paths)).rejects.toThrow(
			"schema divergente",
		);
	});
});
