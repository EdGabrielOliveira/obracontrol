import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Building2, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	deleteOrganization,
	listOrganizations,
	type OrganizationFilter,
} from "@/api/organizations";
import { organizationKeys } from "@/api/query-keys";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { SearchInput } from "@/components/atoms/search-input";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { OrgTable } from "@/organisms/organizations/org-table";
import { paginationSchema } from "@/schemas/pagination";
import type { Organization } from "@/types/organizations";
import type { PaginationMeta } from "@/types/shared";
import { getErrorMessage } from "@/utils/api-error";
import { getPaginationMeta } from "@/utils/pagination";

const orgFilterSchema = z
	.object({
		q: z.string().max(100).optional(),
	})
	.merge(paginationSchema);

export const Route = createFileRoute("/app/organizacoes/")({
	validateSearch: orgFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps }) => {
		void queryClient.prefetchQuery({
			queryKey: organizationKeys.list(deps.search as Record<string, unknown>),
			queryFn: () => listOrganizations(deps.search as OrganizationFilter),
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Organizações - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate({ from: Route.id });
	const searchParams = useSearch({ from: Route.id }) as OrganizationFilter;
	const [searchInput, setSearchInput] = useState(searchParams.q ?? "");
	const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
	const { role, capabilities } = useAuth();
	const canViewCompany = role === "ADMIN";
	const canManageStructure = capabilities?.canManageStructure === true;

	const {
		data: response,
		isLoading,
		error,
	} = useQuery({
		queryKey: organizationKeys.list(searchParams as Record<string, unknown>),
		queryFn: () => listOrganizations(searchParams),
	});
	const deleteMutation = useMutation({
		mutationFn: (organization: Organization) =>
			deleteOrganization(organization.id),
		onSuccess: () => {
			toast.success("Organização excluída.");
			setDeleteTarget(null);
			queryClient.invalidateQueries({ queryKey: organizationKeys.all });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir organização.")),
	});
	const data = response?.data ?? [];
	const paginationMeta: PaginationMeta | null = response
		? getPaginationMeta(response)
		: null;
	const handlePageChange = (page: number) => {
		navigate({ search: (prev) => ({ ...prev, page }) });
	};
	const handleSearch = (q = searchInput) => {
		navigate({
			search: (prev) => ({
				...prev,
				q: q || undefined,
				page: 1,
			}),
		});
	};
	const handleClearSearch = () => {
		setSearchInput("");
		handleSearch("");
	};

	if (isLoading) return <LoadingSpinner title="Carregando..." />;
	if (error) return <ErrorFeedback />;

	if (!data || data.length === 0) {
		return (
			<PageContainer
				DesktopHeader={
					<PageHeader
						eyebrow="Gestão"
						title="Organizações"
						description={
							searchParams.q
								? "Nenhum resultado encontrado."
								: "Nenhum órgão cadastrado."
						}
					/>
				}
			>
				<SearchInput
					className="mb-4"
					placeholder="Buscar organizações..."
					value={searchParams.q ?? ""}
					onChange={(value) => {
						setSearchInput(value);
						handleSearch(value);
					}}
				/>
				<div className="hidden">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Buscar organizações..."
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSearch();
							}}
							className="pl-9 pr-9"
						/>
						{searchInput && (
							<button
								type="button"
								onClick={handleClearSearch}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
				</div>
				<EmptyState
					icon={<Building2 className="h-12 w-12" />}
					title={
						searchParams.q
							? "Nenhum resultado encontrado"
							: "Nenhum órgão encontrado"
					}
					description={
						searchParams.q
							? "Tente ajustar sua busca."
							: "Crie seu primeiro órgão para começar."
					}
					actions={
						searchParams.q
							? undefined
							: canManageStructure
								? [
										{
											label: "Criar órgão",
											onClick: () => navigate({ to: "/app/organizacoes/new" }),
										},
									]
								: undefined
					}
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					eyebrow="Gestão"
					title="Organizações"
					description="Órgãos, centros de custo e obras"
					actions={
						canManageStructure ? (
							<Link to="/app/organizacoes/new">
								<Button>
									<Plus className="mr-2 h-4 w-4" />
									Novo órgão
								</Button>
							</Link>
						) : undefined
					}
				/>
			}
		>
			<OrgTable
				organizations={data}
				showCompany={canViewCompany}
				canManageStructure={canManageStructure}
				searchValue={searchParams.q ?? ""}
				onSearchChange={(value) => {
					setSearchInput(value);
					handleSearch(value);
				}}
				onDelete={setDeleteTarget}
			/>
			{paginationMeta && (
				<PaginationBar meta={paginationMeta} onPageChange={handlePageChange} />
			)}
			<ConfirmDialog
				open={!!deleteTarget}
				title="Excluir organização?"
				description="Esta ação não pode ser desfeita. Os centros de custo vinculados seguirão as regras de dependência do backend."
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
