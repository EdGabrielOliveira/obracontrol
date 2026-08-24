import { Elysia } from "elysia";
import { env } from "../env";
import { logger } from "./logger";
import { metrics } from "./metrics";
import { MemoryRateLimitStore, type RateLimitStore } from "./rate-limit-store";
import { requestContext } from "./request-context";

interface RateLimitOptions {
	windowMs: number;
	max: number;
	key?: string;
}

const store: RateLimitStore = new MemoryRateLimitStore();

// Um unico store para todo o processo: a promessa resolve uma vez com o
// Memoria local por processo. Todas as requisicoes aguardam a
// MESMA resolucao — nao ha troca de store no meio do caminho nem buckets
// mesma instancia de store durante o ciclo de vida do processo.
function resolveStore(): Promise<RateLimitStore> {
	return Promise.resolve(store);
}

function clientIp(
	request: Request,
	server: { requestIP(request: Request): { address: string } | null } | null,
): string | null {
	// Apenas confia em headers de IP quando um proxy confiavel esta
	// configurado explicitamente. Sem TRUSTED_PROXY, usa o IP observado pelo
	// servidor Bun; o header enviado pelo cliente continua sendo ignorado.
	const trustedProxies = env.TRUSTED_PROXY;
	if (!trustedProxies || trustedProxies.length === 0) {
		return server?.requestIP(request)?.address ?? null;
	}

	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}
	const realIp = request.headers.get("x-real-ip");
	if (realIp) return realIp.trim();
	return null;
}

export function rateLimitApi(options: RateLimitOptions) {
	const scopeKey = options.key ?? "api";

	return new Elysia({ name: `rate-limit-${scopeKey}` }).onBeforeHandle(
		{ as: "scoped" },
		async (context) => {
			const { request, server, set, path } = context;
			const user = (context as { user?: { id?: string } | null }).user;
			// Rotas autenticadas usam o userId como identidade do bucket.
			// Rotas anonimas usam o IP observado pelo servidor ou, quando atras de
			// proxy, o primeiro IP do header somente com TRUSTED_PROXY configurado.
			const clientId =
				user?.id ??
				requestContext.getUserId() ??
				clientIp(request, server) ??
				"anonymous";

			const result = await (await resolveStore()).check(scopeKey, clientId, {
				windowMs: options.windowMs,
				max: options.max,
			});

			if (!result.allowed) {
				metrics.increment("ratelimit.blocked");
				logger.warn("ratelimit.blocked", {
					clientId,
					path,
					retryAfter: result.retryAfter ?? null,
				});
				set.status = 429;
				return new Response(
					JSON.stringify({
						error: "Too many requests",
						retryAfter: result.retryAfter,
					}),
					{
						status: 429,
						headers: {
							"Content-Type": "application/json",
							"Retry-After": String(result.retryAfter ?? 60),
						},
					},
				);
			}
		},
	);
}

export function getRateLimitStore() {
	return store;
}

export { resolveStore };
