import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const MIGRATIONS_TABLE = "_obracontrol_migrations";

type SchemaRow = {
	type: string;
	name: string;
	tableName: string;
	sql: string | null;
};

type AppliedMigration = {
	name: string;
	checksum: string;
};

function normalizeSql(sql: string | null): string {
	return (sql ?? "").replace(/\s+/g, " ").trim();
}

function schemaRows(database: Database): SchemaRow[] {
	return database
		.query<SchemaRow, []>(
			`SELECT type, name, tbl_name AS tableName, sql
			 FROM sqlite_master
			 WHERE name NOT LIKE 'sqlite_%'
			   AND name != '_obracontrol_migrations'
			 ORDER BY type, name`,
		)
		.all()
		.map((row) => ({ ...row, sql: normalizeSql(row.sql) }));
}

export function databaseSchemaFingerprint(database: Database): string {
	return JSON.stringify(schemaRows(database));
}

function checksum(contents: string): string {
	return createHash("sha256").update(contents).digest("hex");
}

function ensureMigrationsTable(database: Database): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
			"name" TEXT NOT NULL PRIMARY KEY,
			"checksum" TEXT NOT NULL,
			"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);
}

async function migrationFiles(directory: string): Promise<string[]> {
	return (await readdir(directory))
		.filter((file) => file.endsWith(".sql"))
		.sort()
		.map((file) => resolve(directory, file));
}

export async function applySqliteMigrations(options: {
	databasePath: string;
	templatePath: string;
	migrationsDirectory: string;
}): Promise<{ baselineCreated: boolean; applied: string[] }> {
	const database = new Database(options.databasePath);
	const template = new Database(options.templatePath, { readonly: true });

	try {
		const files = await migrationFiles(options.migrationsDirectory);
		const hadMigrationsTable = database
			.query<{ count: number }, []>(
				"SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = '_obracontrol_migrations'",
			)
			.get()?.count;

		if (!hadMigrationsTable) {
			if (
				databaseSchemaFingerprint(database) !==
				databaseSchemaFingerprint(template)
			) {
				throw new Error(
					"Banco SQLite sem histórico de migrations e com schema divergente. Restaure um backup compatível ou execute uma migração manual antes do deploy.",
				);
			}

			ensureMigrationsTable(database);
			const insert = database.query<never, [string, string]>(
				`INSERT INTO "${MIGRATIONS_TABLE}" (name, checksum) VALUES (?, ?)`,
			);
			const createBaseline = database.transaction(
				(records: Array<{ name: string; checksum: string }>) => {
					for (const record of records)
						insert.run(record.name, record.checksum);
				},
			);
			const records = await Promise.all(
				files.map(async (file) => ({
					name: basename(file),
					checksum: checksum(await readFile(file, "utf8")),
				})),
			);
			createBaseline(records);
			return { baselineCreated: true, applied: [] };
		}

		ensureMigrationsTable(database);
		const appliedRows = database
			.query<AppliedMigration, []>(
				`SELECT name, checksum FROM "${MIGRATIONS_TABLE}" ORDER BY name`,
			)
			.all();
		const appliedByName = new Map(
			appliedRows.map((migration) => [migration.name, migration.checksum]),
		);
		const newlyApplied: string[] = [];

		for (const file of files) {
			const name = basename(file);
			const sql = await readFile(file, "utf8");
			const fileChecksum = checksum(sql);
			const appliedChecksum = appliedByName.get(name);

			if (appliedChecksum) {
				if (appliedChecksum !== fileChecksum) {
					throw new Error(`Migration aplicada foi alterada: ${name}`);
				}
				continue;
			}

			const apply = database.transaction(() => {
				database.exec(sql);
				database
					.query<never, [string, string]>(
						`INSERT INTO "${MIGRATIONS_TABLE}" (name, checksum) VALUES (?, ?)`,
					)
					.run(name, fileChecksum);
			});
			apply();
			newlyApplied.push(name);
		}

		return { baselineCreated: false, applied: newlyApplied };
	} finally {
		template.close();
		database.close();
	}
}
