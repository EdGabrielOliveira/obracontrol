import { z } from "zod";

export const budgetItemTypeEnum = z.enum([
	"STAGE",
	"SUBSTAGE",
	"ITEM",
	"COMPOSITION",
	"INPUT",
]);

export const budgetItemIndexSchema = z
	.string()
	.regex(/^\d{1,3}(\.\d{1,3}){0,2}$/, {
		message:
			"Indice deve ter de 1 a 3 niveis numericos separados por ponto (ex.: 1, 1.1, 1.1.1)",
	});

export const createBudgetItemSchema = z.object({
	parentId: z.string().nullable().optional(),
	index: budgetItemIndexSchema,
	type: budgetItemTypeEnum,
	description: z.string().min(1),
	unit: z.string().nullable().optional(),
	quantity: z.number().nullable().optional(),
	laborUnitCost: z.number().nullable().optional(),
	materialUnitCost: z.number().nullable().optional(),
	equipmentUnitCost: z.number().nullable().optional(),
	otherUnitCost: z.number().nullable().optional(),
	unitCost: z.number().nullable().optional(),
	totalCost: z.number().nullable().optional(),
	plannedStart: z.string().nullable().optional(),
	plannedEnd: z.string().nullable().optional(),
	actualStart: z.string().nullable().optional(),
	actualEnd: z.string().nullable().optional(),
	completionPercentage: z.number().min(0).max(100).optional(),
	providedStatus: z.string().nullable().optional(),
	sortOrder: z.number().int().optional(),
});

export const updateBudgetItemSchema = createBudgetItemSchema.partial().extend({
	parentId: z.string().nullable().optional(),
	index: budgetItemIndexSchema.optional(),
	type: budgetItemTypeEnum.optional(),
	description: z.string().min(1).optional(),
});

export const reorderBudgetItemsSchema = z.object({
	items: z
		.array(
			z.object({
				id: z.string().min(1),
				sortOrder: z.number().int(),
			}),
		)
		.min(1),
});

export const updateBdiSchema = z.object({
	bdiPercentage: z.number().min(0).max(100),
});

export type BudgetItemType = z.infer<typeof budgetItemTypeEnum>;
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
export type ReorderBudgetItemsInput = z.infer<typeof reorderBudgetItemsSchema>;
export type UpdateBdiInput = z.infer<typeof updateBdiSchema>;
