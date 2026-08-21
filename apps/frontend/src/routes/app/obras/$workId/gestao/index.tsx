import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { requireManagementAccess } from "@/lib/route-authorization";

export const Route = createFileRoute("/app/obras/$workId/gestao/")({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Gestão - ObraControl" },
		],
	}),
	validateSearch: z.object({ asOfDate: z.string().optional() }),
	beforeLoad: async ({ params, search }) => {
		await requireManagementAccess();
		const asOfDate =
			typeof search.asOfDate === "string" ? search.asOfDate : undefined;
		throw redirect({
			to: "/app/obras/$workId",
			params,
			search: asOfDate ? { asOfDate } : {},
		});
	},
});
