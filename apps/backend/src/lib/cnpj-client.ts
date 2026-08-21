import { ConstructionError } from "./errors";

export type CnpjLookupResult = {
	razaoSocial: string;
	nomeFantasia: string | null;
	situacao: string;
	atividade: string | null;
	uf: string | null;
};

export type CnpjFetch = (
	url: string,
	init?: RequestInit,
) => Promise<Pick<Response, "status" | "ok" | "json">>;

export type CnpjClientDeps = {
	fetch?: CnpjFetch;
	baseUrl?: string | null;
	timeoutMs?: number;
};

export const CNPJ_TIMEOUT_MS = 5_000;
const CNPJ_DIGITS_ONLY = /^\d{14}$/;

function normalizeCnpj(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (!CNPJ_DIGITS_ONLY.test(digits)) {
		throw new ConstructionError(
			"INVALID_CNPJ",
			"CNPJ deve conter 14 digitos",
			400,
		);
	}
	return digits;
}

export function createCnpjClient(deps: CnpjClientDeps = {}): {
	lookup(rawCnpj: string): Promise<CnpjLookupResult>;
} {
	const fetchFn = deps.fetch ?? globalThis.fetch;
	const baseUrl =
		deps.baseUrl === null
			? null
			: (deps.baseUrl ??
				process.env.CNPJ_API_BASE_URL ??
				"https://brasilapi.com.br/api/cnpj/v1");
	const timeoutMs = deps.timeoutMs ?? CNPJ_TIMEOUT_MS;

	return {
		async lookup(rawCnpj: string): Promise<CnpjLookupResult> {
			const cnpj = normalizeCnpj(rawCnpj);
			if (!baseUrl) {
				throw new ConstructionError(
					"CNPJ_UNAVAILABLE",
					"Consulta de CNPJ externo nao configurada neste ambiente",
					503,
				);
			}

			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			let response: Awaited<ReturnType<CnpjFetch>>;
			try {
				response = await fetchFn(`${baseUrl}/${cnpj}`, {
					signal: controller.signal,
					headers: { Accept: "application/json" },
				});
			} catch (_error) {
				if (controller.signal.aborted) {
					throw new ConstructionError(
						"CNPJ_TIMEOUT",
						"Tempo esgotado na consulta de CNPJ",
						504,
					);
				}
				throw new ConstructionError(
					"CNPJ_UNAVAILABLE",
					"Servico de consulta de CNPJ indisponivel",
					503,
				);
			} finally {
				clearTimeout(timer);
			}

			if (response.status === 404) {
				throw new ConstructionError(
					"CNPJ_NOT_FOUND",
					"CNPJ nao encontrado",
					404,
				);
			}
			if (!response.ok) {
				throw new ConstructionError(
					"CNPJ_UNAVAILABLE",
					"Servico de consulta de CNPJ indisponivel",
					503,
				);
			}

			const body: unknown = await response.json().catch(() => null);
			if (!body || typeof body !== "object") {
				throw new ConstructionError(
					"CNPJ_INVALID_RESPONSE",
					"Resposta invalida do servico de CNPJ",
					502,
				);
			}
			const record = body as Record<string, unknown>;
			if (
				typeof record.razao_social !== "string" ||
				record.razao_social.length === 0
			) {
				throw new ConstructionError(
					"CNPJ_INVALID_RESPONSE",
					"Resposta invalida do servico de CNPJ",
					502,
				);
			}

			return {
				razaoSocial: record.razao_social,
				nomeFantasia:
					typeof record.nome_fantasia === "string" &&
					record.nome_fantasia.length > 0
						? record.nome_fantasia
						: null,
				situacao:
					typeof record.descricao_situacao_cadastral === "string"
						? record.descricao_situacao_cadastral
						: "DESCONHECIDA",
				atividade:
					typeof record.cnae_fiscal_descricao === "string"
						? record.cnae_fiscal_descricao
						: null,
				uf: typeof record.uf === "string" ? record.uf : null,
			};
		},
	};
}

// O ambiente local nao configura CNPJ_API_BASE_URL; nesse caso nao ha cliente
// global habilitado para fazer chamadas externas.
export const cnpjClient = createCnpjClient({
	baseUrl: process.env.CNPJ_API_BASE_URL ?? null,
});
