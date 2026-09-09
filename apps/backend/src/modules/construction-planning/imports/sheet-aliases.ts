import { SUPPLIER_SHEET_ALIASES } from "../suppliers/supplier-workbook-contract";

export const SHEET_NAME_ALIASES: Record<string, string[]> = {
	"Medicoes Obra": [
		"Medições de Obra",
		"Medicoes Obra",
		"Medicoes",
		"Medições",
	],
	Orcamento: ["Orcamento", "Orçamento"],
	"Cronograma Original": ["Cronograma Original", "Cronograma"],
	"Itens do Orcamento": ["Itens do Orcamento", "Itens do Orçamento"],
	Fornecedores: [...SUPPLIER_SHEET_ALIASES],
};
