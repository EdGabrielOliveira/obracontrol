import { z } from "zod";

export const workMeasurementItemSchema = z
	.object({
		budgetItemId: z.string().min(1),
		measuredQuantity: z.number().finite(),
	})
	.strict();

export const createWorkMeasurementSchema = z
	.object({
		date: z.string().min(1),
		title: z.string().trim().optional(),
		items: z.array(workMeasurementItemSchema).min(1),
		balanceOverride: z.boolean().optional().default(false),
		evidenceNote: z.string().max(2000).optional().nullable(),
	})
	.strict()
	.superRefine((data, ctx) => {
		if (!data.title?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["title"],
				message: "Descricao da medicao obrigatoria",
			});
		}
	});

export const updateWorkMeasurementSchema = z
	.object({
		title: z.string().optional(),
		date: z.string().optional(),
		items: z.array(workMeasurementItemSchema).min(1).optional(),
		balanceOverride: z.boolean().optional().default(false),
		evidenceNote: z.string().max(2000).optional().nullable(),
	})
	.strict();

export const workMeasurementFilterSchema = z.object({
	q: z.string().max(100).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type CreateWorkMeasurementInput = z.infer<
	typeof createWorkMeasurementSchema
>;
export type UpdateWorkMeasurementInput = z.infer<
	typeof updateWorkMeasurementSchema
>;
export type WorkMeasurementItemInput = z.infer<
	typeof workMeasurementItemSchema
>;
export type WorkMeasurementFilter = z.infer<typeof workMeasurementFilterSchema>;
