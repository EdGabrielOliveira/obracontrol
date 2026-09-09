/**
 * Deterministic defaults for unit-test processes.
 *
 * Production configuration remains strict in src/env.ts; only missing values
 * are filled here, before any application module is imported by Bun.
 */
const TEST_ENV: Record<string, string> = {
	NODE_ENV: "test",
	DATABASE_URL:
		"postgresql://obracontrol:obracontrol_dev@localhost:5432/obracontrol_test?schema=public",
	OBJECT_STORAGE_DIR: "./.test-objects",
	BETTER_AUTH_SECRET: "unit-test-secret-with-at-least-32-characters",
	ADMIN_REGISTRATION_KEY: "unit-test-admin-registration-key",
	BETTER_AUTH_URL: "http://localhost:7001",
	FRONTEND_ORIGIN: "http://localhost:7000",
	AUTH_TRUSTED_ORIGINS: "http://localhost:7000",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
	if (process.env[key] === undefined) process.env[key] = value;
}
