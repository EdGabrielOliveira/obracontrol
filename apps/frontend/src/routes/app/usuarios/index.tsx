import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import {
	type AdminUserFilter,
	deleteAdminUser,
	listAdminUsers,
} from "@/api/admin-users";
import { adminUserKeys } from "@/api/query-keys";
import { AccessDenied } from "@/atoms/access-denied";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { DataTable } from "@/components/atoms/data-table";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import { apiErrorStatus } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { paginationSchema } from "@/schemas/pagination";
import type { PaginationMeta } from "@/types/shared";
import { getErrorMessage } from "@/utils/api-error";
import { formatDate } from "@/utils/format";
import { getPaginationMeta } from "@/utils/pagination";

const usuariosFilterSchema = paginationSchema;

const userColumnHelper =
	createColumnHelper<
		NonNullable<Awaited<ReturnType<typeof listAdminUsers>>>["data"][number]
	>();

type UsuariosFilter = z.infer<typeof usuariosFilterSchema>;
export const Route = createFileRoute("/app/usuarios/")({
	validateSearch: usuariosFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	component: RouteComponent,
	loader: async ({ deps }) =>
		await queryClient.prefetchQuery({
			queryKey: adminUserKeys.list(deps.search as Record<string, unknown>),
			queryFn: () => listAdminUsers(deps.search as AdminUserFilter),
		}),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Usuarios - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const searchParams = useSearch({ from: Route.id }) as UsuariosFilter;
	const navigate = useNavigate({ from: Route.id });
	const { capabilities, user: currentUser } = useAuth();
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: adminUserKeys.list(searchParams as Record<string, unknown>),
		queryFn: () => listAdminUsers(searchParams as AdminUserFilter),

		refetchOnMount: "always",
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteAdminUser(id),
		onSuccess: () => {
			toast.success("Usuário excluído.");
			setDeleteId(null);
			queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir usuário.")),
	});

	if (!capabilities?.canManageUsers) {
		return <AccessDenied />;
	}

	if (isLoading) return <LoadingSpinner title="Carregando usuários..." />;
	if (error) return <ErrorFeedback status={apiErrorStatus(error)} />;

	const userList = data?.data ?? [];
	const paginationMeta: PaginationMeta | null = data
		? getPaginationMeta(data)
		: null;
	const handlePageChange = (page: number) => {
		navigate({ search: (prev) => ({ ...prev, page }) });
	};

	return (
		<PageContainer>
			<PageHeader
				title="Usuários"
				description="Gerencie os usuários do sistema e suas permissões."
				actions={
					<Link to="/app/usuarios/new">
						<Button size="sm">
							<Plus className="mr-2 h-4 w-4" /> Novo usuário
						</Button>
					</Link>
				}
			/>

			{userList.length === 0 ? (
				<EmptyState
					icon={<UserPlus className="h-12 w-12" />}
					title="Nenhum usuário encontrado"
					description="Crie o primeiro usuário para começar."
				/>
			) : (
				<>
					<DataTable
						columns={[
							userColumnHelper.accessor("name", {
								header: "Nome",
								meta: { mobileLabel: "Nome" },
							}),
							userColumnHelper.accessor("email", {
								header: "Email",
								meta: { mobileLabel: "Email" },
							}),
							userColumnHelper.accessor("role", {
								header: "Papel",
								meta: { mobileLabel: "Papel" },
							}),
							userColumnHelper.display({
								id: "memberships",
								header: "Vínculos",
								cell: ({ row }) => {
									const user = row.original;
									return (
										[
											...user.organizationMemberships
												.filter((m) => !m.revokedAt)
												.map((m) => m.organization?.name),
											...user.workMemberships
												.filter((m) => !m.revokedAt)
												.map((m) => m.work?.name),
										]
											.filter(Boolean)
											.join(", ") || "Sem vínculo"
									);
								},
								meta: { mobileLabel: "Vínculos" },
							}),
							userColumnHelper.accessor("createdAt", {
								header: "Criado em",
								cell: ({ getValue }) => formatDate(getValue()),
								meta: { mobileLabel: "Criado em" },
							}),
							userColumnHelper.display({
								id: "actions",
								header: () => <span className="sr-only">Ações</span>,
								cell: ({ row }) => (
									<div className="flex justify-end gap-1" data-no-row-click>
										<Link
											to="/app/usuarios/$userId/edit"
											params={{ userId: row.original.id }}
										>
											<Button variant="link" size="sm">
												Editar
											</Button>
										</Link>
										{row.original.id !== currentUser?.id && (
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Excluir usuário ${row.original.name}`}
												title="Excluir usuário"
												onClick={() => setDeleteId(row.original.id)}
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</Button>
										)}
									</div>
								),
								meta: { hideOnMobile: true },
							}),
						]}
						data={userList}
						searchPlaceholder="Buscar usuários..."
						emptyMessage="Nenhum usuário encontrado."
					/>
					{paginationMeta && (
						<PaginationBar
							meta={paginationMeta}
							onPageChange={handlePageChange}
						/>
					)}
				</>
			)}
			<ConfirmDialog
				open={!!deleteId}
				title="Excluir usuário?"
				description="Esta ação não pode ser desfeita. As sessões e os vínculos do usuário também serão removidos."
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				onCancel={() => setDeleteId(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
