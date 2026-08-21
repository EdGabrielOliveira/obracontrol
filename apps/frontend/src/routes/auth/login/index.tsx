import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Container } from "@/components/atoms/Container";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { authorizationSessionQueryOptions } from "@/lib/authorization-session-query";
import { authQueryKeys, clearAuthSessionCache } from "@/lib/query-cache";
import { queryClient } from "@/lib/query-client";
import { sessionQueryOptions } from "@/lib/session-query";
import { safeRedirectPath } from "@/utils/safeRedirectPath";

export const Route = createFileRoute("/auth/login/")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Login - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();
	const redirect = useSearch({ strict: false }) as { redirect?: string };

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setLoading(true);
		setSubmitError(null);

		try {
			const { error } = await signIn.email({ email, password });

			if (error) {
				setSubmitError("Não foi possível entrar. Confira seu e-mail e senha.");
				toast.error("Credenciais invalidas");
				return;
			}

			// The root provider can still have anonymous session or authorization
			// requests in flight. Cancel both before replacing the auth cache: a
			// late authorization response can otherwise replace the freshly loaded
			// role and leave the app without its permissions until a page reload.
			await queryClient.cancelQueries({ queryKey: authQueryKeys.all });
			clearAuthSessionCache(queryClient);
			await queryClient.fetchQuery({
				...sessionQueryOptions(),
				staleTime: 0,
			});
			await queryClient.fetchQuery({
				...authorizationSessionQueryOptions(),
				staleTime: 0,
			});
			toast.success("Login realizado com sucesso");
			await navigate({ to: safeRedirectPath(redirect?.redirect) });
		} catch {
			setSubmitError(
				"Login concluído, mas não foi possível abrir a próxima tela. Tente novamente.",
			);
			toast.error("Erro ao conectar com o servidor");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Container>
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
							<LogIn className="h-6 w-6 text-primary" />
						</div>
						<CardTitle className="text-xl">ObraControl</CardTitle>
						<p className="text-sm text-muted-foreground">
							Entre com sua conta para acessar
						</p>
					</CardHeader>
					<CardContent>
						{submitError && (
							<Alert variant="destructive" className="mb-4">
								<AlertDescription>{submitError}</AlertDescription>
							</Alert>
						)}
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="seu@email.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									autoComplete="email"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Senha</Label>
								<div className="relative">
									<Input
										id="password"
										type={showPassword ? "text" : "password"}
										placeholder="Sua senha"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										minLength={8}
										autoComplete="current-password"
										className="pr-10"
									/>
									<button
										type="button"
										onClick={() => setShowPassword((v) => !v)}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										tabIndex={-1}
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>
							<Button type="submit" className="w-full" loading={loading}>
								Entrar
							</Button>
						</form>
						<p className="mt-4 text-center text-xs text-muted-foreground">
							Acesso fechado: solicite seu usuário ao administrador ou gerente.
						</p>
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}
