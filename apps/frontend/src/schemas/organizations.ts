import { z } from "zod";

const structuredAddressSchema = z
	.object({
		zipCode: z.string().min(8),
		street: z.string().optional(),
		district: z.string().optional(),
		number: z.string().optional(),
		city: z.string().min(1),
		state: z.string().length(2),
		complement: z.string().optional(),
		latitude: z.number().nullable().optional(),
		longitude: z.number().nullable().optional(),
	})
	.nullable()
	.optional();

export const organizationEditSchema = z.object({
	name: z.string().min(1, "Nome obrigatório"),
	companyId: z.string().optional(),
	managerName: z.string().optional(),
	structuredAddress: structuredAddressSchema,
});

export const costCenterEditSchema = z.object({
	name: z.string().min(1, "Nome obrigatório"),
	organizationId: z.string().min(1, "Organização obrigatória"),
	managerName: z.string().optional(),
	structuredAddress: structuredAddressSchema,
});

export const costCenterFormSchema = costCenterEditSchema.extend({
	organizationId: z.string().optional(),
});

export type OrganizationEditValues = z.infer<typeof organizationEditSchema>;
export type CostCenterEditValues = z.infer<typeof costCenterEditSchema>;
export type CostCenterFormValues = z.infer<typeof costCenterFormSchema>;
