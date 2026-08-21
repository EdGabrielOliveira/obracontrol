import { toFiniteNumber } from "./number-utils";

export function toNum(v: unknown): number {
	return toFiniteNumber(v);
}
