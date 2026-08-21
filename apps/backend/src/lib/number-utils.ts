import Decimal from "decimal.js";

export function isDecimalLike(value: unknown): boolean {
	if (value instanceof Decimal) return true;
	if (value === null || typeof value !== "object") return false;
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.s === "number" &&
		typeof obj.e === "number" &&
		Array.isArray(obj.d)
	);
}

export function decimalLikeToNumber(value: unknown): number {
	if (value instanceof Decimal) return value.toNumber();
	const obj = value as { s: number; e: number; d: number[] };
	const digits = obj.d
		.map((chunk, index) =>
			index === 0 ? String(chunk) : String(chunk).padStart(7, "0"),
		)
		.join("");
	const exponent = obj.e - digits.length + 1;
	const raw = obj.s * Number(digits) * 10 ** exponent;
	return Number(raw.toPrecision(15));
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
	if (value === null || value === undefined || value === "") return fallback;
	const converted = isDecimalLike(value)
		? decimalLikeToNumber(value)
		: Number(value);
	return Number.isFinite(converted) ? converted : fallback;
}

export function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	return toFiniteNumber(value);
}

export function assertJsonFinancialSafe(value: unknown): void {
	if (isDecimalLike(value))
		throw new Error("Decimal-like object leaked into JSON payload");
	if (typeof value === "number" && !Number.isFinite(value)) {
		throw new Error("Non-finite number leaked into JSON payload");
	}
	if (Array.isArray(value)) {
		for (const item of value) assertJsonFinancialSafe(item);
		return;
	}
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value as Record<string, unknown>)) {
			assertJsonFinancialSafe(child);
		}
	}
}
