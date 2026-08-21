export const SENSITIVE_KEYS = [
	"password",
	"token",
	"secret",
	"apikey",
	"api_key",
	"keyhash",
	"document",
	"cpf",
	"cnpj",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

export function redact<T>(value: T, keys: string[] = SENSITIVE_KEYS): T {
	if (Array.isArray(value)) return value.map((v) => redact(v, keys)) as T;
	if (isPlainObject(value)) {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			result[k] = keys.includes(k.toLowerCase())
				? "[redacted]"
				: redact(v, keys);
		}
		return result as T;
	}
	return value;
}
