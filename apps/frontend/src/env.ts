export function normalizeServerUrl(value: string | undefined): string {
	return value?.replace(/\/+$/, "") ?? "";
}

// O valor vazio mantém as chamadas same-origin através do Nginx. Quando a API
// usa um domínio público separado, o argumento de build passa a ser respeitado.
export const SERVER_URL = normalizeServerUrl(import.meta.env.VITE_SERVER_URL);
