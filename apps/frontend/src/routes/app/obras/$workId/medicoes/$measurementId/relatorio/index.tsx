import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/app/obras/$workId/medicoes/$measurementId/relatorio/",
)({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Relatório - ObraControl" },
		],
	}),
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/app/obras/$workId/medicoes/$measurementId",
			params,
			search: { tab: "relatorio" },
		});
	},
});
