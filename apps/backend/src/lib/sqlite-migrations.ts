import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const MIGRATIONS_TABLE = "_obracontrol_migrations";

// These checksums belong to migrations that were applied in production before
// their committed files were amended. Keep this list deliberately narrow: a
// checksum mismatch remains an error for every other migration.
const acceptedLegacyChecksums: Readonly<Record<string, readonly string[]>> = {
	"0004_repair_credential_account_ids.sql": [
		"72fe8c7b29808c7aea4e376e62ac529a8e5ef30213741fa99f30bed22d6f50e2",
	],
	"0005_add_credential_account_issuer.sql": [
		"951508b164a06133861f963fa581cbc59da23f537937c5ddd2fb8d9bd7e1f8e7",
	],
	"0008_company_membership.sql": [
		"90142f376c2ec97fab3e1fd6b4c26b0c1a8629a30a10494b43dce195953db418",
	],
};

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

function isAcceptedChecksum(name: string, checksum: string): boolean {
	return acceptedLegacyChecksums[name]?.includes(checksum) ?? false;
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
		ensureMigrationsTable(database);
		const appliedRows = database
			.query<AppliedMigration, []>(
				`SELECT name, checksum FROM "${MIGRATIONS_TABLE}" ORDER BY name`,
			)
			.all();

		// A previous bootstrap may have created the history table before failing.
		// An empty history is still an unversioned database, so baseline it after
		// validating that its schema already matches the image template.
		if (appliedRows.length === 0) {
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
				if (
					appliedChecksum !== fileChecksum &&
					!isAcceptedChecksum(name, appliedChecksum)
				) {
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
