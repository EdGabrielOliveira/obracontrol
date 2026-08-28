import { z } from "zod";

export const structuredAddressSchema = z.object({
	zipCode: z.string().min(8).max(9),
	street: z.string().optional().default(""),
	district: z.string().optional().default(""),
	number: z.string().optional().default(""),
	city: z.string().min(1),
	state: z.string().length(2),
	complement: z.string().optional().nullable(),
	latitude: z.number().finite().optional().nullable(),
	longitude: z.number().finite().optional().nullable(),
});

export const createOrganizationSchema = z.object({
	name: z.string().trim().min(1).max(200),
	companyId: z.string().optional(),
	managerName: z.string().optional(),
	address: z.string().optional(),
	structuredAddress: structuredAddressSchema.optional().nullable(),
});

export const updateOrganizationSchema = z.object({
	name: z.string().trim().min(1).max(200).optional(),
	companyId: z.string().optional(),
	managerName: z.string().optional(),
	address: z.string().optional(),
	structuredAddress: structuredAddressSchema.optional().nullable(),
});

export const createCostCenterSchema = z.object({
	name: z.string().trim().min(1).max(200),
	managerName: z.string().optional(),
	address: z.string().optional(),
	structuredAddress: structuredAddressSchema.optional().nullable(),
});

export const updateCostCenterSchema = z.object({
	name: z.string().trim().min(1).max(200).optional(),
	organizationId: z.string().optional(),
	managerName: z.string().optional(),
	address: z.string().optional(),
	structuredAddress: structuredAddressSchema.optional().nullable(),
});

export const organizationFilterSchema = z.object({
	q: z.string().max(100).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const costCenterFilterSchema = z.object({
	q: z.string().max(100).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
export type OrganizationFilter = z.infer<typeof organizationFilterSchema>;
export type CostCenterFilter = z.infer<typeof costCenterFilterSchema>;
