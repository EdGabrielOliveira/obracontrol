import { env } from "../env";
import { requestContext } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<
	string,
	string | number | boolean | null | undefined
>;

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

const SENSITIVE_FIELD_NAMES = new Set([
	"password",
	"token",
	"secret",
	"apikey",
	"api_key",
	"authorization",
	"cookie",
	"cpf",
	"cnpj",
	"document",
	"keyhash",
]);

export function resolveLogLevel(
	nodeEnv: string = env.NODE_ENV,
	configuredLevel: LogLevel | undefined = env.LOG_LEVEL,
): LogLevel {
	// Debug output may include internal state and query-related details. Never
	// allow an environment override to enable it in production.
	if (nodeEnv === "production") {
		if (!configuredLevel || configuredLevel === "debug") return "info";
		return configuredLevel;
	}
	return configuredLevel ?? "debug";
}

export interface Logger {
	debug(action: string, fields?: LogFields): void;
	info(action: string, fields?: LogFields): void;
	warn(action: string, fields?: LogFields): void;
	error(action: string, fields?: LogFields): void;
}

export type LogSink = (level: LogLevel, line: string) => void;

function formatValue(value: string | number | boolean | null): string {
	if (typeof value === "string") {
		if (!/[\s"=]/.test(value)) return value;
		const escaped = value
			.replaceAll("\\", "\\\\")
			.replaceAll('"', '\\"')
			.replaceAll("\r", "\\r")
			.replaceAll("\n", "\\n")
			.replaceAll("\t", "\\t");
		return `"${escaped}"`;
	}
	return String(value);
}

function formatFields(fields: LogFields): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined) continue;
		const safeValue = SENSITIVE_FIELD_NAMES.has(key.toLowerCase())
			? "[redacted]"
			: value;
		parts.push(`${key}=${formatValue(safeValue)}`);
	}
	return parts.join(" ");
}

export function createLogger(
	level: LogLevel,
	sink: LogSink = defaultSink,
): Logger {
	const threshold = LEVEL_ORDER[level];
	const log = (lvl: LogLevel, action: string, fields?: LogFields) => {
		if (LEVEL_ORDER[lvl] < threshold) return;
		const context: LogFields = {
			requestId: requestContext.getRequestId(),
			userId: requestContext.getUserId(),
		};
		const line = `[${lvl}] ${action}`;
		const formatted = formatFields({ ...context, ...fields });
		sink(lvl, formatted ? `${line} ${formatted}` : line);
	};
	return {
		debug: (action, fields) => log("debug", action, fields),
		info: (action, fields) => log("info", action, fields),
		warn: (action, fields) => log("warn", action, fields),
		error: (action, fields) => log("error", action, fields),
	};
}

function defaultSink(level: LogLevel, line: string): void {
	if (level === "error") console.error(line);
	else console.log(line);
}

export const logger = createLogger(resolveLogLevel());
