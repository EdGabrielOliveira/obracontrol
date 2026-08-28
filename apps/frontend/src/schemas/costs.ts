import { z } from "zod";

export type ActualCostType = "CURRENT" | "FUTURE";

export function normalizeCostTypeInput(
	value: string | null | undefined,
): ActualCostType | "" {
	if (!value) return "";
	const normalized = value.trim().toLowerCase();
	if (normalized.includes("atual") || normalized.includes("current"))
		return "CURRENT";
	if (normalized.includes("futuro") || normalized.includes("future"))
		return "FUTURE";
	return "";
}

export const actualCostTypeSchema = z.enum(
	["CURRENT", "FUTURE"],
	"Tipo inválido",
);

export const actualCostCategorySchema = z.enum([
	"MATERIAL",
	"MAO_DE_OBRA",
	"EQUIPAMENTO",
	"TRANSPORTE",
	"SERVICO",
	"OUTROS",
]);

export const actualCostSchema = z
	.object({
		budgetVersionItemId: z.string().min(1, "Item do orçamento obrigatório"),
		costDate: z.string().min(1, "Data obrigatória"),
		category: actualCostCategorySchema,
		categoryDetail: z.string().trim().optional(),
		description: z.string().trim().min(1, "Descrição obrigatória"),
		amount: z
			.string()
			.trim()
			.min(1, "Valor obrigatório")
			.refine((value) => {
				const normalized = value.replace(/\./g, "").replace(",", ".");
				const amount = Number(normalized);
				return Number.isFinite(amount) && amount > 0;
			}, "O valor deve ser maior que zero"),
		costType: actualCostTypeSchema,
		supplierId: z.string().optional(),
		paymentStatus: z.enum(["PAID", "OPEN"], "Status obrigatório"),
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
	});

export type ActualCostFormValues = z.infer<typeof actualCostSchema>;
