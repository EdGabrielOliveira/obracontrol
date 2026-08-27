import { z } from "zod";

export const structuredAddressSchema = z
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

export const workFormSchema = z.object({
	code: z.string().optional(),
	name: z.string().min(1, "Nome obrigatório"),
	costCenterId: z.string().min(1),
	clientName: z.string().optional(),
	baseDate: z.string().optional(),
	plannedStart: z.string().optional(),
	plannedEnd: z.string().optional(),
	areaM2: z.string().optional(),
	responsibleName: z.string().optional(),
	operationalStatus: z
		.enum([
			"DRAFT",
			"NOT_STARTED",
			"IN_PROGRESS",
			"DONE",
			"SUSPENDED",
			"IGNORED",
		])
		.optional(),
	statusReason: z.string().max(1000).optional(),
	structuredAddress: structuredAddressSchema,
});

export type WorkFormValues = z.infer<typeof workFormSchema>;
