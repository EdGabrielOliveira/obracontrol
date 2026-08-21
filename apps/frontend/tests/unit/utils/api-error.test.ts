import { describe, expect, it } from "bun:test";
import axios from "axios";
import { getErrorMessage, normalizePortugueseText } from "@/utils/api-error";

describe("normalizePortugueseText", () => {
	it("corrige mensagens legadas sem alterar identificadores técnicos", () => {
		expect(
			normalizePortugueseText(
				"Cotacao nao encontrada para o item de orcamento; codigo invalido.",
			),
		).toBe("Cotação não encontrada para o item de orçamento; código inválido.");
	});
});

describe("getErrorMessage", () => {
	it("exibe detalhes de campos quando a API retorna 400 sem mensagem geral", () => {
		const error = new axios.AxiosError(
			"Request failed",
			"ERR_BAD_REQUEST",
			undefined,
			undefined,
			{
				status: 400,
				statusText: "Bad Request",
				data: {
					errors: {
						name: ["Nome obrigatorio"],
						costCenterId: ["Organizacao obrigatoria"],
					},
				},
				headers: {},
				config: {} as never,
			},
		);

		expect(getErrorMessage(error, "Falha ao salvar")).toBe(
			"name: Nome obrigatório; costCenterId: Organização obrigatória",
		);
	});

	it("identifica quando o proxy retorna HTML ou outra resposta não-JSON", () => {
		const error = new axios.AxiosError(
			"Request failed",
			"ERR_BAD_RESPONSE",
			undefined,
			undefined,
			{
				status: 502,
				statusText: "Bad Gateway",
				data: "<html>Bad Gateway</html>",
				headers: {},
				config: {} as never,
			},
		);

		expect(getErrorMessage(error, "Falha ao salvar")).toBe(
			"O servidor retornou uma resposta inválida (HTTP 502).",
		);
	});

	it("identifica quando não houve resposta HTTP", () => {
		const error = new axios.AxiosError("Network Error", "ERR_NETWORK");

		expect(getErrorMessage(error, "Falha ao salvar")).toBe(
			"Não foi possível obter resposta da API. Verifique o endereço público e o proxy do servidor.",
		);
	});
});
