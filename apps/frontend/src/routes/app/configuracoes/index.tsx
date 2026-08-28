import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { listApiKeys } from "@/api/api-keys";
import { listOrganizations } from "@/api/organizations";
import { apiKeyKeys } from "@/api/query-keys";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { ApiKeysPanel } from "@/components/organisms/settings/api-keys-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/configuracoes/")({
	beforeLoad: () => requireAuthorizationCapability("canManageApiKeys"),
	loader: () => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: apiKeyKeys.list({ limit: 100, page: 1 }),
				queryFn: () => listApiKeys({ limit: 100, page: 1 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["organizations", "api-key-options"],
				queryFn: () => listOrganizations({ limit: 100, page: 1 }),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Configurações - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);

	async function handlePasswordChange(e: FormEvent) {
		e.preventDefault();

		if (newPassword.length < 8) {
			toast.error("A nova senha deve ter no mínimo 8 caracteres");
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("As senhas não conferem");
			return;
		}

		setLoading(true);

		try {
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword,
			});

			if (error) {
				toast.error("Erro ao alterar senha. Verifique a senha atual.");
				return;
			}

			toast.success("Senha alterada com sucesso!");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch {
			toast.error("Erro ao conectar com o servidor");
		} finally {
			setLoading(false);
		}
	}

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					title="Configurações"
					description="Gerencie suas preferências de conta"
				/>
			}
		>
			<Tabs defaultValue="senha" className="w-full">
				<TabsList className="w-full justify-start sm:w-auto">
					<TabsTrigger value="senha">
						<Lock className="h-4 w-4" /> Alterar senha
					</TabsTrigger>
					<TabsTrigger value="api-keys">
						<KeyRound className="h-4 w-4" /> API Keys
					</TabsTrigger>
				</TabsList>
				<TabsContent value="senha" className="mt-6">
					<Card>
						<CardHeaderWithIcon
							icon={Lock}
							title="Alterar Senha"
							description="Atualize sua senha de acesso"
						/>
						<CardContent>
							<form onSubmit={handlePasswordChange} className="space-y-4">
								<Field className="flex flex-col gap-1">
									<FieldLabel htmlFor="currentPassword">Senha atual</FieldLabel>
									<div className="relative">
										<Input
											id="currentPassword"
											type={showCurrent ? "text" : "password"}
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
											required
											autoComplete="current-password"
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() => setShowCurrent((v) => !v)}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											tabIndex={-1}
										>
											{showCurrent ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</Field>
								<Field className="flex flex-col gap-1">
									<FieldLabel htmlFor="newPassword">Nova senha</FieldLabel>
									<div className="relative">
										<Input
											id="newPassword"
											type={showNew ? "text" : "password"}
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											required
											minLength={8}
											autoComplete="new-password"
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() => setShowNew((v) => !v)}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											tabIndex={-1}
										>
											{showNew ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</Field>
								<Field className="flex flex-col gap-1">
									<FieldLabel htmlFor="confirmPassword">
										Confirmar nova senha
									</FieldLabel>
									<Input
										id="confirmPassword"
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										required
										minLength={8}
										autoComplete="new-password"
									/>
									{confirmPassword && newPassword !== confirmPassword && (
										<p className="text-xs text-destructive">
											As senhas não conferem
										</p>
									)}
								</Field>
								<Button type="submit" className="w-full" loading={loading}>
									Alterar senha
								</Button>
							</form>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="api-keys" className="mt-6">
					<ApiKeysPanel />
				</TabsContent>
			</Tabs>
		</PageContainer>
	);
}
