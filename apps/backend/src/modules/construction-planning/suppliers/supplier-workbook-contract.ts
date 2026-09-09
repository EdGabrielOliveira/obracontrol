export const SUPPLIER_SHEET_NAME = "Fornecedores";

/** Headers shared by the supplier template, importer and exporter. */
export const SUPPLIER_WORKBOOK_HEADERS = [
	"Nome da empresa",
	"CNPJ",
	"Responsável",
	"CPF do responsável",
	"Contato",
	"Tipo PIX",
	"Chave PIX",
	"Codigo do banco",
	"Banco",
	"Agencia",
	"Conta",
	"Tipo de conta",
	"CEP",
	"Logradouro",
	"Numero",
	"Complemento",
	"Bairro",
	"Cidade",
	"UF",
	"Observacoes",
] as const;

export const SUPPLIER_SHEET_ALIASES = [
	SUPPLIER_SHEET_NAME,
	"Lista de Fornecedores",
] as const;
