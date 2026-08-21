import type { z } from "zod";
import { ConstructionError } from "./errors";

type ZodSchema<T> = Pick<z.ZodType<T>, "safeParse">;

export function throwInvalidInput(
	error: z.ZodError,
	message = "Dados invalidos",
	useFirstIssue = true,
): never {
	const details = error.issues.map((issue) => ({
		field: issue.path.join("."),
		code: issue.code,
		message: issue.message,
	}));
	const responseMessage =
		useFirstIssue && message === "Dados invalidos"
			? (details[0]?.message ?? message)
			: message;

	throw new ConstructionError("INVALID_INPUT", responseMessage, 400, details);
}

export function throwInvalidQuery(error: z.ZodError): never {
	return throwInvalidInput(error, "Parametros invalidos");
}

export function parseInput<T>(schema: ZodSchema<T>, input: unknown): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success)
		throwInvalidInput(parsed.error, "Dados invalidos", false);
	return parsed.data;
}

export function parseQuery<T>(schema: ZodSchema<T>, input: unknown): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success) throwInvalidQuery(parsed.error);
	return parsed.data;
}
