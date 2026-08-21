import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),

	PORT: z.coerce.number().default(7001),
	HOST: z.string().default("0.0.0.0"),
	DATABASE_URL: z.string().startsWith("file:").default("file:./prisma/dev.db"),
	OBJECT_STORAGE_DIR: z.string().min(1).default(".local-objects"),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.string().url().optional(),
	ADMIN_REGISTRATION_KEY: z.string().min(16),
	FRONTEND_ORIGIN: z.string().url().default("http://localhost:7000"),
	AUTH_TRUSTED_ORIGINS: z.string().optional(),
	SENTRY_DSN: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.string().url().optional(),
	),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
	AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
	TRUSTED_PROXY: z
		.string()
		.optional()
		.transform((value) => {
			if (!value) return null;
			return value
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean);
		}),
	SEED_ADMIN_EMAIL: z.string().email().optional(),
	SEED_ADMIN_NAME: z.string().min(1).optional(),
	SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
	RESET_CONFIRM: z.enum(["yes", "no"]).default("no"),
	AUDIT_RELEASE_B: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
});

export const env = envSchema.parse({
	NODE_ENV: process.env.NODE_ENV,
	PORT: process.env.PORT,
	HOST: process.env.HOST,
	DATABASE_URL: process.env.DATABASE_URL,
	OBJECT_STORAGE_DIR: process.env.OBJECT_STORAGE_DIR,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
	BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
	ADMIN_REGISTRATION_KEY: process.env.ADMIN_REGISTRATION_KEY,
	FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
	AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS,
	SENTRY_DSN: process.env.SENTRY_DSN,
	LOG_LEVEL: process.env.LOG_LEVEL,
	AUDIT_LOG_RETENTION_DAYS: process.env.AUDIT_LOG_RETENTION_DAYS,
	TRUSTED_PROXY: process.env.TRUSTED_PROXY,
	SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
	SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
	SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
	RESET_CONFIRM: process.env.RESET_CONFIRM,
	AUDIT_RELEASE_B: process.env.AUDIT_RELEASE_B,
});
