import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { Eye, EyeOff, KeyRound, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { registerAdminAccount } from "@/api/auth";
import { Container } from "@/components/atoms/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/cadastro/")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Cadastro de administrador - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [authorizationKey, setAuthorizationKey] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showAuthorizationKey, setShowAuthorizationKey] = useState(false);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);

		try {
			await registerAdminAccount({ email, password, authorizationKey });
			toast.success("Conta administrador criada. Faça login para continuar.");
			navigate({ to: "/auth/login" });
		} catch (error) {
			const message =
				axios.isAxiosError(error) &&
				typeof error.response?.data?.message === "string"
					? error.response.data.message
					: "Não foi possível criar a conta.";
			toast.error(message);
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
							<UserPlus className="h-6 w-6 text-primary" />
						</div>
						<CardTitle className="text-xl">Criar conta administrador</CardTitle>
						<p className="text-sm text-muted-foreground">
							Use a chave de autorização fornecida pelo responsável pelo
							sistema.
						</p>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="admin@exemplo.com"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
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
										onChange={(event) => setPassword(event.target.value)}
										required
										minLength={8}
										autoComplete="new-password"
										className="pr-10"
									/>
									<button
										type="button"
										aria-label={
											showPassword ? "Ocultar senha" : "Mostrar senha"
										}
										onClick={() => setShowPassword((visible) => !visible)}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								<p className="text-xs text-muted-foreground">
									Mínimo de 8 caracteres, com maiúscula, minúscula e número.
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="authorizationKey">Chave de autorização</Label>
								<div className="relative">
									<KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id="authorizationKey"
										type={showAuthorizationKey ? "text" : "password"}
										placeholder="Informe a chave"
										value={authorizationKey}
										onChange={(event) =>
											setAuthorizationKey(event.target.value)
										}
										required
										autoComplete="off"
										className="pl-10 pr-10"
									/>
									<button
										type="button"
										aria-label={
											showAuthorizationKey ? "Ocultar chave" : "Mostrar chave"
										}
										onClick={() =>
											setShowAuthorizationKey((visible) => !visible)
										}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										{showAuthorizationKey ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>
							<Button type="submit" className="w-full" loading={loading}>
								Criar conta
							</Button>
						</form>
						<div className="mt-4 text-center">
							<Button
								className="w-full"
								variant="outline"
								type="button"
								onClick={() => navigate({ to: "/auth/login" })}
							>
								Voltar para o login
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}
