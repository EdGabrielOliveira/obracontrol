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

export function resolveLogLevel(): LogLevel {
	if (env.LOG_LEVEL) return env.LOG_LEVEL;
	return env.NODE_ENV === "production" ? "info" : "debug";
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
		return /[\s"=]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
	}
	return String(value);
}

function formatFields(fields: LogFields): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined) continue;
		parts.push(`${key}=${formatValue(value)}`);
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
