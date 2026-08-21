import { z } from "zod";

export const budgetAllocationSchema = z
	.object({
		budgetItemId: z.string().min(1, "Item de orçamento obrigatório"),
		quantity: z.number().positive().optional(),
		value: z.number().positive().optional(),
		percentage: z.number().min(0).max(100).optional(),
	})
	.superRefine((data, ctx) => {
		const basisCount = [data.quantity, data.value, data.percentage].filter(
			(v) => v !== undefined,
		).length;
		if (basisCount === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["quantity"],
				message:
					"Informe uma base de alocação (quantidade, valor ou percentual).",
			});
		}
		if (basisCount > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["value"],
				message:
					"Informe apenas uma base de alocação (quantidade, valor ou percentual).",
			});
		}
	});

export type BudgetAllocationInput = z.infer<typeof budgetAllocationSchema>;

export const budgetPreviewSchema = z
	.object({
		allocations: z
			.array(budgetAllocationSchema)
			.min(1, "Informe ao menos uma alocação de item de orçamento"),
		amount: z.number().positive().optional(),
	})
	.superRefine((data, ctx) => {
		if (
			data.allocations.some((a) => a.percentage !== undefined) &&
			data.amount === undefined
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["amount"],
				message:
					"Valor total da operação obrigatório para alocação percentual.",
			});
		}
	});
