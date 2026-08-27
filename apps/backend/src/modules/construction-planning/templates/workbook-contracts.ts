export type WorkbookKind =
	| "obra-completa"
	| "orcamento"
	| "orcamento-aditivo"
	| "cronograma"
	| "medicao-obra"
	| "medicao-contrato"
	| "custos"
	| "cotacao"
	| "quotation-map";

export const WORKBOOK_KINDS: WorkbookKind[] = [
	"obra-completa",
	"orcamento",
	"orcamento-aditivo",
	"cronograma",
	"medicao-obra",
	"medicao-contrato",
	"custos",
	"cotacao",
	"quotation-map",
];

export type ColumnFormat = "text" | "number" | "currency" | "date" | "percent";

export interface ColumnDefinition {
	header: string;
	required: boolean;
	type: ColumnFormat;
	example: string | number | null;
	description: string;
	dependency?: string;
}

export interface SheetDefinition {
	name: string;
	headers: string[];
	columns: ColumnDefinition[];
	isDataSheet: boolean;
	formats?: string[];
}

export interface WorkbookDefinition {
	kind: WorkbookKind;
	sheets: SheetDefinition[];
	filename: string;
}

function defineSheet(
	name: string,
	columns: ColumnDefinition[],
	options?: { formats?: string[]; isDataSheet?: boolean },
): SheetDefinition {
	return {
		name,
		columns,
		headers: columns.map((column) => column.header),
		isDataSheet: options?.isDataSheet ?? true,
		formats: options?.formats,
	};
}

const text = (
	header: string,
	required: boolean,
	description: string,
	example: string | number | null = null,
	dependency?: string,
): ColumnDefinition => ({
	header,
	required,
	type: "text",
	example,
	description,
	dependency,
});

const number = (
	header: string,
	required: boolean,
	description: string,
	example: string | number | null = null,
	dependency?: string,
): ColumnDefinition => ({
	header,
	required,
	type: "number",
	example,
	description,
	dependency,
});

const currency = (
	header: string,
	required: boolean,
	description: string,
	example: string | number | null = null,
	dependency?: string,
): ColumnDefinition => ({
	header,
	required,
	type: "currency",
	example,
	description,
	dependency,
});

const date = (
	header: string,
	required: boolean,
	description: string,
	example: string | number | null = null,
	dependency?: string,
): ColumnDefinition => ({
	header,
	required,
	type: "date",
	example,
	description,
	dependency,
});

const percent = (
	header: string,
	required: boolean,
	description: string,
	example: string | number | null = null,
	dependency?: string,
): ColumnDefinition => ({
	header,
	required,
	type: "percent",
	example,
	description,
	dependency,
});

export const SHEET_DEFINITIONS = {
	GUIA: {
		name: "Guia",
		headers: [],
		columns: [],
		isDataSheet: false,
	} as SheetDefinition,
	OBRA: defineSheet(
		"Obra",
		[
			text("Campo", true, "Nome do campo de cadastro da obra"),
			text(
				"Valor",
				true,
				"Valor correspondente ao campo",
				"Ex.: Obra Demonstrativa",
			),
		],
		{ formats: ["text", "text"] },
	),
	ORCAMENTO: defineSheet(
		"Orcamento",
		[
			text("Índice", true, "Índice hierárquico do item (1, 1.1, 1.1.1)", "1.1"),
			text(
				"Tipo",
				true,
				"Tipo do item: ETAPA, SUBETAPA, COMPOSICAO, INSUMO ou ITEM",
				"ITEM",
				"Índice",
			),
			text(
				"Descrição",
				true,
				"Descrição do item do orçamento",
				"Fundação direta",
			),
			text("Unidade", false, "Unidade de medida (m2, m3, un, h)", "m3"),
			number("Quantidade", true, "Quantidade planejada do item", "100"),
			currency(
				"Mão de obra unitária",
				false,
				"Custo unitário de mão de obra (R$)",
				"85.5",
			),
			currency(
				"Material unitário",
				false,
				"Custo unitário de material (R$)",
				"120",
			),
			currency(
				"Equipamento unitário",
				false,
				"Custo unitário de equipamento (R$)",
				"45",
			),
			currency("Outros unitário", false, "Outros custos unitários (R$)", "0"),
			text(
				"Situação",
				false,
				"Situação do item (ATIVO, SUSPENSO ou IGNORADO)",
				"ATIVO",
			),
		],
		{
			formats: [
				"text",
				"text",
				"text",
				"text",
				"#,##0.00",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"text",
			],
		},
	),
	ITENS_DO_ORCAMENTO: defineSheet(
		"Itens do Orcamento",
		[
			text("Índice", true, "Índice hierárquico do item (1, 1.1, 1.1.1)", "1.1"),
			text(
				"Tipo",
				true,
				"Tipo do item: ETAPA, SUBETAPA, COMPOSICAO, INSUMO ou ITEM",
				"ITEM",
				"Índice",
			),
			text(
				"Descrição",
				true,
				"Descrição do item do orçamento",
				"Fundação direta",
			),
			text("Unidade", false, "Unidade de medida (m2, m3, un, h)", "m3"),
			number("Quantidade", true, "Quantidade planejada do item", "100"),
			currency(
				"Mão de obra unitária",
				false,
				"Custo unitário de mão de obra (R$)",
				"85.5",
			),
			currency(
				"Material unitário",
				false,
				"Custo unitário de material (R$)",
				"120",
			),
			currency(
				"Equipamento unitário",
				false,
				"Custo unitário de equipamento (R$)",
				"45",
			),
			currency("Outros unitário", false, "Outros custos unitários (R$)", "0"),
			text(
				"Situação",
				false,
				"Situação do item (ATIVO, SUSPENSO ou IGNORADO)",
				"ATIVO",
			),
		],
		{
			formats: [
				"text",
				"text",
				"text",
				"text",
				"#,##0.00",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"text",
			],
		},
	),
	CRONOGRAMA_ORIGINAL: defineSheet(
		"Cronograma Original",
		[
			text(
				"Índice",
				true,
				"Índice do item do orçamento no cronograma",
				"1.1",
				"Orçamento",
			),
			text(
				"Nome do item",
				false,
				"Descrição preenchida a partir do item do orçamento; use o Índice para o vínculo",
				"Fundação direta",
				"Orçamento",
			),
			date(
				"Início previsto",
				true,
				"Data de início planejada (dd/mm/aaaa)",
				"2026-01-01",
			),
			date(
				"Fim previsto",
				true,
				"Data de término planejada (dd/mm/aaaa)",
				"2026-03-31",
				"Início previsto",
			),
			percent(
				"Peso planejado opcional",
				false,
				"Peso do item no planejamento (0 a 100%)",
				"10%",
			),
		],
		{ formats: ["text", "text", "dd/mm/yyyy", "dd/mm/yyyy", "0%"] },
	),
	REPLANEJAMENTO: defineSheet(
		"Replanejamento",
		[
			text(
				"Índice",
				true,
				"Índice do item replanejado",
				"1.1",
				"Cronograma Original",
			),
			text(
				"Versão do replanejamento",
				false,
				"Versão da revisão (opcional)",
				"1",
			),
			date(
				"Início replanejado",
				true,
				"Nova data de início (dd/mm/aaaa)",
				"2026-02-15",
			),
			date(
				"Fim replanejado",
				true,
				"Nova data de término (dd/mm/aaaa)",
				"2026-04-30",
				"Início replanejado",
			),
			date(
				"Data da revisão",
				false,
				"Data da revisão (dd/mm/aaaa)",
				"2026-02-01",
			),
			text(
				"Motivo",
				false,
				"Motivo da revisão",
				"Atraso na liberação da frente",
			),
		],
		{
			formats: [
				"text",
				"text",
				"dd/mm/yyyy",
				"dd/mm/yyyy",
				"dd/mm/yyyy",
				"text",
			],
		},
	),
	MEDICOES_OBRA: defineSheet(
		"Medicoes Obra",
		[
			text(
				"Índice",
				true,
				"Índice do item do orçamento medido (identidade do item)",
				"1.1",
				"Orçamento",
			),
			text(
				"Nome do item",
				false,
				"Descrição do item do orçamento vinculado ao índice",
				"Fundação direta",
				"Orçamento",
			),
			date(
				"Data da medição",
				true,
				"Data da medição (dd/mm/aaaa)",
				"2026-01-31",
			),
			percent(
				"Percentual medido acumulado",
				true,
				"Percentual acumulado medido até a data (0 a 100%)",
				0.3,
			),
			number(
				"Quantidade medida acumulada",
				false,
				"Quantidade acumulada medida do item",
				"30",
			),
			text(
				"Observação",
				false,
				"Observação da medição",
				"Medição parcial da etapa",
			),
		],
		{ formats: ["text", "text", "dd/mm/yyyy", "0%", "#,##0.00", "text"] },
	),
	ORCAMENTO_REFERENCIA: defineSheet(
		"Orçamento",
		[
			text(
				"Índice",
				false,
				"Índice do item vigente que deve ser usado na aba Medições de Obra",
				"1.1",
			),
			text(
				"Nome do item",
				false,
				"Nome/descrição do item correspondente ao índice",
				"Fundação direta",
			),
		],
		{ formats: ["text", "text"], isDataSheet: false },
	),
	CONTRATO: defineSheet(
		"Contrato",
		[
			text("Código", true, "Código do contrato", "C-001"),
			text("Fornecedor", true, "Nome do fornecedor", "Fornecedor Alfa Ltda"),
			currency("Valor do Contrato", true, "Valor contratado (R$)", "250000"),
			text("Tipo de Serviço", false, "Tipo de serviço do contrato", "SERVICO"),
			text("Título", false, "Título do contrato", "Fundações e estrutura"),
			date(
				"Início",
				false,
				"Data de início do contrato (dd/mm/aaaa)",
				"2026-02-01",
			),
			date(
				"Fim",
				false,
				"Data de término do contrato (dd/mm/aaaa)",
				"2026-12-31",
			),
			text(
				"Situação",
				false,
				"Situação do contrato (EM_ANDAMENTO, FINALIZADO...)",
				"EM_ANDAMENTO",
			),
			text("Observações", false, "Observações do contrato"),
		],
		{
			formats: [
				"text",
				"text",
				"'R$ #,##0.00'",
				"text",
				"text",
				"dd/mm/yyyy",
				"dd/mm/yyyy",
				"text",
				"text",
			],
		},
	),
	// Mapa de cotacao minimo do fluxo de solicitacao de contratacao
	// (spec solicitacao-contratacao-comparativos): CNPJ, nome e valor total
	// sao obrigatorios; codigo da cotacao e indicacao de vencedor sao
	// informacoes nao vinculantes.
	MAPA_COTACAO_MINIMO: defineSheet(
		"Mapa de Cotacao",
		[
			text(
				"CNPJ",
				true,
				"CNPJ do fornecedor",
				"11.222.333/0001-81",
				"Fornecedor",
			),
			text(
				"Razão Social",
				true,
				"Razão social ou nome empresarial",
				"Construtora Modelo Ltda.",
				"Fornecedor",
			),
			currency(
				"Valor Total da Proposta",
				true,
				"Valor total ofertado em reais",
				"35000",
				"Proposta",
			),
			text(
				"Observações",
				false,
				"Informações adicionais da proposta",
				"Prazo negociável",
				"Proposta",
			),
			text(
				"Código da Cotação",
				false,
				"Identificação externa da cotação (não vinculante)",
				"CT-2026-001",
				"Proposta",
			),
			text(
				"Indicado Vencedor",
				false,
				"Indicação não vinculante de vencedor",
				"SIM",
				"Proposta",
			),
		],
		{
			formats: ["text", "text", "'R$ #,##0.00'", "text", "text", "text"],
			isDataSheet: true,
		},
	),
	// IMP-003 (DEC-002/003): mapa de cotacao de empreitada — propostas de ate
	// 3 fornecedores (padrao) com dados comerciais, de contato e de servico,
	// para comparativo e negociacao antes da contratacao.
	MAPA_COTACAO: defineSheet(
		"Mapa de Cotacao",
		[
			text(
				"CNPJ",
				true,
				"CNPJ do fornecedor",
				"11.222.333/0001-81",
				"Fornecedor",
			),
			text(
				"Razão Social",
				true,
				"Razão social ou nome empresarial",
				"Construtora Modelo Ltda.",
				"Fornecedor",
			),
			text(
				"Endereço Completo",
				false,
				"Endereço completo do fornecedor",
				"Rua das Palmeiras, 250, Centro",
				"Fornecedor",
			),
			text(
				"Telefone",
				false,
				"Telefone de contato",
				"(83) 99999-1234",
				"Fornecedor",
			),
			text(
				"E-mail",
				false,
				"E-mail de contato",
				"contato@modelo.com.br",
				"Fornecedor",
			),
			text(
				"Responsável",
				false,
				"Pessoa responsável pelo contato",
				"João Silva",
				"Fornecedor",
			),
			text(
				"Descrição do Serviço",
				false,
				"Serviço ou empreitada ofertada",
				"Execução de alvenaria e reboco",
				"Serviço",
			),
			currency(
				"Valor do Serviço",
				true,
				"Valor total do serviço em reais",
				"35000",
				"Serviço",
			),
			date(
				"Data de Início",
				false,
				"Data de início ofertada",
				"2026-09-01",
				"Serviço",
			),
			number(
				"Prazo de Execução",
				false,
				"Prazo ofertado em dias",
				"90",
				"Serviço",
			),
			text(
				"Condição de Pagamento",
				false,
				"Condição comercial de pagamento",
				"30/60/90 dias",
				"Comercial",
			),
			text(
				"Observações",
				false,
				"Informações adicionais da proposta",
				"Prazo negociável",
				"Comercial",
			),
		],
		{
			formats: [
				"text",
				"text",
				"text",
				"text",
				"text",
				"text",
				"text",
				"'R$ #,##0.00'",
				"dd/mm/yyyy",
				"text",
				"text",
				"text",
			],
		},
	),
	FORNECEDORES: defineSheet(
		"Lista de Fornecedores",
		[
			text(
				"CNPJ/Documento",
				true,
				"Documento do fornecedor",
				"11.222.333/0001-81",
			),
			text(
				"Razão Social",
				true,
				"Nome empresarial ou nome do fornecedor",
				"Construtora Modelo Ltda.",
			),
			text(
				"Contato",
				false,
				"Telefone ou e-mail principal",
				"contato@modelo.com.br",
			),
			text("Status", false, "Status cadastral do fornecedor", "ATIVO"),
		],
		{ formats: ["text", "text", "text", "text"] },
	),
	SERVICOS: defineSheet(
		"Servicos",
		[
			text(
				"Índice",
				true,
				"Índice do serviço (hierárquico)",
				"1.1",
				"Contrato",
			),
			number("Quantidade", true, "Quantidade do serviço", "120"),
			currency("Custo Unitário", true, "Custo unitário do serviço (R$)", "65"),
		],
		{
			formats: ["text", "#,##0.00", "'R$ #,##0.00'"],
		},
	),
	MEDICOES_CONTRATO: defineSheet(
		"Medicoes Contrato",
		[
			text("Nº", false, "Número da medição (opcional; auto quando vazio)", "1"),
			date(
				"Data",
				true,
				"Data da medição do contrato (dd/mm/aaaa)",
				"2026-01-31",
			),
			text("Título", false, "Título da medição", "Medição 1 - Janeiro"),
			text("Situação", false, "Situação da medição", "EM_APROVACAO"),
			currency("Desconto", false, "Valor de desconto (R$)", "0"),
			currency("Retenção", false, "Valor de retenção (R$)", "5000"),
			currency(
				"Valor de impostos",
				false,
				"Valor de impostos da medição (R$)",
				"1000",
			),
			text("Observações", false, "Observações da medição"),
		],
		{
			formats: [
				"text",
				"dd/mm/yyyy",
				"text",
				"text",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"text",
			],
		},
	),
	PAGAMENTOS: defineSheet(
		"Pagamentos",
		[
			date("Data", true, "Data do pagamento (dd/mm/aaaa)", "2026-02-15"),
			currency("Valor", true, "Valor do pagamento (R$)", "50000"),
			currency("Valor Pago", false, "Valor efetivamente pago (R$)", "50000"),
			text("Descrição", false, "Descrição do pagamento", "Fatura 1"),
			currency("Retenção", false, "Valor de retenção (R$)", "0"),
			currency("Desconto", false, "Valor de desconto (R$)", "0"),
			text(
				"Situação",
				false,
				"Situação do pagamento (EM_ABERTO ou PAGO)",
				"PAGO",
			),
		],
		{
			formats: [
				"dd/mm/yyyy",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"text",
				"'R$ #,##0.00'",
				"'R$ #,##0.00'",
				"text",
			],
		},
	),
	CUSTOS_REALIZADOS: defineSheet(
		"Custos Realizados",
		[
			date(
				"Data do lançamento",
				true,
				"Data do lançamento do custo (dd/mm/aaaa)",
				"2026-01-31",
			),
			text(
				"Índice apropriado",
				true,
				"Índice do item de orçamento apropriado",
				"1.1",
				"Orçamento",
			),
			text(
				"Nome do item do orçamento",
				false,
				"Descrição do item vinculado ao Índice apropriado",
				"Fundação direta",
				"Orçamento",
			),
			text("Categoria", false, "Categoria do custo", "MATERIAL"),
			text("Descrição", true, "Descrição do custo", "Compra de cimento"),
			currency(
				"Valor realizado",
				true,
				"Valor do custo realizado (R$)",
				"12000",
			),
			text("Tipo", false, "Tipo do custo (Atual ou Futuro)", "Atual"),
			text(
				"Documento origem",
				false,
				"Documento de origem (NF, recibo)",
				"NF 12345",
			),
			text(
				"Fornecedor/Favorecido",
				false,
				"Fornecedor ou favorecido do custo",
				"Cimento Brasil",
			),
			text("Grupo de custo", false, "Grupo de custo", "MATERIAIS"),
			text(
				"Situação do pagamento",
				false,
				"Situação do pagamento (PAGO ou EM_ABERTO)",
				"PAGO",
			),
			date(
				"Data de competência",
				false,
				"Data de competência (dd/mm/aaaa)",
				"2026-01-31",
			),
			date(
				"Data de vencimento",
				false,
				"Data de vencimento (dd/mm/aaaa)",
				"2026-02-28",
			),
			date(
				"Data de pagamento",
				false,
				"Data de pagamento (dd/mm/aaaa)",
				"2026-03-01",
			),
			text("Número do documento", false, "Número do documento"),
		],
		{
			formats: [
				"dd/mm/yyyy",
				"text",
				"text",
				"text",
				"text",
				"'R$ #,##0.00'",
				"text",
				"text",
				"text",
				"text",
				"text",
				"dd/mm/yyyy",
				"dd/mm/yyyy",
				"dd/mm/yyyy",
				"text",
			],
		},
	),
} as const;

export const WORKBOOK_DEFINITIONS: Record<WorkbookKind, WorkbookDefinition> = {
	"obra-completa": {
		kind: "obra-completa",
		filename: "modelo-obra-completa.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.OBRA,
			SHEET_DEFINITIONS.ORCAMENTO,
			SHEET_DEFINITIONS.ITENS_DO_ORCAMENTO,
			SHEET_DEFINITIONS.CRONOGRAMA_ORIGINAL,
			SHEET_DEFINITIONS.REPLANEJAMENTO,
			SHEET_DEFINITIONS.MEDICOES_OBRA,
			SHEET_DEFINITIONS.CONTRATO,
			SHEET_DEFINITIONS.SERVICOS,
			SHEET_DEFINITIONS.MEDICOES_CONTRATO,
			SHEET_DEFINITIONS.PAGAMENTOS,
			SHEET_DEFINITIONS.CUSTOS_REALIZADOS,
			SHEET_DEFINITIONS.MAPA_COTACAO,
			SHEET_DEFINITIONS.FORNECEDORES,
		],
	},
	cotacao: {
		kind: "cotacao",
		filename: "modelo-cotacao.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.MAPA_COTACAO,
			SHEET_DEFINITIONS.FORNECEDORES,
		],
	},
	"quotation-map": {
		kind: "quotation-map",
		filename: "modelo-mapa-cotacao.xlsx",
		sheets: [SHEET_DEFINITIONS.GUIA, SHEET_DEFINITIONS.MAPA_COTACAO],
	},
	orcamento: {
		kind: "orcamento",
		filename: "modelo-orcamento.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.ORCAMENTO,
			SHEET_DEFINITIONS.CRONOGRAMA_ORIGINAL,
		],
	},
	"orcamento-aditivo": {
		kind: "orcamento-aditivo",
		filename: "modelo-orcamento-aditivo.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.ORCAMENTO,
			SHEET_DEFINITIONS.CRONOGRAMA_ORIGINAL,
		],
	},
	cronograma: {
		kind: "cronograma",
		filename: "modelo-cronograma.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.CRONOGRAMA_ORIGINAL,
			SHEET_DEFINITIONS.REPLANEJAMENTO,
		],
	},
	"medicao-obra": {
		kind: "medicao-obra",
		filename: "modelo-medicao-obra.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.MEDICOES_OBRA,
			SHEET_DEFINITIONS.ORCAMENTO_REFERENCIA,
		],
	},
	"medicao-contrato": {
		kind: "medicao-contrato",
		filename: "modelo-medicao-contrato.xlsx",
		sheets: [
			SHEET_DEFINITIONS.GUIA,
			SHEET_DEFINITIONS.CONTRATO,
			SHEET_DEFINITIONS.SERVICOS,
			SHEET_DEFINITIONS.MEDICOES_CONTRATO,
			SHEET_DEFINITIONS.PAGAMENTOS,
		],
	},
	custos: {
		kind: "custos",
		filename: "modelo-custos.xlsx",
		sheets: [SHEET_DEFINITIONS.GUIA, SHEET_DEFINITIONS.CUSTOS_REALIZADOS],
	},
};
