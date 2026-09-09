import pg from "pg";
import { validateTestDatabaseUrl } from "../../support/test-database-guard";

const databaseUrl =
	process.env.TEST_DATABASE_URL ??
	"postgresql://obracontrol:obracontrol_dev@localhost:5432/obracontrol_test?schema=public";
const validated = validateTestDatabaseUrl(databaseUrl);

if (!validated.ok) {
	throw new Error(`TEST_DATABASE_URL inválida: ${validated.reason}`);
}

const database = new URL(databaseUrl);
const databaseName = database.pathname.slice(1);
database.pathname = "/postgres";
database.search = "";

const client = new pg.Client({ connectionString: database.toString() });
await client.connect();
try {
	const existing = await client.query(
		"SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1",
		[databaseName],
	);
	if (existing.rowCount === 0) {
		const quotedName = `"${databaseName.replaceAll('"', '""')}"`;
		await client.query(`CREATE DATABASE ${quotedName}`);
	}
	console.log(`Banco PostgreSQL de teste pronto: ${databaseUrl}`);
} finally {
	await client.end();
}
