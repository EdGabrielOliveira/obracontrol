import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";

export const Route = createRootRoute({
	component: RootComponent,
	errorComponent: RootErrorComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "ObraControl" },
		],
	}),
});

function RootErrorComponent({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	const router = useRouter();

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-lg space-y-4">
				<h1 className="text-xl font-semibold">
					Não foi possível abrir esta tela
				</h1>
				<ErrorFeedback
					message={error.message || "Ocorreu um erro ao carregar a aplicação."}
					onRetry={() => {
						reset();
						void router.invalidate();
					}}
				/>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => window.location.reload()}>
						Recarregar aplicação
					</Button>
					<Button onClick={() => window.location.assign("/auth/login")}>
						Voltar ao login
					</Button>
				</div>
			</div>
		</div>
	);
}

function RootComponent() {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<HeadContent />
				<Outlet />
				<Toaster position="top-right" richColors />
			</AuthProvider>
			{import.meta.env.DEV && (
				<TanStackDevtools
					config={{
						position: "middle-right",
					}}
					plugins={[
						{
							name: "TanStack Query",
							render: <ReactQueryDevtoolsPanel />,
							defaultOpen: true,
						},
						{
							name: "TanStack Router",
							render: <TanStackRouterDevtoolsPanel />,
							defaultOpen: false,
						},
					]}
				/>
			)}
		</QueryClientProvider>
	);
}
