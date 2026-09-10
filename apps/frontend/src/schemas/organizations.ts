import { z } from "zod";
import { structuredAddressSchema } from "./address";

export const organizationEditSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
	companyId: z.string().optional(),
	managerName: z.string().optional(),
	structuredAddress: structuredAddressSchema,
});

export const costCenterEditSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
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
