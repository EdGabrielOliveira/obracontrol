import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/obras/$workId/medicoes/relatorios/")(
	{
		beforeLoad: ({ params }) => {
			throw redirect({
				to: "/app/obras/$workId/medicoes",
				params,
				search: { tab: "relatorios" },
			});
		},
		head: () => ({
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ title: "Relatórios - ObraControl" },
			],
		}),
	},
);
