import { describe, expect, it, mock } from "bun:test";
import { createCnpjClient } from "../../../src/lib/cnpj-client";

function makeFetchResponse(
	status: number,
	body: unknown,
): { status: number; ok: boolean; json: () => Promise<unknown> } {
	return {
		status,
		ok: status >= 200 && status < 300,
		json: async () => body,
	};
}

const validBody = {
	razao_social: "Construtora Exemplo LTDA",
	nome_fantasia: "Construtora Exemplo",
	descricao_situacao_cadastral: "ATIVA",
	cnae_fiscal_descricao: "Construção de edifícios",
	uf: "RN",
};

describe("cnpj client (EMP-002) - consulta resiliente sem auto-gravacao", () => {
	it("resposta valida normaliza o CNPJ e devolve dados tipados", async () => {
		const fetchFn = mock(async () => makeFetchResponse(200, validBody));
		const client = createCnpjClient({ fetch: fetchFn });

		const result = await client.lookup("12.345.678/0001-95");

		expect(fetchFn).toHaveBeenCalledWith(
			"https://brasilapi.com.br/api/cnpj/v1/12345678000195",
			expect.objectContaining({ headers: { Accept: "application/json" } }),
		);
		expect(result).toEqual({
			razaoSocial: "Construtora Exemplo LTDA",
			nomeFantasia: "Construtora Exemplo",
			situacao: "ATIVA",
			atividade: "Construção de edifícios",
			uf: "RN",
		});
	});

	it("CNPJ invalido e rejeitado antes da chamada HTTP", async () => {
		const fetchFn = mock(async () => makeFetchResponse(200, validBody));
		const client = createCnpjClient({ fetch: fetchFn });

		await expect(client.lookup("123")).rejects.toMatchObject({
			code: "INVALID_CNPJ",
			status: 400,
			message: "CNPJ deve conter 14 digitos",
		});
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("404 do servico vira CNPJ_NOT_FOUND", async () => {
		const client = createCnpjClient({
			fetch: mock(async () => makeFetchResponse(404, {})),
		});

		await expect(client.lookup("12345678000195")).rejects.toMatchObject({
			code: "CNPJ_NOT_FOUND",
			status: 404,
		});
	});

	it("timeout aborta a consulta com CNPJ_TIMEOUT", async () => {
		const fetchFn = mock(async (_url: string, init?: RequestInit) => {
			await new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () =>
					reject(new DOMException("Aborted", "AbortError")),
				);
			});
			return makeFetchResponse(200, validBody);
		});
		const client = createCnpjClient({ fetch: fetchFn, timeoutMs: 5 });

		await expect(client.lookup("12345678000195")).rejects.toMatchObject({
			code: "CNPJ_TIMEOUT",
			status: 504,
		});
	});

	it("schema incompleto (sem razao_social) e rejeitado", async () => {
		const client = createCnpjClient({
			fetch: mock(async () =>
				makeFetchResponse(200, { nome_fantasia: "Sem razao" }),
			),
		});

		await expect(client.lookup("12345678000195")).rejects.toMatchObject({
			code: "CNPJ_INVALID_RESPONSE",
			status: 502,
		});
	});

	it("falha de rede vira CNPJ_UNAVAILABLE", async () => {
		const fetchFn = mock(async () => {
			throw new TypeError("network down");
		});
		const client = createCnpjClient({ fetch: fetchFn });

		await expect(client.lookup("12345678000195")).rejects.toMatchObject({
			code: "CNPJ_UNAVAILABLE",
			status: 503,
		});
	});

	it("nome fantasia ausente vira null (nao quebra)", async () => {
		const client = createCnpjClient({
			fetch: mock(async () =>
				makeFetchResponse(200, {
					...validBody,
					nome_fantasia: "",
				}),
			),
		});

		const result = await client.lookup("12345678000195");
		expect(result.nomeFantasia).toBeNull();
		expect(result.razaoSocial).toBe("Construtora Exemplo LTDA");
	});
});
