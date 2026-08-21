import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/obras/$workId/importacoes/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/app/obras/$workId/historico",
			params,
		});
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Histórico - ObraControl" },
		],
	}),
});
