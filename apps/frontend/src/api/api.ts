import axios from "axios";
import { toast } from "sonner";
import { SERVER_URL } from "@/env";
import { queryClient } from "@/lib/query-client";
import type { PaginatedResponse } from "@/types/shared";

export type BackendPaginated<T> = {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function invalidApiResponse(message: string): Error {
	return new Error(`Resposta inválida da API: ${message}`);
}

export function normalizePagination<T>(
	res: BackendPaginated<T>,
	limit: number,
): PaginatedResponse<T>;
export function normalizePagination<T>(
	res: unknown,
	limit: number,
): PaginatedResponse<T>;
export function normalizePagination<T>(
	res: unknown,
	limit: number,
): PaginatedResponse<T> {
	if (!isRecord(res) || !Array.isArray(res.data)) {
		throw invalidApiResponse("a paginação não contém uma lista de dados.");
	}
	if (
		typeof res.total !== "number" ||
		typeof res.page !== "number" ||
		typeof res.totalPages !== "number" ||
		typeof res.hasNextPage !== "boolean" ||
		typeof res.hasPreviousPage !== "boolean"
	) {
		throw invalidApiResponse("metadados de paginação incompletos.");
	}

	return {
		data: res.data as T[],
		total: res.total,
		page: res.page,
		limit,
		totalPages: res.totalPages,
		hasNextPage: res.hasNextPage,
		hasPreviousPage: res.hasPreviousPage,
	};
}

export const api = axios.create({
	baseURL: SERVER_URL,
	withCredentials: true,
	validateStatus: (status) => status >= 200 && status < 300,
});

let isRedirecting = false;

api.interceptors.response.use(
	(response) => response,
	async (error) => {
		if (axios.isAxiosError(error)) {
			const status = error.response?.status;

			if (error.response?.data instanceof Blob) {
				try {
					const text = await error.response.data.text();
					const parsed = JSON.parse(text) as unknown;
					if (parsed && typeof parsed === "object") {
						error.response.data = parsed;
					}
				} catch {}
			}

			if (status === 401 && !isRedirecting) {
				const isAuthPage = window.location.pathname.startsWith("/auth/");
				if (!isAuthPage) {
					isRedirecting = true;
					toast.error("Sessão expirada. Faça login novamente.");
					queryClient.clear();
					setTimeout(() => {
						window.location.replace("/auth/login");
					}, 1500);
				}
				return Promise.reject(error);
			}

			if (status === 429) {
				const retryAfter = error.response?.headers?.["retry-after"];
				const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : 60;
				toast.error(
					`Muitas requisições. Tente novamente em ${seconds} segundos.`,
				);
				return Promise.reject(error);
			}

			if (!error.response) {
				toast.error("Erro de conexão com o servidor");
				return Promise.reject(error);
			}
		}

		return Promise.reject(error);
	},
);
