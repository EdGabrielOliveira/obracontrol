import type { Indicator } from "./metrics-core";

const UNAVAILABLE_MARGIN_DENOMINATOR = "MARGIN_DENOMINATOR_NOT_POSITIVE";
const UNAVAILABLE_NEGATIVE_AMOUNT = "NEGATIVE_AMOUNT_REVIEW";
const UNAVAILABLE_COMPETENCIA_DIVERGENTE = "COMPETENCIA_DIVERGENTE";
const UNAVAILABLE_MISSING_INPUT = "MISSING_INPUT";

function available(value: number, formula: string): Indicator<number> {
	return { status: "AVAILABLE", value, formula };
}

function unavailable(
	formula: string,
	unavailableReason: string,
): Indicator<number> {
	return {
		status: "UNAVAILABLE",
		value: null,
		formula,
		unavailableReason,
	};
}

const MARGIN_FORMULA =
	"(Valor_Orcado_Aprovado - Custo_Orcado_Elegivel) / Valor_Orcado_Aprovado";

export function calculateMargemBrutaOrcada(
	valorOrcadoAprovado: number | null,
	custoOrcadoElegivel: number | null,
): Indicator<number> {
	if (
		valorOrcadoAprovado === null ||
		valorOrcadoAprovado <= 0 ||
		custoOrcadoElegivel === null
	) {
		return unavailable(MARGIN_FORMULA, UNAVAILABLE_MARGIN_DENOMINATOR);
	}
	const value =
		(valorOrcadoAprovado - custoOrcadoElegivel) / valorOrcadoAprovado;
	return available(value, MARGIN_FORMULA);
}

const LUCRO_FORMULA = "produzido - gastos_elegiveis";

export function calculateLucroRealizado(
	produzido: number | null,
	gastosElegiveis: number | null,
): Indicator<number> {
	if (produzido === null || gastosElegiveis === null) {
		return unavailable(LUCRO_FORMULA, UNAVAILABLE_MISSING_INPUT);
	}
	if (gastosElegiveis < 0) {
		return unavailable(LUCRO_FORMULA, UNAVAILABLE_NEGATIVE_AMOUNT);
	}
	return available(produzido - gastosElegiveis, LUCRO_FORMULA);
}

const NAO_FATURADO_FORMULA = "produzido - faturado (mesma competencia)";

export function calculateProduzidoNaoFaturado(
	produzido: number | null,
	faturado: number | null,
	competenciasConsistentes: boolean,
): Indicator<number> {
	if (!competenciasConsistentes) {
		return unavailable(
			NAO_FATURADO_FORMULA,
			UNAVAILABLE_COMPETENCIA_DIVERGENTE,
		);
	}
	if (produzido === null || faturado === null) {
		return unavailable(NAO_FATURADO_FORMULA, UNAVAILABLE_MISSING_INPUT);
	}
	return available(produzido - faturado, NAO_FATURADO_FORMULA);
}

const META_FORMULA = "meta de resultado do periodo (BRL)";

export function validateMetaLucroBruto(meta: number | null): Indicator<number> {
	if (meta === null) {
		return unavailable(META_FORMULA, UNAVAILABLE_MISSING_INPUT);
	}
	return available(meta, META_FORMULA);
}

export type MonthlyFactDictionaryEntry = {
	key: string;
	label: string;
	unit: string;
	description: string;
	derived: boolean;
};

export const MONTHLY_FACT_KEY_DICTIONARY: MonthlyFactDictionaryEntry[] = [
	{
		key: "chaveTOTVS",
		label: "Chave TOTVS",
		unit: "texto",
		description:
			"Chave externa de integracao TOTVS; opcional na importacao (DEC-MET-005).",
		derived: false,
	},
	{
		key: "metaMensal",
		label: "Meta mensal",
		unit: "BRL",
		description: "Meta de resultado do periodo (DEC-MET-003).",
		derived: false,
	},
	{
		key: "produzido",
		label: "Produzido",
		unit: "BRL",
		description: "Producao do periodo, fonte oficial definida por DEC-MET-006.",
		derived: false,
	},
	{
		key: "faturado",
		label: "Faturado",
		unit: "BRL",
		description:
			"Valor faturado com competencia do mes de faturamento (DEC-MET-006).",
		derived: false,
	},
	{
		key: "produzidoNaoFaturado",
		label: "Produzido nao faturado",
		unit: "BRL",
		description:
			"Derivado: produzido - faturado, somente com mesma competencia (DEC-MET-006).",
		derived: true,
	},
	{
		key: "gastos",
		label: "Gastos",
		unit: "BRL",
		description: "Gastos do periodo; sinal da fonte preservado (DEC-MET-001).",
		derived: false,
	},
	{
		key: "gastoProducao",
		label: "Gasto de producao",
		unit: "BRL",
		description: "Gasto diretamente atribuido a producao.",
		derived: false,
	},
	{
		key: "teto",
		label: "Teto",
		unit: "BRL",
		description:
			"Orcamento aprovado como padrao; aditivo registrado quando houver (DEC-MET-008).",
		derived: false,
	},
	{
		key: "resultado",
		label: "Resultado",
		unit: "BRL",
		description: "Resultado do periodo; formula registrada na matriz DEC-MET.",
		derived: false,
	},
	{
		key: "margem",
		label: "Margem bruta orcada",
		unit: "%",
		description: "Derivado: margem bruta orcada (DEC-MET-002).",
		derived: true,
	},
	{
		key: "lucro",
		label: "Lucro bruto realizado",
		unit: "BRL",
		description: "Derivado: produzido - gastos elegiveis (DEC-MET-004).",
		derived: true,
	},
	{
		key: "previsaoFaturamento15",
		label: "Previsao de faturamento dia 15",
		unit: "BRL",
		description: "Previsao congelada com corte dia 15 do mes (DEC-MET-007).",
		derived: false,
	},
	{
		key: "previsaoFechamentoMedicao",
		label: "Previsao de fechamento",
		unit: "BRL",
		description:
			"Previsao congelada com corte no ultimo dia do mes (DEC-MET-007).",
		derived: false,
	},
	{
		key: "atingimento",
		label: "Atingimento",
		unit: "%",
		description: "Atingimento de meta; formula registrada na matriz DEC-MET.",
		derived: false,
	},
	{
		key: "pareto",
		label: "Pareto",
		unit: "%",
		description: "Participacao acumulada de itens relevantes.",
		derived: false,
	},
	{
		key: "pendencia",
		label: "Pendencia",
		unit: "texto",
		description: "Pendencia do periodo.",
		derived: false,
	},
	{
		key: "acao",
		label: "Acao",
		unit: "texto",
		description: "Acao planejada/executada do periodo.",
		derived: false,
	},
	{
		key: "responsavel",
		label: "Responsavel",
		unit: "texto",
		description: "Responsavel pela acao ou pelo fato.",
		derived: false,
	},
	{
		key: "dataPrevista",
		label: "Data prevista",
		unit: "data",
		description: "Data prevista para a acao.",
		derived: false,
	},
];

export type MacroQualityIssue = {
	code: string;
	severity: "HIGH" | "MEDIUM" | "LOW";
	message: string;
	metric?: string;
};

export type DerivedMacroValues = {
	derived: Record<string, Indicator<number>>;
	issues: MacroQualityIssue[];
};

const DERIVED_SOURCES: Record<
	string,
	{
		key: string;
		compute: (valores: Record<string, number | null>) => Indicator<number>;
	}
> = {
	margem: {
		key: "margem",
		compute: (valores) =>
			calculateMargemBrutaOrcada(
				valores.teto ?? null,
				valores.gastoProducao ?? null,
			),
	},
	lucro: {
		key: "lucro",
		compute: (valores) =>
			calculateLucroRealizado(
				valores.produzido ?? null,
				valores.gastos ?? null,
			),
	},
	produzidoNaoFaturado: {
		key: "produzidoNaoFaturado",
		compute: (valores) =>
			calculateProduzidoNaoFaturado(
				valores.produzido ?? null,
				valores.faturado ?? null,
				true,
			),
	},
};

const ISSUE_REASONS = new Set([
	UNAVAILABLE_NEGATIVE_AMOUNT,
	UNAVAILABLE_COMPETENCIA_DIVERGENTE,
]);

export function deriveMacroValues(
	valores: Record<string, number | null> | null,
): DerivedMacroValues {
	const source = valores ?? {};
	const derived: Record<string, Indicator<number>> = {};
	const issues: MacroQualityIssue[] = [];

	for (const spec of Object.values(DERIVED_SOURCES)) {
		const result = spec.compute(source);
		derived[spec.key] = result;
		if (
			result.status === "UNAVAILABLE" &&
			result.unavailableReason &&
			ISSUE_REASONS.has(result.unavailableReason)
		) {
			issues.push({
				code: result.unavailableReason,
				severity: "MEDIUM",
				message: `Indicador ${spec.key} indisponivel: ${result.unavailableReason}`,
				metric: spec.key,
			});
		}
	}

	return { derived, issues };
}
