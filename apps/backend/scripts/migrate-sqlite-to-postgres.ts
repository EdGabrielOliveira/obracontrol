import { Database } from "bun:sqlite";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import pg from "pg";

const { Client } = pg;

type SqliteValue = string | number | bigint | Uint8Array | null;
type SqliteRow = Record<string, SqliteValue | undefined>;
type PostgresValue = SqliteValue | boolean | Buffer;

type PostgresColumn = {
	table_name: string;
	column_name: string;
	data_type: string;
	ordinal_position: number;
	is_nullable: "YES" | "NO";
	column_default: string | null;
	is_identity: "YES" | "NO";
};

const SQLITE_PATH = process.env.SQLITE_PATH ?? "/legacy-data/obracontrol.db";
const DATABASE_URL = process.env.DATABASE_URL;
const BATCH_SIZE = 500;

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function normalizeValue(
	value: SqliteValue | undefined,
	column: PostgresColumn,
): PostgresValue {
	if (value === undefined) return null;
	if (column.data_type === "boolean" && typeof value === "number") {
		return value !== 0;
	}
	if (column.data_type === "bytea" && value instanceof Uint8Array) {
		return Buffer.from(value);
	}
	return value;
}

function loadSourceTables(sqlite: Database): string[] {
	return sqlite
		.query<{ name: string }, []>(`
			SELECT name
			FROM sqlite_master
			WHERE type = 'table'
			  AND name NOT LIKE 'sqlite_%'
			  AND name NOT IN ('_obracontrol_migrations', '_prisma_migrations')
			ORDER BY name
		`)
		.all()
		.map((row) => row.name);
}

async function loadTargetSchema(
	client: pg.Client,
): Promise<Map<string, PostgresColumn[]>> {
	const result = await client.query<PostgresColumn>(`
		SELECT table_name, column_name, data_type, ordinal_position,
		       is_nullable, column_default, is_identity
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND table_name <> '_prisma_migrations'
		ORDER BY table_name, ordinal_position
	`);

	const columnsByTable = new Map<string, PostgresColumn[]>();
	for (const column of result.rows) {
		const columns = columnsByTable.get(column.table_name) ?? [];
		columns.push(column);
		columnsByTable.set(column.table_name, columns);
	}
	return columnsByTable;
}

async function assertTargetIsEmpty(
	client: pg.Client,
	tables: Iterable<string>,
): Promise<void> {
	const nonEmptyTables: string[] = [];
	for (const table of tables) {
		const result = await client.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM ${quoteIdentifier(table)}`,
		);
		if (Number(result.rows[0]?.count ?? 0) > 0) nonEmptyTables.push(table);
	}

	if (nonEmptyTables.length > 0) {
		throw new Error(
			`O destino PostgreSQL precisa estar vazio. Existem dados em: ${nonEmptyTables.join(", ")}. ` +
				"Use um banco novo ou remova os dados antes de executar a importacao.",
		);
	}
}

function loadCommonColumns(
	sqlite: Database,
	table: string,
	targetColumns: PostgresColumn[],
): PostgresColumn[] {
	const sourceColumns = new Set(
		sqlite
			.query<{ name: string }, []>(
				`PRAGMA table_info(${quoteIdentifier(table)})`,
			)
			.all()
			.map((column) => column.name),
	);
	const missingRequiredColumns = targetColumns
		.filter(
			(column) =>
				!sourceColumns.has(column.column_name) &&
				column.is_nullable === "NO" &&
				column.column_default === null &&
				column.is_identity === "NO",
		)
		.map((column) => column.column_name);
	if (missingRequiredColumns.length > 0) {
		throw new Error(
			`Tabela ${table} possui colunas obrigatorias ausentes no SQLite: ${missingRequiredColumns.join(", ")}.`,
		);
	}
	return targetColumns.filter((column) =>
		sourceColumns.has(column.column_name),
	);
}

async function copyTable(
	sqlite: Database,
	client: pg.Client,
	table: string,
	columns: PostgresColumn[],
): Promise<number> {
	const columnNames = columns.map((column) => column.column_name);
	const select = sqlite.query<SqliteRow, [number, number]>(
		`SELECT ${columnNames.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(table)} LIMIT ? OFFSET ?`,
	);
	let offset = 0;
	let imported = 0;

	while (true) {
		const rows = select.all(BATCH_SIZE, offset);
		if (rows.length === 0) break;

		const values: PostgresValue[] = [];
		const placeholders: string[] = [];
		for (const row of rows) {
			const rowPlaceholders: string[] = [];
			for (const column of columns) {
				values.push(normalizeValue(row[column.column_name], column));
				rowPlaceholders.push(`$${values.length}`);
			}
			placeholders.push(`(${rowPlaceholders.join(", ")})`);
		}

		await client.query(
			`INSERT INTO ${quoteIdentifier(table)} (${columnNames.map(quoteIdentifier).join(", ")}) VALUES ${placeholders.join(", ")}`,
			values,
		);

		imported += rows.length;
		offset += rows.length;
	}

	return imported;
}

async function main(): Promise<void> {
	if (!DATABASE_URL) {
		throw new Error(
			"DATABASE_URL precisa apontar para o PostgreSQL de destino.",
		);
	}
	if (!existsSync(SQLITE_PATH)) {
		throw new Error(`Banco SQLite nao encontrado em ${SQLITE_PATH}.`);
	}

	console.log(`Origem SQLite: ${SQLITE_PATH}`);
	console.log("Destino PostgreSQL: URL configurada (credenciais omitidas)");

	const sqlite = new Database(SQLITE_PATH, { readonly: true });
	const client = new Client({ connectionString: DATABASE_URL });

	try {
		await client.connect();
		const targetSchema = await loadTargetSchema(client);
		const sourceTables = loadSourceTables(sqlite);
		const tablesToImport = sourceTables.filter((table) =>
			targetSchema.has(table),
		);

		const missingInTarget = sourceTables.filter(
			(table) => !targetSchema.has(table),
		);
		if (missingInTarget.length > 0) {
			console.warn(
				`Tabelas SQLite ignoradas por nao existirem no schema PostgreSQL: ${missingInTarget.join(", ")}`,
			);
		}

		// A importacao e deliberadamente somente para um banco recem-migrado.
		// Permitir destino parcialmente preenchido tornaria uma segunda execucao
		// potencialmente duplicadora e impossivel de auditar com seguranca.
		await assertTargetIsEmpty(client, targetSchema.keys());

		await client.query("BEGIN");
		await client.query("SET session_replication_role = replica");

		let processedTables = 0;
		try {
			for (const table of tablesToImport) {
				const columns = loadCommonColumns(
					sqlite,
					table,
					targetSchema.get(table) ?? [],
				);

				if (columns.length === 0) {
					console.warn(`Tabela ${table} ignorada: nenhuma coluna em comum.`);
					continue;
				}

				const imported = await copyTable(sqlite, client, table, columns);
				processedTables += 1;
				console.log(`${table}: ${imported} registro(s)`);
			}

			await client.query("SET session_replication_role = origin");
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}

		console.log(
			`Migracao concluida: ${processedTables} tabela(s) processada(s).`,
		);
	} finally {
		sqlite.close();
		await client.end().catch(() => undefined);
	}
}

await main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
