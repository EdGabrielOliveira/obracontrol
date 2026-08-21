import { decimalLikeToNumber, isDecimalLike } from "./number-utils";

export function decimalToNumber(value: unknown): unknown {
	if (isDecimalLike(value)) {
		return decimalLikeToNumber(value);
	}
	if (value instanceof Date) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(decimalToNumber);
	}
	if (value !== null && typeof value === "object") {
		const converted: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			converted[k] = decimalToNumber(v);
		}
		return converted;
	}
	return value;
}
