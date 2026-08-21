import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/obras/$workId/medicoes/mapa/")({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Mapa - ObraControl" },
		],
	}),
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/app/obras/$workId/medicoes",
			params,
			search: { tab: "mapa" },
		});
	},
});
