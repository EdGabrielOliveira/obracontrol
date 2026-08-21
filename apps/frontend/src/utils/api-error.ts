import axios from "axios";

import type { ApiErrorField, ApiErrorResponse } from "@/types/shared";

export function normalizePortugueseText(value: string): string {
	const replacements: Array<[string, string]> = [
		["nao", "não"],
		["Nao", "Não"],
		["voce", "você"],
		["Voce", "Você"],
		["permissao", "permissão"],
		["acao", "ação"],
		["Acoes", "Ações"],
		["orcamento", "orçamento"],
		["Orcamento", "Orçamento"],
		["cotacao", "cotação"],
		["Cotacao", "Cotação"],
		["servicos", "serviços"],
		["Servicos", "Serviços"],
		["medicoes", "medições"],
		["Medicoes", "Medições"],
		["negociacao", "negociação"],
		["Negociacao", "Negociação"],
		["confirmacao", "confirmação"],
		["Confirmacao", "Confirmação"],
		["importacao", "importação"],
		["Importacao", "Importação"],
		["solicitacao", "solicitação"],
		["Solicitacao", "Solicitação"],
		["contratacao", "contratação"],
		["Contratacao", "Contratação"],
		["descricao", "descrição"],
		["Descricao", "Descrição"],
		["observacoes", "observações"],
		["Observacoes", "Observações"],
		["historico", "histórico"],
		["Historico", "Histórico"],
		["reducao", "redução"],
		["Reducao", "Redução"],
		["codigo", "código"],
		["Codigo", "Código"],
		["situacao", "situação"],
		["Situacao", "Situação"],
		["obrigatorio", "obrigatório"],
		["Obrigatorio", "Obrigatório"],
		["obrigatoria", "obrigatória"],
		["Obrigatoria", "Obrigatória"],
		["organizacao", "organização"],
		["Organizacao", "Organização"],
		["invalido", "inválido"],
		["Invalido", "Inválido"],
		["invalida", "inválida"],
		["Invalida", "Inválida"],
		["unico", "único"],
		["Unico", "Único"],
		["unica", "única"],
		["Unica", "Única"],
		["versao", "versão"],
		["Versao", "Versão"],
		["aprovacao", "aprovação"],
		["Aprovacao", "Aprovação"],
		["excluida", "excluída"],
		["Excluida", "Excluída"],
		["excluido", "excluído"],
		["Excluido", "Excluído"],
	];

	return replacements.reduce(
		(text, [from, to]) => text.replace(new RegExp(`\\b${from}\\b`, "g"), to),
		value,
	);
}

function isApiErrorField(value: unknown): value is ApiErrorField {
	if (!value || typeof value !== "object") return false;
	const field = value as Record<string, unknown>;
	return typeof field.message === "string";
}

export function getApiErrorDetails(error: unknown): ApiErrorField[] {
	if (!axios.isAxiosError(error) || !error.response?.data) return [];

	const data = error.response.data as ApiErrorResponse;
	if (Array.isArray(data.errors)) {
		return data.errors.filter(isApiErrorField);
	}

	if (!data.errors || typeof data.errors !== "object") return [];

	return Object.entries(data.errors).flatMap(([field, messages]) => {
		const normalized = Array.isArray(messages) ? messages : [messages];
		return normalized
			.filter((message): message is string => typeof message === "string")
			.map((message) => ({ field, message }));
	});
}

export function getErrorMessage(error: unknown, fallback: string): string {
	if (axios.isAxiosError(error) && error.response) {
		const status = error.response.status;
		if (status === 413) {
			return "O arquivo enviado excede o tamanho máximo permitido.";
		}
		const data = error.response.data;
		if (!data || typeof data !== "object") {
			return `O servidor retornou uma resposta inválida (HTTP ${status}).`;
		}
		const record = data as Record<string, unknown>;
		const details = getApiErrorDetails(error);
		if (typeof record.message === "string") {
			const detail = details[0];
			const message = normalizePortugueseText(record.message);
			if (!detail) return message;
			return detail.field
				? `${message} (${detail.field}): ${normalizePortugueseText(detail.message)}`
				: `${message}: ${normalizePortugueseText(detail.message)}`;
		}
		if (details.length > 0) {
			return details
				.map((detail) =>
					detail.field
						? `${detail.field}: ${normalizePortugueseText(detail.message)}`
						: normalizePortugueseText(detail.message),
				)
				.join("; ");
		}
	}
	if (axios.isAxiosError(error) && !error.response) {
		return "Não foi possível obter resposta da API. Verifique o endereço público e o proxy do servidor.";
	}
	return fallback;
}
