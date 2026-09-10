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
