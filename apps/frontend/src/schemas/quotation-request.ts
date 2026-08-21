import { z } from "zod";

export const quotationRequestItemSchema = z.object({
	budgetItemId: z.string().min(1, "Item do orçamento obrigatório"),
	quantity: z.coerce
		.number()
		.finite()
		.positive("Quantidade deve ser maior que zero"),
});

export const quotationRequestSchema = z
	.object({
		serviceType: z
			.string()
			.trim()
			.min(1, "Tipo de serviço obrigatório")
			.max(120, "Tipo de serviço deve ter no máximo 120 caracteres"),
		title: z.string().trim().min(1, "Título obrigatório"),
		description: z
			.string()
			.trim()
			.min(1, "Descrição obrigatória")
			.max(2000, "Descrição deve ter no máximo 2.000 caracteres"),
		startDate: z.string().min(1, "Data de início obrigatória"),
		endDate: z.string().min(1, "Data de fim obrigatória"),
		items: z
			.array(quotationRequestItemSchema)
			.min(1, "Selecione ao menos uma etapa ou item do orçamento"),
	})
	.superRefine((data, ctx) => {
		if (data.startDate && data.endDate && data.endDate < data.startDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endDate"],
				message: "A data de fim não pode anteceder a data de início",
			});
		}
		const ids = new Set<string>();
		for (const [index, item] of data.items.entries()) {
			if (ids.has(item.budgetItemId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["items", index, "budgetItemId"],
					message: "Item do orçamento duplicado",
				});
			}
			ids.add(item.budgetItemId);
		}
	});

export type QuotationRequestValues = z.infer<typeof quotationRequestSchema>;
