import Decimal from "decimal.js";

export function roundCurrency(value: number): number {
	return new Decimal(value)
		.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
		.toNumber();
}
