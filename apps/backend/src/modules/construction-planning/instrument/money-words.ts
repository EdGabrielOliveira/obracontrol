const units = [
	"zero",
	"um",
	"dois",
	"três",
	"quatro",
	"cinco",
	"seis",
	"sete",
	"oito",
	"nove",
];
const teens = [
	"dez",
	"onze",
	"doze",
	"treze",
	"quatorze",
	"quinze",
	"dezesseis",
	"dezessete",
	"dezoito",
	"dezenove",
];
const tens = [
	"",
	"",
	"vinte",
	"trinta",
	"quarenta",
	"cinquenta",
	"sessenta",
	"setenta",
	"oitenta",
	"noventa",
];
const hundreds = [
	"",
	"cento",
	"duzentos",
	"trezentos",
	"quatrocentos",
	"quinhentos",
	"seiscentos",
	"setecentos",
	"oitocentos",
	"novecentos",
];

function underThousand(value: number): string {
	if (value < 10) return units[value];
	if (value < 20) return teens[value - 10];
	if (value < 100)
		return (
			tens[Math.floor(value / 10)] +
			(value % 10 ? ` e ${units[value % 10]}` : "")
		);
	if (value === 100) return "cem";
	return (
		hundreds[Math.floor(value / 100)] +
		(value % 100 ? ` e ${underThousand(value % 100)}` : "")
	);
}

export function numberToPortuguese(value: number): string {
	const integer = Math.floor(Math.abs(value));
	if (integer < 1000) return underThousand(integer);
	if (integer < 1_000_000) {
		const thousands = Math.floor(integer / 1000);
		const rest = integer % 1000;
		return `${thousands === 1 ? "mil" : `${underThousand(thousands)} mil`}${rest ? ` e ${underThousand(rest)}` : ""}`;
	}
	const millions = Math.floor(integer / 1_000_000);
	const rest = integer % 1_000_000;
	return `${millions === 1 ? "um milhão" : `${underThousand(millions)} milhões`}${rest ? ` e ${numberToPortuguese(rest)}` : ""}`;
}

export function moneyToPortuguese(value: number): string {
	const cents = Math.round(Math.abs(value) * 100);
	const reais = Math.floor(cents / 100);
	const centavos = cents % 100;
	const realLabel = reais === 1 ? "real" : "reais";
	const parts = [`${numberToPortuguese(reais)} ${realLabel}`];
	if (centavos)
		parts.push(
			`${numberToPortuguese(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`,
		);
	return parts.join(" e ");
}
