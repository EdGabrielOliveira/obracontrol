import { ConstructionError } from "./errors";

export type CepLookupResult = {
	zipCode: string;
	street: string | null;
	district: string | null;
	city: string | null;
	state: string | null;
	latitude: number | null;
	longitude: number | null;
};

export type CepFetch = (
	url: string,
	init?: RequestInit,
) => Promise<Pick<Response, "status" | "ok" | "json">>;

export type CepClientDeps = {
	fetch?: CepFetch;
	baseUrl?: string | null;
	timeoutMs?: number;
};

export const CEP_TIMEOUT_MS = 5_000;
const CEP_DIGITS_ONLY = /^\d{8}$/;

function normalizeCep(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (!CEP_DIGITS_ONLY.test(digits)) {
		throw new ConstructionError(
			"INVALID_CEP",
			"CEP deve conter 8 digitos",
			400,
		);
	}
	return digits;
}

export function createCepClient(deps: CepClientDeps = {}): {
	lookup(rawCep: string): Promise<CepLookupResult>;
} {
	const fetchFn = deps.fetch ?? globalThis.fetch;
	const baseUrl =
		deps.baseUrl === null
			? null
			: (deps.baseUrl ??
				process.env.CEP_API_BASE_URL ??
				"https://brasilapi.com.br/api/cep/v2");
	const timeoutMs = deps.timeoutMs ?? CEP_TIMEOUT_MS;

	return {
		async lookup(rawCep: string): Promise<CepLookupResult> {
			const zipCode = normalizeCep(rawCep);
			if (!baseUrl) {
				throw new ConstructionError(
					"CEP_UNAVAILABLE",
					"Consulta de CEP externo nao configurada neste ambiente",
					503,
				);
			}
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			let response: Awaited<ReturnType<CepFetch>>;
			try {
				response = await fetchFn(`${baseUrl}/${zipCode}`, {
					signal: controller.signal,
					headers: { Accept: "application/json" },
				});
			} catch (_error) {
				if (controller.signal.aborted) {
					throw new ConstructionError(
						"CEP_TIMEOUT",
						"Tempo esgotado na consulta de CEP",
						504,
					);
				}
				throw new ConstructionError(
					"CEP_UNAVAILABLE",
					"Servico de consulta de CEP indisponivel",
					503,
				);
			} finally {
				clearTimeout(timer);
			}

			if (response.status === 404) {
				throw new ConstructionError("CEP_NOT_FOUND", "CEP nao encontrado", 404);
			}
			if (!response.ok) {
				throw new ConstructionError(
					"CEP_UNAVAILABLE",
					"Servico de consulta de CEP indisponivel",
					503,
				);
			}

			const body: unknown = await response.json().catch(() => null);
			if (!body || typeof body !== "object") {
				throw new ConstructionError(
					"CEP_INVALID_RESPONSE",
					"Resposta invalida do servico de CEP",
					502,
				);
			}
			const record = body as Record<string, unknown>;
			const location =
				(record.location as Record<string, unknown> | undefined) ?? {};
			const coordinates =
				(location.coordinates as Record<string, unknown> | undefined) ?? {};
			const numberOrNull = (value: unknown): number | null => {
				const parsed = typeof value === "number" ? value : Number(value);
				return Number.isFinite(parsed) ? parsed : null;
			};

			return {
				zipCode,
				street: typeof record.street === "string" ? record.street : null,
				district:
					typeof record.neighborhood === "string" ? record.neighborhood : null,
				city: typeof record.city === "string" ? record.city : null,
				state: typeof record.state === "string" ? record.state : null,
				latitude: numberOrNull(coordinates.latitude),
				longitude: numberOrNull(coordinates.longitude),
			};
		},
	};
}

// A consulta publica de CEP permanece habilitada; CEP_API_BASE_URL permite
// substituir o endpoint quando necessario.
export const cepClient = createCepClient();
