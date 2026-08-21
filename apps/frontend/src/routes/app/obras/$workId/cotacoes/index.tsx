import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/obras/$workId/cotacoes/")({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Cotações - ObraControl" },
		],
	}),
	loader: ({ params }) => {
		throw redirect({
			to: "/app/obras/$workId/contratos",
			params: { workId: params.workId },
		});
	},
});
