import { describe, expect, it } from "bun:test";
import {
	createLogger,
	type Logger,
	type LogLevel,
	resolveLogLevel,
} from "../../../src/lib/logger";
import { requestContext } from "../../../src/lib/request-context";

function captureLogger(level: LogLevel): {
	logger: Logger;
	lines: Array<{ level: LogLevel; line: string }>;
} {
	const lines: Array<{ level: LogLevel; line: string }> = [];
	const logger = createLogger(level, (lvl, line) =>
		lines.push({ level: lvl, line }),
	);
	return { logger, lines };
}

describe("createLogger", () => {
	it("emits a structured line with action and key=value fields", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("import.completed", {
			workId: "w1",
			importedCount: 3,
			durationMs: 12,
		});
		expect(lines).toEqual([
			{
				level: "info",
				line: "[info] import.completed workId=w1 importedCount=3 durationMs=12",
			},
		]);
	});

	it("never interpolates field values into the action token", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("import.completed", { count: 42 });
		expect(lines[0].line).toBe("[info] import.completed count=42");
		expect(lines[0].line).not.toContain("import.completed 42");
	});

	it("filters out logs below the configured level", () => {
		const { logger, lines } = captureLogger("info");
		logger.debug("debug.message", { value: 1 });
		logger.info("info.message", { value: 2 });
		logger.warn("warn.message", { value: 3 });
		logger.error("error.message", { value: 4 });
		expect(lines.map((l) => l.level)).toEqual(["info", "warn", "error"]);
	});

	it("suppresses everything below error level when level is error", () => {
		const { logger, lines } = captureLogger("error");
		logger.debug("a");
		logger.info("b");
		logger.warn("c");
		logger.error("d");
		expect(lines.map((l) => l.line)).toEqual(["[error] d"]);
	});

	it("quotes string values that contain spaces", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("work.renamed", { name: "Obra A" });
		expect(lines[0].line).toBe('[info] work.renamed name="Obra A"');
	});

	it("escapes control characters in string values", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("work.renamed", { name: 'Obra "A"\nlinha 2' });
		expect(lines[0].line).toBe(
			String.raw`[info] work.renamed name="Obra \"A\"\nlinha 2"`,
		);
	});

	it("serializes null and booleans, skips undefined fields", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("work.saved", {
			reprocessOfId: null,
			hasBudget: false,
			optional: undefined,
		});
		expect(lines[0].line).toBe(
			"[info] work.saved reprocessOfId=null hasBudget=false",
		);
	});

	it("redacts sensitive field names", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("auth.failed", {
			password: "super-secret",
			apiKey: "obi_secret",
			userId: "user-1",
		});
		expect(lines[0].line).toBe(
			"[info] auth.failed userId=user-1 password=[redacted] apiKey=[redacted]",
		);
	});

	it("carries requestId and userId from the request context", () => {
		const { logger, lines } = captureLogger("debug");
		requestContext.withRequestContext(
			{ requestId: "req-1", userId: "user-1" },
			() => {
				logger.info("work.created", { workId: "w1" });
			},
		);
		expect(lines[0].line).toBe(
			"[info] work.created requestId=req-1 userId=user-1 workId=w1",
		);
	});

	it("omits correlation fields outside a request context", () => {
		const { logger, lines } = captureLogger("debug");
		logger.info("work.created", { workId: "w1" });
		expect(lines[0].line).toBe("[info] work.created workId=w1");
	});
});

describe("resolveLogLevel", () => {
	it("never enables debug logging in production", () => {
		expect(resolveLogLevel("production", "debug")).toBe("info");
	});

	it("keeps an explicitly configured production level at or above info", () => {
		expect(resolveLogLevel("production", "warn")).toBe("warn");
		expect(resolveLogLevel("production", "error")).toBe("error");
	});

	it("defaults to debug outside production", () => {
		expect(resolveLogLevel("development", undefined)).toBe("debug");
	});
});
