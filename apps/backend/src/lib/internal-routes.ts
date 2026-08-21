import { Elysia } from "elysia";
import { requireRole } from "./authorization-middleware";
import { metrics } from "./metrics";
import { resolveAuth } from "./resolve-auth";

export const internalRoutes = new Elysia({
	prefix: "/internal",
	name: "internal-routes",
})
	.use(resolveAuth)
	.use(requireRole("admin"))
	.get("/metrics", () => metrics.snapshot(), {
		detail: {
			tags: ["Admin"],
			summary: "Consultar métricas internas",
			description:
				"Retorna contadores e resumos de latência para diagnóstico interno do backend.",
		},
	});
