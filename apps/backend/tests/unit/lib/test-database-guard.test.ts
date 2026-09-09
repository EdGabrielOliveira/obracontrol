import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	DEFAULT_TEST_DATABASE_URL,
	resolveTestDatabaseUrl,
	validateTestDatabaseUrl,
} from "../../support/test-database-guard";

const DATABASE_URL_KEY = "DATABASE_URL";
const TEST_DATABASE_URL_KEY = "TEST_DATABASE_URL";

describe("validateTestDatabaseUrl", () => {
	test("rejeita banco PostgreSQL sem nome marcado como teste", () => {
		const result = validateTestDatabaseUrl(
			"postgresql://localhost:5432/obracontrol_prod",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain("test");
		}
	});

	test("rejeita URL de protocolo invalido", () => {
		const result = validateTestDatabaseUrl(
			"mysql://user:pass@localhost:3306/obracontrol_test_db",
		);
		expect(result.ok).toBe(false);
	});

	test("rejeita URL malformada", () => {
		const result = validateTestDatabaseUrl("nao-e-uma-url");
		expect(result.ok).toBe(false);
	});

	test("aceita banco descartavel local marcado por test", () => {
		const result = validateTestDatabaseUrl(DEFAULT_TEST_DATABASE_URL);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.url).toBe(DEFAULT_TEST_DATABASE_URL);
		}
	});

	test("aceita banco PostgreSQL descartavel com test no nome", () => {
		const result = validateTestDatabaseUrl(
			"postgresql://localhost:5432/obracontrol_ci_test",
		);
		expect(result.ok).toBe(true);
	});
});

describe("resolveTestDatabaseUrl", () => {
	beforeEach(() => {
		delete process.env[DATABASE_URL_KEY];
		delete process.env[TEST_DATABASE_URL_KEY];
	});

	afterEach(() => {
		delete process.env[DATABASE_URL_KEY];
		delete process.env[TEST_DATABASE_URL_KEY];
	});

	test("usa URL padrao de teste quando nenhuma variavel esta presente", () => {
		const result = resolveTestDatabaseUrl();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.url).toBe(DEFAULT_TEST_DATABASE_URL);
		}
	});

	test("recusa DATABASE_URL sem TEST_DATABASE_URL explicita", () => {
		process.env[DATABASE_URL_KEY] =
			"postgresql://localhost:5432/obracontrol_dev";
		const result = resolveTestDatabaseUrl();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain("TEST_DATABASE_URL");
		}
	});

	test("recusa TEST_DATABASE_URL apontando para banco nao descartavel", () => {
		process.env[TEST_DATABASE_URL_KEY] =
			"postgresql://localhost:5432/obracontrol_prod";
		const result = resolveTestDatabaseUrl();
		expect(result.ok).toBe(false);
	});

	test("aceita TEST_DATABASE_URL descartavel mesmo com DATABASE_URL presente", () => {
		process.env[DATABASE_URL_KEY] =
			"postgresql://localhost:5432/obracontrol_dev";
		process.env[TEST_DATABASE_URL_KEY] = DEFAULT_TEST_DATABASE_URL;
		const result = resolveTestDatabaseUrl();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.url).toBe(DEFAULT_TEST_DATABASE_URL);
		}
	});
});
