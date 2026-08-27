import { z } from "zod";

export const contractStatusEnum = z.enum([
	"RASCUNHO",
	"A_INICIAR",
	"EM_ANDAMENTO",
	"PARALISADO",
	"FINALIZADO",
	"ARQUIVADO",
]);

export const paymentStatusEnum = z.enum(["EM_ABERTO", "PAGO"]);

export const contractServiceTypeEnum = z.enum([
	"ETAPA",
	"SUBETAPA",
	"COMPOSICAO",
	"INSUMO",
	"ITEM",
]);

export const createContractSchema = z
	.object({
		code: z.string().min(1),
		supplierName: z.string().min(1).optional(),
		supplierId: z.string().min(1).nullable().optional(),
		contractValue: z.number().positive(),
		serviceType: z.string().optional(),
		objectDescription: z
			.string()
			.trim()
			.min(1, "Descricao do contrato obrigatoria")
			.optional(),
		title: z.string().optional(),
		startDate: z
			.string()
			.optional()
			.refine(
				(v) => !v || !Number.isNaN(Date.parse(v)),
				"Data de inicio invalida.",
			),
		endDate: z
			.string()
			.optional()
			.refine(
				(v) => !v || !Number.isNaN(Date.parse(v)),
				"Data de fim invalida.",
			),
		status: contractStatusEnum.optional().default("RASCUNHO"),
		notes: z.string().optional(),

		services: z
			.array(
				z.object({
					budgetItemId: z.string().min(1),
					quantity: z.number().positive().optional(),
					unitCost: z.number().positive().optional(),
				}),
			)
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (!data.objectDescription?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["objectDescription"],
				message: "Descricao do contrato obrigatoria",
			});
		}
		if (data.supplierName === undefined && data.supplierId == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["supplierName"],
				message: "Informe supplierId ou supplierName.",
			});
		}
	});

export const updateContractSchema = z.object({
	serviceType: z.string().optional(),
	objectDescription: z
		.string()
		.trim()
		.min(1, "Objeto do contrato obrigatorio")
		.optional(),
	title: z.string().optional(),
	startDate: z
		.string()
		.optional()
		.refine(
			(v) => !v || !Number.isNaN(Date.parse(v)),
			"Data de inicio invalida.",
		),
	endDate: z
		.string()
		.optional()
		.refine((v) => !v || !Number.isNaN(Date.parse(v)), "Data de fim invalida."),
	status: contractStatusEnum.optional(),
	statusReason: z.string().max(1000).optional(),
});

export const quotationBudgetItemSchema = z.object({
	budgetItemId: z.string().min(1, "Item do orcamento obrigatorio"),
	quantity: z.number().finite().positive("Quantidade deve ser maior que zero"),
});

export const createQuotationSchema = z
	.object({
		serviceType: z.string().trim().optional(),
		title: z.string().trim().min(1, "Titulo obrigatorio"),
		observation: z.string().nullable().optional(),
		startDate: z.string().nullable().optional(),
		endDate: z.string().nullable().optional(),
		maxSuppliers: z.number().int().min(1).max(5).optional().default(3),
		items: z
			.array(quotationBudgetItemSchema)
			.min(1, "Selecione ao menos uma etapa ou item do orcamento"),
	})
	.superRefine((data, ctx) => {
		const ids = new Set<string>();
		for (const [index, item] of data.items.entries()) {
			if (ids.has(item.budgetItemId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["items", index, "budgetItemId"],
					message: "Item do orcamento duplicado",
				});
			}
			ids.add(item.budgetItemId);
		}
	});

export const contractFilterSchema = z.object({
	q: z.string().max(100).optional(),
	supplierName: z.string().optional(),
	serviceType: z.string().optional(),
	status: contractStatusEnum.optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const createContractServiceSchema = z.object({
	budgetItemId: z.string().min(1),
	quantity: z.number().optional(),
	unitCost: z.number().optional(),
	sortOrder: z.number().int().optional().default(0),
});

export const createContractServicesSchema = z.object({
	items: z.array(createContractServiceSchema).min(1),
});

export const contractServicePreviewSchema = z.object({
	budgetItemId: z.string().min(1),
	quantity: z.number().optional(),
	unitCost: z.number().optional(),
});

export const updateContractServiceSchema = z.object({
	budgetItemId: z.string().min(1).optional(),
	quantity: z.number().optional(),
	unitCost: z.number().optional(),
	sortOrder: z.number().int().optional(),
});

export const linkBudgetSchema = z.object({
	links: z
		.array(
			z.object({
				serviceId: z.string().min(1),
				budgetItemId: z.string().min(1),
			}),
		)
		.min(1),
});

export const measurementCoverageSchema = z.object({
	workMeasurementItemId: z.string().min(1),
	quantity: z.number().finite().positive(),
});

export const contractMeasurementItemSchema = z.object({
	serviceId: z.string().min(1),
	measuredQuantity: z.number().finite().positive("Quantidade deve ser maior que zero"),
	// Mantido apenas para leitura/importação de medições antigas; o cadastro
	// simplificado não solicita nem processa coberturas.
	coverages: z.array(measurementCoverageSchema).optional(),
});

const measurementDateString = z
	.string()
	.min(1, "Data obrigatoria")
	.refine((v) => !Number.isNaN(Date.parse(v)), "Data invalida.");

export const createContractMeasurementSchema = z.object({
	number: z.number().int().min(1).optional(),
	date: measurementDateString,
	title: z.string().trim().min(1, "Titulo obrigatorio"),
	notes: z.string().optional(),
	items: z.array(contractMeasurementItemSchema).min(1),
});

export const updateContractMeasurementSchema = z.object({
	title: z.string().trim().min(1, "Titulo obrigatorio").optional(),
	date: measurementDateString.optional(),
	notes: z.string().optional(),
	items: z
		.array(
			z.object({
				id: z.string().optional(),
				serviceId: z.string().min(1),
				measuredQuantity: z.number().finite().positive("Quantidade deve ser maior que zero"),
			}),
		)
		.optional(),
});

export const contractMeasurementFilterSchema = z.object({
	q: z.string().max(100).optional(),
	supplierName: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const createContractPaymentSchema = z.object({
	date: z.string().min(1),
	value: z.number().positive(),
	paidValue: z.number(),
	measurementId: z.string().optional(),
	description: z.string().optional(),
	retentionValue: z.number().optional(),
	discountValue: z.number().optional(),
	status: paymentStatusEnum.optional().default("EM_ABERTO"),
	balanceOverride: z.boolean().optional(),
	reason: z.string().max(1000).optional().nullable(),
});

export const updateContractPaymentSchema = z.object({
	date: z.string().optional(),
	value: z.number().positive().optional(),
	paidValue: z.number().optional(),
	measurementId: z.string().nullable().optional(),
	description: z.string().optional(),
	retentionValue: z.number().optional(),
	discountValue: z.number().optional(),
	status: paymentStatusEnum.optional(),
	balanceOverride: z.boolean().optional(),
	reason: z.string().max(1000).optional().nullable(),
});

export const contractAmendmentKindEnum = z.enum(["ADITIVO", "REDUCAO"]);

export const createContractAmendmentSchema = z.object({
	kind: contractAmendmentKindEnum,
	value: z.number(),
	reason: z.string().min(1).max(1000),
	date: z
		.string()
		.min(1)
		.refine((v) => !Number.isNaN(Date.parse(v)), "Data do aditivo invalida."),
	measurementIds: z.array(z.string().min(1)).min(1),
});

export const updateContractAmendmentSchema = z.object({
	kind: contractAmendmentKindEnum.optional(),
	value: z.number().optional(),
	reason: z.string().min(1).max(1000).optional(),
	date: z
		.string()
		.optional()
		.refine(
			(v) => !v || !Number.isNaN(Date.parse(v)),
			"Data do aditivo invalida.",
		),
	measurementIds: z.array(z.string().min(1)).min(1).optional(),
});

export const createContractFolderSchema = z.object({
	name: z.string().min(1),
});

export type ContractStatus = z.infer<typeof contractStatusEnum>;
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;
export type ContractServiceType = z.infer<typeof contractServiceTypeEnum>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ContractFilter = z.infer<typeof contractFilterSchema>;

export type CreateContractServiceInput = z.infer<
	typeof createContractServiceSchema
>;

export type CreateContractServicesInput = z.infer<
	typeof createContractServicesSchema
>["items"];
export type ContractServicePreviewInput = z.infer<
	typeof contractServicePreviewSchema
>;
export type ContractServicePreviewResult = {
	budgetItem: { id: string; description: string; index: string };
	availableBefore: number;
	projectedValue: number;
	availableAfter: number;
	warnings: string[];
};
export type UpdateContractServiceInput = z.infer<
	typeof updateContractServiceSchema
>;
export type LinkBudgetInput = z.infer<typeof linkBudgetSchema>;

type LegacyContractMeasurementItemFields = {
	measuredValue?: number;
	measuredPercentage?: number;
	accumulatedQuantity?: number;
	accumulatedValue?: number;
	accumulatedPercentage?: number;
	coverages?: Array<z.infer<typeof measurementCoverageSchema>>;
};

export type ContractMeasurementItemInput = Omit<
	z.infer<typeof contractMeasurementItemSchema>,
	"measuredQuantity"
> & {
	measuredQuantity?: number;
} & LegacyContractMeasurementItemFields;
export type CreateContractMeasurementInput = Omit<
	z.infer<typeof createContractMeasurementSchema>,
	"items"
> & {
	items: ContractMeasurementItemInput[];
	discountValue?: number;
	retentionValue?: number;
	taxValue?: number;
};
export type UpdateContractMeasurementInput = Omit<
	z.infer<typeof updateContractMeasurementSchema>,
	"items"
> & {
	items?: Array<
		ContractMeasurementItemInput & {
			id?: string;
		}
	>;
	discountValue?: number;
	retentionValue?: number;
	taxValue?: number;
};
export type MeasurementCoverageInput = z.infer<
	typeof measurementCoverageSchema
>;
export type ContractMeasurementFilter = z.infer<
	typeof contractMeasurementFilterSchema
>;

export type CreateContractPaymentInput = z.infer<
	typeof createContractPaymentSchema
>;
export type UpdateContractPaymentInput = z.infer<
	typeof updateContractPaymentSchema
>;

export type ContractAmendmentKind = z.infer<typeof contractAmendmentKindEnum>;
export type CreateContractAmendmentInput = z.infer<
	typeof createContractAmendmentSchema
>;
export type UpdateContractAmendmentInput = z.infer<
	typeof updateContractAmendmentSchema
>;

export type CreateContractFolderInput = z.infer<
	typeof createContractFolderSchema
>;
