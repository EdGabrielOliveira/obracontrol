import { z } from "zod";
import { structuredAddressSchema } from "./address";

export { structuredAddressSchema } from "./address";

export const workFormSchema = z
	.object({
		code: z.string().optional(),
		name: z.string().trim().min(1, "Nome obrigatório"),
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
	})
	.superRefine((data, ctx) => {
		if (!data.plannedStart || !data.plannedEnd) return;
		const start = new Date(data.plannedStart);
		const end = new Date(data.plannedEnd);
		if (
			!Number.isNaN(start.getTime()) &&
			!Number.isNaN(end.getTime()) &&
			end < start
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["plannedEnd"],
				message: "A data final deve ser igual ou posterior à data inicial",
			});
		}
	});

export type WorkFormValues = z.infer<typeof workFormSchema>;
