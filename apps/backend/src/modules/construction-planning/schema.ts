import { z } from "zod";
import { normalizeCostType } from "./imports/normalizers";

const legacyCostCategoryMap: Record<string, string> = {
	material: "MATERIAL",
	"mao de obra": "MAO_DE_OBRA",
	"mão de obra": "MAO_DE_OBRA",
	equipamento: "EQUIPAMENTO",
	transporte: "TRANSPORTE",
	servico: "SERVICO",
	serviço: "SERVICO",
	outros: "OUTROS",
};

export const actualCostCategoryEnum = z.enum([
	"MATERIAL",
	"MAO_DE_OBRA",
	"EQUIPAMENTO",
	"TRANSPORTE",
	"SERVICO",
	"OUTROS",
]);

export const actualCostCategorySchema = z.preprocess(
	(value) =>
		typeof value === "string"
			? (legacyCostCategoryMap[value.trim().toLowerCase()] ??
				value.trim().toUpperCase())
			: value,
	z
		.string()
		.refine(
			(value) => actualCostCategoryEnum.safeParse(value).success,
			"Categoria de custo inválida",
		),
);

export type ActualCostCategory = string;

export const actualCostTypeSchema = z.preprocess(
	(value) => normalizeCostType(typeof value === "string" ? value : undefined),
	z.enum(
		["CURRENT", "FUTURE"],
		"Tipo de custo invalido. Use ATUAL/CURRENT ou FUTURO/FUTURE",
	),
);

export type ActualCostType = z.infer<typeof actualCostTypeSchema>;

export const constructionItemStatusEnum = z.enum([
	"DRAFT",
	"NOT_STARTED",
	"IN_PROGRESS",
	"DONE",
	"SUSPENDED",
	"IGNORED",
]);

export const scheduleRiskEnum = z.enum([
	"AHEAD",
	"ON_TRACK",
	"BEHIND",
	"UNAVAILABLE",
]);
export const costRiskEnum = z.enum([
	"BELOW_COST",
	"ON_COST",
	"OVER_COST",
	"UNAVAILABLE",
]);

export const constructionWorksFilterSchema = z.object({
	q: z.string().max(100).optional(),
	status: constructionItemStatusEnum.optional(),
	scheduleRisk: scheduleRiskEnum.optional(),
	costRisk: costRiskEnum.optional(),
	costCenterId: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const idListQuerySchema = z.preprocess((value) => {
	if (typeof value === "string") {
		return value
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}
	if (Array.isArray(value)) return value;
	return undefined;
}, z.array(z.string().min(1)).optional());

export const constructionBIWorksFilterSchema = z.object({
	q: z.string().max(100).optional(),
	status: constructionItemStatusEnum.optional(),
	organizationIds: idListQuerySchema,
	costCenterIds: idListQuerySchema,
	workIds: idListQuerySchema,
	asOfDate: z.string().optional(),
});

export type ConstructionWorksFilter = z.infer<
	typeof constructionWorksFilterSchema
>;
export type ConstructionBIWorksFilter = z.infer<
	typeof constructionBIWorksFilterSchema
>;
export type ConstructionItemStatus = z.infer<typeof constructionItemStatusEnum>;
export type ScheduleRisk = z.infer<typeof scheduleRiskEnum>;
export type CostRisk = z.infer<typeof costRiskEnum>;

/** Statuses which are allowed to participate in the operational portfolio. */
export const operationalWorkStatusEnum = z.enum(["IN_PROGRESS"]);

export const createMeasurementSchema = z
	.object({
		index: z.string().min(1),
		title: z.string().trim().optional(),
		measurementDate: z.string().min(1),
		measuredPercentageAccumulated: z.number().min(0).max(100),
		measuredQuantityAccumulated: z.number().optional(),
		measuredValue: z.number().optional(),
		status: z.string().optional(),
		notes: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (!data.title?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["title"],
				message: "Descricao da medicao obrigatoria",
			});
		}
	});

export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;

export const actualCostAllocationSchema = z
	.object({
		budgetItemId: z.string().min(1, "Item de orçamento obrigatório"),
		percentage: z
			.number()
			.min(0, "Percentual deve estar entre 0 e 100")
			.max(100, "Percentual deve estar entre 0 e 100")
			.optional(),
		value: z
			.number()
			.positive("Valor de alocação deve ser positivo")
			.optional(),
	})
	.superRefine((data, ctx) => {
		const basisCount = [data.percentage, data.value].filter(
			(v) => v !== undefined,
		).length;
		if (basisCount === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["percentage"],
				message: "Informe uma base de alocação (percentual ou valor).",
			});
		}
		if (basisCount > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["percentage"],
				message: "Informe apenas uma base de alocação (percentual ou valor).",
			});
		}
	});

export type ActualCostAllocationInput = z.infer<
	typeof actualCostAllocationSchema
>;

export const createActualCostSchema = z
	.object({
		costDate: z.string().min(1),
		budgetVersionItemId: z.string().min(1).optional(),
		budgetIndex: z.string().optional(),
		category: actualCostCategorySchema,
		categoryDetail: z.string().trim().optional(),
		description: z.string().trim().optional(),
		amount: z.number().positive(),
		costType: actualCostTypeSchema,
		sourceDocument: z.string().optional(),
		supplierId: z.string().min(1).nullable().optional(),
		supplierName: z.string().optional(),
		costGroup: z.string().optional(),
		paymentStatus: z.enum(["PAID", "OPEN"]).default("OPEN"),
		allocations: z
			.array(actualCostAllocationSchema)
			.min(1, "Informe ao menos uma alocação de item de orçamento")
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.costType === "FUTURE" && data.paymentStatus !== "OPEN") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["paymentStatus"],
				message: "Custos futuros devem permanecer com pagamento em aberto",
			});
		}
		if (data.category === "OUTROS" && !data.categoryDetail?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["categoryDetail"],
				message: "Informe a categoria personalizada",
			});
		}
		if (!data.description?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["description"],
				message: "Descricao do custo obrigatoria",
			});
		}
		if (
			!data.budgetVersionItemId &&
			(!data.allocations || data.allocations.length === 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["budgetVersionItemId"],
				message: "Informe o item da versao vigente ou uma alocacao legada",
			});
		}
	});

export type CreateActualCostInput = z.infer<typeof createActualCostSchema>;

export type ImportActualCostRow = Omit<CreateActualCostInput, "allocations"> & {
	allocations?: ActualCostAllocationInput[];
};

export const updateActualCostSchema = z
	.object({
		costDate: z.string().optional(),
		budgetVersionItemId: z.string().min(1).optional(),
		budgetIndex: z.string().optional(),
		category: actualCostCategorySchema.optional(),
		categoryDetail: z.string().trim().optional(),
		description: z.string().optional(),
		amount: z.number().positive().optional(),
		costType: actualCostTypeSchema.optional(),
		sourceDocument: z.string().optional(),
		supplierId: z.string().min(1).nullable().optional(),
		supplierName: z.string().optional(),
		costGroup: z.string().optional(),
		paymentStatus: z.enum(["PAID", "OPEN"]).optional(),
		allocations: z.array(actualCostAllocationSchema).optional(),
	})
	.superRefine((data, ctx) => {
		if (
			data.costType === "FUTURE" &&
			data.paymentStatus !== undefined &&
			data.paymentStatus !== "OPEN"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["paymentStatus"],
				message: "Custos futuros devem permanecer com pagamento em aberto",
			});
		}
	});

export type UpdateActualCostInput = z.infer<typeof updateActualCostSchema>;

export const actualCostFilterSchema = z.object({
	q: z.string().max(100).optional(),
	category: z.string().optional(),
	supplierName: z.string().optional(),
	status: z.string().optional(),
	costType: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type ActualCostFilter = z.infer<typeof actualCostFilterSchema>;
