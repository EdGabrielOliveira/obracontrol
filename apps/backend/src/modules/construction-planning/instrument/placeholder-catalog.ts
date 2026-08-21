import { ConstructionError } from "../../../lib/errors";

export type InstrumentPlaceholder = {
	name: string;
	required: boolean;
	type: "TEXT" | "DATE" | "MONEY" | "TABLE";
};

export const INSTRUMENT_PLACEHOLDER_CATALOG_VERSION = "2";

export const instrumentPlaceholderCatalog: readonly InstrumentPlaceholder[] = [
	{ name: "empresa.nome", required: true, type: "TEXT" },
	{ name: "obra.nome", required: true, type: "TEXT" },
	{ name: "contrato.codigo", required: true, type: "TEXT" },
	{ name: "contrato.valor", required: true, type: "MONEY" },
	{ name: "contrato.valor_extenso", required: false, type: "TEXT" },
	{ name: "contrato.objeto", required: false, type: "TEXT" },
	{ name: "contrato.atividades", required: false, type: "TABLE" },
	{ name: "contrato.multa", required: false, type: "MONEY" },
	{ name: "contrato.multa_extenso", required: false, type: "TEXT" },
	{ name: "contrato.inicio", required: false, type: "DATE" },
	{ name: "contrato.fim", required: false, type: "DATE" },
	{ name: "fornecedor.nome", required: true, type: "TEXT" },
	{ name: "fornecedor.documento", required: false, type: "TEXT" },
	{ name: "fornecedor.endereco", required: false, type: "TEXT" },
	{ name: "fornecedor.responsavel_nome", required: false, type: "TEXT" },
	{ name: "fornecedor.responsavel_cpf", required: false, type: "TEXT" },
	{ name: "fornecedor.contato", required: false, type: "TEXT" },
	{ name: "obra.endereco", required: false, type: "TEXT" },
	{ name: "data.emissao", required: false, type: "DATE" },
	{ name: "empresa.foro", required: false, type: "TEXT" },
];

const catalogByName = new Map(
	instrumentPlaceholderCatalog.map((placeholder) => [
		placeholder.name,
		placeholder,
	]),
);

export function resolveInstrumentPlaceholders(
	values: Readonly<Record<string, string | number | null | undefined>>,
): Record<string, string> {
	const resolved: Record<string, string> = {};
	for (const placeholder of instrumentPlaceholderCatalog) {
		const value = values[placeholder.name];
		if (value == null || String(value).trim() === "") {
			if (placeholder.required) {
				throw new ConstructionError(
					"INSTRUMENT_PLACEHOLDER_REQUIRED",
					`Valor obrigatorio ausente: ${placeholder.name}`,
					422,
				);
			}
			continue;
		}
		resolved[placeholder.name] = String(value);
	}
	for (const key of Object.keys(values)) {
		if (!catalogByName.has(key)) {
			throw new ConstructionError(
				"INSTRUMENT_PLACEHOLDER_UNKNOWN",
				`Placeholder desconhecido: ${key}`,
				422,
			);
		}
	}
	return resolved;
}
