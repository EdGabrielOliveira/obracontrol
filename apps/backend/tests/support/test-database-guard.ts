export type TestDatabaseUrlResult =
	| { ok: true; url: string }
	| { ok: false; reason: string };

export const DEFAULT_TEST_DATABASE_URL =
	"postgresql://obracontrol:obracontrol_dev@localhost:5432/obracontrol_test?schema=public";

export function validateTestDatabaseUrl(url: string): TestDatabaseUrlResult {
	if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
		return { ok: false, reason: "URL invalida de banco de teste." };
	}
	let database = "";
	try {
		database = new URL(url).pathname.slice(1);
	} catch {
		return { ok: false, reason: "URL invalida de banco de teste." };
	}
	if (!database) {
		return {
			ok: false,
			reason: "URL de banco de teste deve apontar para um banco PostgreSQL.",
		};
	}
	if (!database.toLowerCase().includes("test")) {
		return {
			ok: false,
			reason:
				"URL de banco de teste deve apontar para banco descartavel marcado por 'test' no nome; recusado antes de qualquer migration/seed.",
		};
	}
	return { ok: true, url };
}

export function resolveTestDatabaseUrl(): TestDatabaseUrlResult {
	const explicit = process.env.TEST_DATABASE_URL;
	if (explicit) {
		return validateTestDatabaseUrl(explicit);
	}
	if (process.env.DATABASE_URL) {
		return {
			ok: false,
			reason:
				"TEST_DATABASE_URL ausente. E2E exige banco descartavel explicito; DATABASE_URL (desenvolvimento/producao) nao pode ser usada.",
		};
	}
	return validateTestDatabaseUrl(DEFAULT_TEST_DATABASE_URL);
}
