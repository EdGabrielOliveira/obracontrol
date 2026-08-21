import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Key, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createApiKey, listApiKeys, revokeApiKey } from "@/api/api-keys";
import { listOrganizations } from "@/api/organizations";
import { apiKeyKeys } from "@/api/query-keys";
import { EmptyState } from "@/atoms/empty-state";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { DataTable } from "@/components/atoms/data-table";
import { Modal } from "@/components/molecules/Modal/Modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/utils/format";

export function ApiKeysPanel() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [expiresInDays, setExpiresInDays] = useState("");
	const [organizationId, setOrganizationId] = useState("");
	const [search, setSearch] = useState("");
	const [generatedKey, setGeneratedKey] = useState<string | null>(null);
	const { data, isLoading } = useQuery({
		queryKey: apiKeyKeys.list({ limit: 100, page: 1 }),
		queryFn: () => listApiKeys({ limit: 100, page: 1 }),
	});
	const organizationsQuery = useQuery({
		queryKey: ["organizations", "api-key-options"],
		queryFn: () => listOrganizations({ limit: 100, page: 1 }),
	});
	const createMutation = useMutation({
		mutationFn: () =>
			createApiKey({
				name,
				expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
				organizationId: organizationId || undefined,
			}),
		onSuccess: (result) => {
			toast.success("Chave criada");
			queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
			setGeneratedKey(result.key);
			setName("");
			setExpiresInDays("");
			setOrganizationId("");
			setShowCreate(false);
		},
		onError: () => toast.error("Erro ao criar chave"),
	});
	const revokeMutation = useMutation({
		mutationFn: revokeApiKey,
		onSuccess: () => {
			toast.success("Chave revogada");
			queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
		},
		onError: () => toast.error("Erro ao revogar chave"),
	});
	const keys = useMemo(
		() =>
			(data?.data ?? []).filter((key) =>
				key.name.toLowerCase().includes(search.toLowerCase()),
			),
		[data, search],
	);
	const columns = [
		{
			accessorKey: "name",
			header: "Nome",
			cell: ({ row }: { row: { original: (typeof keys)[number] } }) => (
				<span className="font-medium">{row.original.name}</span>
			),
		},
		{
			accessorKey: "keyPrefix",
			header: "Prefixo",
			cell: ({ row }: { row: { original: (typeof keys)[number] } }) => (
				<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
					{row.original.keyPrefix}
				</code>
			),
		},
		{
			accessorKey: "organizationId",
			header: "Escopo",
			cell: ({ row }: { row: { original: (typeof keys)[number] } }) =>
				row.original.organizationId ? "Organização selecionada" : "Global",
		},
		{
			accessorKey: "createdAt",
			header: "Criada em",
			cell: ({ row }: { row: { original: (typeof keys)[number] } }) =>
				formatDate(row.original.createdAt),
		},
		{
			accessorKey: "expiresAt",
			header: "Expira em",
			cell: ({ row }: { row: { original: (typeof keys)[number] } }) =>
				row.original.expiresAt ? formatDate(row.original.expiresAt) : "Nunca",
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }: { row: { original: (typeof keys)[number] } }) => (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => revokeMutation.mutate(row.original.id)}
					loading={revokeMutation.isPending}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			),
		},
	];

	if (isLoading) return <LoadingSpinner title="Carregando chaves..." />;
	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">Chaves de API</h2>
					<p className="text-sm text-muted-foreground">
						Gerencie o acesso programático à API.
					</p>
				</div>
				<Button size="sm" onClick={() => setShowCreate(true)}>
					<Plus className="mr-2 h-4 w-4" /> Nova chave
				</Button>
			</div>

			{generatedKey && (
				<Card className="border-primary/30 bg-primary/5">
					<CardContent className="pt-4">
						<p className="text-sm">
							Copie esta chave agora. Ela não será exibida novamente.
						</p>
						<div className="mt-2 flex items-center gap-2">
							<code className="flex-1 break-all rounded bg-muted px-3 py-2 text-sm">
								{generatedKey}
							</code>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									navigator.clipboard.writeText(generatedKey);
									toast.success("Chave copiada");
								}}
							>
								Copiar
							</Button>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="mt-3"
							onClick={() => setGeneratedKey(null)}
						>
							Entendi, já copiei
						</Button>
					</CardContent>
				</Card>
			)}
			{keys.length === 0 && !search ? (
				<EmptyState
					icon={<Key className="h-12 w-12" />}
					title="Nenhuma chave de API"
					description="Crie uma chave para acessar a API via Bearer token."
				/>
			) : (
				<DataTable
					columns={columns}
					data={keys}
					searchPlaceholder="Buscar chaves..."
					searchValue={search}
					onSearchChange={setSearch}
					emptyMessage="Nenhuma chave encontrada"
				/>
			)}
			<Modal
				isOpen={showCreate}
				onClose={() => setShowCreate(false)}
				title="Nova chave de API"
				description="Crie uma chave para integrações externas."
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						createMutation.mutate();
					}}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="settings-api-key-name">Nome</Label>
						<Input
							id="settings-api-key-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Integração ERP"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="settings-api-key-organization">
							Organização (opcional)
						</Label>
						<select
							id="settings-api-key-organization"
							className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={organizationId}
							onChange={(event) => setOrganizationId(event.target.value)}
						>
							<option value="">Todas as organizações permitidas</option>
							{(organizationsQuery.data?.data ?? []).map((organization) => (
								<option key={organization.id} value={organization.id}>
									{organization.name}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="settings-api-key-expires">
							Expira em (dias, opcional)
						</Label>
						<Input
							id="settings-api-key-expires"
							type="number"
							min={1}
							max={365}
							value={expiresInDays}
							onChange={(event) => setExpiresInDays(event.target.value)}
							placeholder="Sem expiração"
						/>
					</div>
					<Button type="submit" loading={createMutation.isPending}>
						Criar chave
					</Button>
				</form>
			</Modal>
			<Alert className="border-primary/30 bg-primary/5">
				<BookOpen className="text-primary" />
				<AlertTitle>Documentação da API</AlertTitle>

				<AlertDescription className="flex justify-between">
					Consulte as rotas GET, exemplos de request e retornos no guia de
					integração:
					<Link
						to="/documentacao-api"
						className="font-medium text-primary underline underline-offset-4"
					>
						Abrir documentação
					</Link>
				</AlertDescription>
			</Alert>
		</div>
	);
}
