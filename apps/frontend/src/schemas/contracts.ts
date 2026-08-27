import { z } from "zod";
import { parseMonetaryPreprocess } from "@/utils/currency";

export const contractStatusSchema = z.enum([
	"RASCUNHO",
	"A_INICIAR",
	"EM_ANDAMENTO",
	"PARALISADO",
	"FINALIZADO",
	"ARQUIVADO",
]);

export const paymentStatusSchema = z.enum(["EM_ABERTO", "PAGO"]);

export const contractServiceTypeSchema = z.enum([
	"ETAPA",
	"SUBETAPA",
	"COMPOSICAO",
	"INSUMO",
	"ITEM",
]);

export const contractFormSchema = z
	.object({
		code: z.string().min(1, "Código obrigatório"),
		supplierName: z.string().min(1, "Fornecedor obrigatório").optional(),
		supplierId: z.string().min(1).nullable().optional(),
		contractValue: z.preprocess(
			parseMonetaryPreprocess,
			z.number().positive("Valor deve ser maior que zero"),
		),
		serviceType: z.string().optional(),
		objectDescription: z
			.string()
			.trim()
			.min(1, "Objeto do contrato obrigatório"),
		title: z.string().optional(),
		startDate: z.string().optional(),
		endDate: z.string().optional(),
		status: contractStatusSchema.optional(),
		notes: z.string().optional(),
		services: z
			.array(
				z.object({
					budgetItemId: z.string().min(1),
					quantity: z.number().positive("Quantidade deve ser maior que zero"),
					unitCost: z
						.number()
						.positive("Valor unitário deve ser maior que zero"),
				}),
			)
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.supplierName === undefined && data.supplierId == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["supplierName"],
				message: "Informe supplierId ou supplierName.",
			});
		}
	});

export type ContractFormValues = {
	code: string;
	supplierName?: string;
	supplierId?: string | null;
	contractValue: number;
	serviceType?: string;
	objectDescription: string;
	title?: string;
	startDate?: string;
	endDate?: string;
	status?: z.infer<typeof contractStatusSchema>;
	notes?: string;
	services?: Array<{
		budgetItemId: string;
		quantity: number;
		unitCost: number;
	}>;
};

export const contractEditFormSchema = z
	.object({
		serviceType: z.string().optional(),
		objectDescription: z
			.string()
			.trim()
			.min(1, "Descrição do contrato obrigatória"),
		title: z.string().optional(),
		startDate: z.string().optional(),
		endDate: z.string().optional(),
		status: contractStatusSchema.optional(),
		statusReason: z.string().max(1000).optional(),
	})
	.superRefine((data, ctx) => {
		if (
			(data.status === "PARALISADO" || data.status === "ARQUIVADO") &&
			!data.statusReason?.trim()
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["statusReason"],
				message: "Informe o motivo para paralisar ou arquivar o contrato",
			});
		}
	});

export type ContractEditFormValues = z.infer<typeof contractEditFormSchema>;

export const contractServiceCreateSchema = z.object({
	budgetItemId: z.string().min(1, "Item de orçamento obrigatório"),
	quantity: z.string().optional(),
	unitCost: z.string().optional(),
});

export const contractServiceCreateBatchSchema = z.object({
	items: z
		.array(
			contractServiceCreateSchema.extend({
				quantity: z.string().min(1, "Quantidade obrigatória"),
				unitCost: z.string().min(1, "Custo unitário obrigatório"),
			}),
		)
		.min(1, "Selecione ao menos um item do orçamento"),
});

export type ContractServiceCreateValues = z.infer<
	typeof contractServiceCreateSchema
>;

export type ContractServiceCreateBatchValues = z.infer<
	typeof contractServiceCreateBatchSchema
>;

export const contractServiceEditSchema = contractServiceCreateSchema;

export type ContractServiceEditValues = z.infer<
	typeof contractServiceEditSchema
>;

export const contractPaymentCreateSchema = z
	.object({
		description: z.string().optional(),
		date: z.string().min(1, "Data obrigatória"),
		value: z.string().min(1, "Valor obrigatório"),
		paidValue: z.string().min(1, "Valor pago obrigatório"),
		retentionValue: z.string().optional(),
		discountValue: z.string().optional(),
		measurementId: z.string().optional(),
		status: paymentStatusSchema.optional(),
		balanceOverride: z.boolean().optional(),
		reason: z.string().max(1000).optional(),
	})
	.refine(
		(data) => !data.balanceOverride || (data.reason ?? "").trim().length > 0,
		{
			message: "Informe o motivo do override",
			path: ["reason"],
		},
	);

export type ContractPaymentCreateValues = z.infer<
	typeof contractPaymentCreateSchema
>;

export const contractPaymentEditSchema = contractPaymentCreateSchema.safeExtend(
	{
		retentionValue: z.string().optional(),
		discountValue: z.string().optional(),
		status: paymentStatusSchema.optional(),
	},
);

export type ContractPaymentEditValues = z.infer<
	typeof contractPaymentEditSchema
>;
