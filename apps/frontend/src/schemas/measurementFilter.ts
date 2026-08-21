import { z } from "zod";

export const measurementFilterSchema = z.object({
	q: z.string().max(100).optional(),
	tab: z.enum(["lista", "mapa", "relatorios"]).optional().default("lista"),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type MeasurementFilter = z.infer<typeof measurementFilterSchema>;
