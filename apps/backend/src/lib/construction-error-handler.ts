import { Prisma } from "../../generated/prisma/client";
import { env } from "../env";
import { reportException } from "./error-reporter";
import { ConstructionError } from "./errors";
import { logger } from "./logger";
import { metrics } from "./metrics";

type ZodIssue = {
	path: (string | number)[];
	code: string;
	message: string;
};

type ZodErrorLike = {
	name: string;
	issues: ZodIssue[];
};

type ElysiaValidationIssue = {
	path?: string;
	summary?: string;
	message?: string;
	type?: string | number;
};

type ElysiaValidationErrorLike = {
	all?: ElysiaValidationIssue[];
};

type ErrorHandlerContext = {
	error: unknown;
	code: string | number;
	path?: string;
	user?: { id?: string; role?: string | null } | null;
};

function deriveEntityType(path: string | undefined): string {
	if (!path) return "unknown";
	const segments = path.split("/").filter(Boolean);
	return segments.slice(0, 2).join(".") || "root";
}

function normalizeMetricRoute(path: string | undefined): string {
	return (path ?? "unknown").replace(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
		":id",
	);
}

function safePrismaMessage(message: string): string {
	return message.replace(/[\r\n\t]+/g, " ").slice(0, 1000);
}

function safePrismaMeta(meta: unknown): string | null {
	if (meta == null) return null;
	try {
		return JSON.stringify(meta).slice(0, 1000);
	} catch {
		return null;
	}
}

export function handleConstructionError(context: ErrorHandlerContext) {
	const { error, code, path } = context;
	const user = context.user;

	if (error instanceof ConstructionError) {
		const status = error.status;
		if (status === 403) {
			metrics.increment("auth.denied");
			logger.warn("auth.denied", {
				status: 403,
				code: error.code,
				path,
				entityType: deriveEntityType(path),
				userId: user?.id,
				role: user?.role,
			});
		} else if (status >= 500) {
			logger.error("http.request.failed", {
				status,
				code: error.code,
				path,
				userId: user?.id,
			});
			reportException(error);
		} else {
			logger.warn("http.request.rejected", {
				status,
				code: error.code,
				path,
				userId: user?.id,
			});
		}
		return new Response(
			JSON.stringify({
				message: error.message,
				errors: error.details ?? [],
			}),
			{ status: error.status, headers: { "Content-Type": "application/json" } },
		);
	}
	if (code === "NOT_FOUND") {
		logger.info("route.not_found", { path });
		return new Response(JSON.stringify({ message: "Rota nao encontrada" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (
		code === "VALIDATION" ||
		(error instanceof Error && error.name === "ZodError")
	) {
		const zodError = error as ZodErrorLike;
		const elysiaError = error as ElysiaValidationErrorLike;
		const errors = zodError.issues
			? zodError.issues.map((i) => ({
					field: i.path.join("."),
					code: i.code,
					message: i.message,
				}))
			: (elysiaError.all ?? []).map((issue) => ({
					field: issue.path ?? "",
					code: String(issue.type ?? "VALIDATION"),
					message: issue.summary ?? issue.message ?? "Valor invalido",
				}));
		logger.warn("http.validation_failed", {
			path,
			errorCount: errors.length,
		});
		return new Response(
			JSON.stringify({ message: "Dados invalidos", errors }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
	if (error instanceof Prisma.PrismaClientInitializationError) {
		logger.error("db.unavailable", { path });
		reportException(error);
		return new Response(
			JSON.stringify({
				message:
					"Servico temporariamente indisponivel. Banco de dados nao conectado.",
			}),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		metrics.increment(`db.error.${error.code}`);
		metrics.increment(`db.error.route.${normalizeMetricRoute(path)}`);
		if (error.code === "P2002") {
			const target = (error.meta?.target as string[]) ?? [];
			const field = target.includes("code")
				? "código"
				: target.length > 0
					? target.join(", ")
					: "dados informados";
			logger.warn("db.conflict", { prismaCode: "P2002", field, path });
			return new Response(
				JSON.stringify({
					message: `Já existe um registro com estes ${field}.`,
				}),
				{ status: 409, headers: { "Content-Type": "application/json" } },
			);
		}
		if (error.code === "P2025") {
			logger.info("db.not_found", { prismaCode: "P2025", path });
			return new Response(
				JSON.stringify({ message: "Registro nao encontrado" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		logger.error("db.error", {
			prismaCode: error.code,
			prismaMessage: safePrismaMessage(error.message),
			prismaMeta: safePrismaMeta(error.meta),
			path,
		});
		reportException(error);
		return new Response(
			JSON.stringify({
				message: "Erro ao processar a requisicao",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
	if (error instanceof Error) {
		logger.error("internal.error", {
			path,
			name: error.name,
			message: error.message,
		});
	} else {
		logger.error("internal.error", { path, type: typeof error });
	}
	reportException(error);

	const isDev = env.NODE_ENV === "development";
	return new Response(
		JSON.stringify({
			message: "Erro interno do servidor",
			...(isDev && error instanceof Error ? { debug: error.message } : {}),
		}),
		{ status: 500, headers: { "Content-Type": "application/json" } },
	);
}
