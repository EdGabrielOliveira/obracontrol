import { z } from "zod";

export const dashboardScopeSchema = z.enum([
	"system",
	"organization",
	"costCenter",
	"work",
]);

export const dashboardSearchSchema = z.object({
	scope: dashboardScopeSchema.optional().default("system"),
	orgId: z.string().optional(),
	ccId: z.string().optional(),
	workId: z.string().optional(),
	workIds: z.string().optional(),
	q: z.string().max(100).optional(),
	status: z
		.enum([
			"DRAFT",
			"NOT_STARTED",
			"IN_PROGRESS",
			"DONE",
			"SUSPENDED",
			"IGNORED",
		])
		.optional(),
});

export type DashboardScope = z.infer<typeof dashboardScopeSchema>;
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;
