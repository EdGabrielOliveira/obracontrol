import { z } from "zod";

export const positiveQuantity = (message: string) =>
	z
		.string()
		.refine((value) => value.trim() !== "" && Number(value) > 0, message);

export const measurementItemSchema = z.object({
	budgetItemId: z.string().min(1, "Item obrigatório"),
	measuredQuantity: positiveQuantity("Quantidade deve ser maior que zero"),
	measuredPercentage: z
		.string()
		.optional()
		.refine(
			(value) =>
				value === undefined || (Number(value) > 0 && Number(value) <= 100),
			"Percentual deve estar entre 0 e 100",
		),
});

export type MeasurementItemValues = z.infer<typeof measurementItemSchema>;

export const measurementEditItemSchema = measurementItemSchema.extend({
	id: z.string().optional(),
});

export type MeasurementEditItemValues = z.infer<
	typeof measurementEditItemSchema
>;

export const measurementCreateSchema = z
	.object({
		date: z.string().min(1, "Data obrigatória"),
		title: z.string().min(1, "Título obrigatório"),
		items: z.array(measurementItemSchema).min(1, "Adicione pelo menos 1 item"),
		balanceOverride: z.boolean().optional(),
		evidenceNote: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.balanceOverride && !(data.evidenceNote ?? "").trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["evidenceNote"],
				message: "Nota de evidência obrigatória para override",
			});
		}
	});

export type MeasurementCreateValues = z.infer<typeof measurementCreateSchema>;

export const measurementEditSchema = z
	.object({
		title: z.string().min(1, "Título obrigatório"),
		date: z.string().min(1, "Data obrigatória"),
		items: z
			.array(measurementEditItemSchema)
			.min(1, "Adicione pelo menos 1 item"),
		balanceOverride: z.boolean().optional(),
		evidenceNote: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.balanceOverride && !(data.evidenceNote ?? "").trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["evidenceNote"],
				message: "Nota de evidência obrigatória para override",
			});
		}
	});

export type MeasurementEditValues = z.infer<typeof measurementEditSchema>;
