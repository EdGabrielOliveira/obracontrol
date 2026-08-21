import { z } from "zod";

export const apiKeyFilterSchema = z.object({
	q: z.string().max(100).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type ApiKeyFilter = z.infer<typeof apiKeyFilterSchema>;
