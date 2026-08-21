import { z } from "zod";

export const workHubTabSchema = z.enum([
	"resumo",
	"historico",
	"aprovacoes",
	"acoes",
]);

export const workHubSearchSchema = z.object({
	tab: workHubTabSchema.optional().default("resumo"),
	asOfDate: z.string().optional(),
});

export type WorkHubTab = z.infer<typeof workHubTabSchema>;
export type WorkHubSearch = z.infer<typeof workHubSearchSchema>;
