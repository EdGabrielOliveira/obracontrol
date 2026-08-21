export type ReferenceFieldStatus =
	| "AVAILABLE"
	| "UNAVAILABLE"
	| "PENDING_DEFINITION";

export type ReferenceMacroCase = {
	id: string;
	source: {
		kind: "BASE_UNICA_BD" | "AUDIT_RISK";
		excelRow?: number;
		originRow?: number;
		field?: string;
		literal?: string;
	};
	month: string;
	monthRef: string;
	state: string;
	project: string;
	totvsKey: string | null;
	metaMonthly: number | null;
	produced: number | null;
	billed: number | null;
	expenses: number | null;
	ceiling: number | null;
	referenceResult: number | null;
	referenceProducedNotBilled: number | null;
	measurementAvailable: boolean;
	expected: {
		producedNotBilled: {
			status: ReferenceFieldStatus;
			value: number | null;
			reason?: string;
		};
		resultCalculated: {
			status: ReferenceFieldStatus;
			value: number | null;
			reason?: string;
		};
		metaAttainment: {
			status: ReferenceFieldStatus;
			value: number | null;
			reason?: string;
		};
		measurement: {
			status: ReferenceFieldStatus;
			value: number | null;
			reason?: string;
		};
	};
};

export const referenceWorkbookMetadata = {
	path: "Novas anotações/referencia de dados e calculos micro macro.xlsx",
	baseSheet: "BASE_UNICA_BD",
	validationSheet: "RESUMO_VALIDACAO",
	dictionarySheet: "DICIONARIO",
	meetingNotesPath: "Novas anotações/atotações reunião 31-07.txt",
	meetingNotesStatus: "EMPTY" as const,
} as const;

export const referenceValidationSummary = [
	{
		month: "2026-01",
		projectCount: 60,
		produced: 13043012.15,
		billed: 16581860.18,
		expenses: 9846613.82,
		calculatedResult: 3196398.33,
	},
	{
		month: "2026-02",
		projectCount: 59,
		produced: 15603774.5,
		billed: 15724166.59,
		expenses: -9732171.34,
		calculatedResult: 25335945.84,
	},
] as const;

const pendingBecauseFormulaIsNotApproved =
	"Formula da referência ainda depende de decisão de produto";

export const referenceMacroCases: readonly ReferenceMacroCase[] = [
	{
		id: "base-jan-pb-seect-item-1",
		source: {
			kind: "BASE_UNICA_BD",
			excelRow: 10,
			originRow: 26,
		},
		month: "Jan/26",
		monthRef: "2026-01",
		state: "PARAÍBA",
		project: "SEECT PB ITEM 1",
		totvsKey: "202010101003",
		metaMonthly: 1200000,
		produced: 1756570.34,
		billed: 1659811.49,
		expenses: 1054168.43,
		ceiling: 420000,
		referenceResult: 702401.91,
		referenceProducedNotBilled: 96758.85,
		measurementAvailable: false,
		expected: {
			producedNotBilled: {
				status: "PENDING_DEFINITION",
				value: 96758.85,
				reason: pendingBecauseFormulaIsNotApproved,
			},
			resultCalculated: {
				status: "PENDING_DEFINITION",
				value: 702401.91,
				reason: pendingBecauseFormulaIsNotApproved,
			},
			metaAttainment: {
				status: "AVAILABLE",
				value: 1756570.34 / 1200000,
			},
			measurement: {
				status: "UNAVAILABLE",
				value: null,
				reason: "A fonte macro não contém medição de item do orçamento",
			},
		},
	},
	{
		id: "base-jan-pb-seect-item-3-meta-zero",
		source: {
			kind: "BASE_UNICA_BD",
			excelRow: 12,
			originRow: 28,
		},
		month: "Jan/26",
		monthRef: "2026-01",
		state: "PARAÍBA",
		project: "SEECT PB ITEM 3",
		totvsKey: "202010102003",
		metaMonthly: 0,
		produced: 42696.15,
		billed: 0,
		expenses: 463679.83,
		ceiling: 0,
		referenceResult: -420983.68,
		referenceProducedNotBilled: 42696.15,
		measurementAvailable: false,
		expected: {
			producedNotBilled: {
				status: "PENDING_DEFINITION",
				value: 42696.15,
				reason: pendingBecauseFormulaIsNotApproved,
			},
			resultCalculated: {
				status: "PENDING_DEFINITION",
				value: -420983.68,
				reason: pendingBecauseFormulaIsNotApproved,
			},
			metaAttainment: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Meta mensal igual a zero",
			},
			measurement: {
				status: "UNAVAILABLE",
				value: null,
				reason: "A fonte macro não contém medição de item do orçamento",
			},
		},
	},
	{
		id: "base-fev-mg-negative-expenses",
		source: {
			kind: "BASE_UNICA_BD",
			excelRow: 63,
			originRow: 68,
		},
		month: "Fev/26",
		monthRef: "2026-02",
		state: "MINAS GERAIS",
		project: "SMOBI BH - CENTRO-SUL",
		totvsKey: "202050101004",
		metaMonthly: 0,
		produced: 0,
		billed: 0,
		expenses: -15,
		ceiling: 0,
		referenceResult: 15,
		referenceProducedNotBilled: 0,
		measurementAvailable: false,
		expected: {
			producedNotBilled: {
				status: "PENDING_DEFINITION",
				value: 0,
				reason: pendingBecauseFormulaIsNotApproved,
			},
			resultCalculated: {
				status: "PENDING_DEFINITION",
				value: 15,
				reason:
					"A referência contém gasto negativo; sinal contábil ainda não foi aprovado",
			},
			metaAttainment: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Meta mensal igual a zero",
			},
			measurement: {
				status: "UNAVAILABLE",
				value: null,
				reason: "A fonte macro não contém medição de item do orçamento",
			},
		},
	},
	{
		id: "base-jan-pb-project-without-totvs",
		source: {
			kind: "BASE_UNICA_BD",
			excelRow: 9,
			originRow: 30,
		},
		month: "Jan/26",
		monthRef: "2026-01",
		state: "PARAÍBA",
		project: "SEDUC - PB",
		totvsKey: null,
		metaMonthly: null,
		produced: null,
		billed: 0,
		expenses: null,
		ceiling: null,
		referenceResult: 0,
		referenceProducedNotBilled: 0,
		measurementAvailable: false,
		expected: {
			producedNotBilled: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Produzido ausente na fonte",
			},
			resultCalculated: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Produzido ou gastos ausentes na fonte",
			},
			metaAttainment: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Meta mensal ausente na fonte",
			},
			measurement: {
				status: "UNAVAILABLE",
				value: null,
				reason: "A fonte macro não contém medição de item do orçamento",
			},
		},
	},
	{
		id: "audit-source-na",
		source: {
			kind: "AUDIT_RISK",
			field: "Meta_Mensal",
			literal: "#N/A",
		},
		month: "2026-01",
		monthRef: "2026-01",
		state: "UNKNOWN",
		project: "SOURCE_ERROR",
		totvsKey: null,
		metaMonthly: null,
		produced: null,
		billed: null,
		expenses: null,
		ceiling: null,
		referenceResult: null,
		referenceProducedNotBilled: null,
		measurementAvailable: false,
		expected: {
			producedNotBilled: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Valor #N/A da fonte não pode ser convertido para zero",
			},
			resultCalculated: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Valor #N/A da fonte não pode ser convertido para zero",
			},
			metaAttainment: {
				status: "UNAVAILABLE",
				value: null,
				reason: "Valor #N/A da fonte não pode ser convertido para zero",
			},
			measurement: {
				status: "UNAVAILABLE",
				value: null,
				reason: "A fonte macro não contém medição de item do orçamento",
			},
		},
	},
];
