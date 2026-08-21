import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/obras/$workId/cotacoes/new")({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Novo - ObraControl" },
		],
	}),
	loader: ({ params }) => {
		throw redirect({
			to: "/app/obras/$workId/contratos/new",
			params: { workId: params.workId },
		});
	},
});
