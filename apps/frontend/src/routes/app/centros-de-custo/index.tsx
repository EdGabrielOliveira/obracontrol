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
	type AllCostCenterFilter,
	deleteCostCenter,
	listAllCostCenters,
} from "@/api/organizations";
import { costCenterKeys } from "@/api/query-keys";
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
import { queryClient } from "@/lib/query-client";
import { CostCenterTable } from "@/organisms/organizations/cost-center-table";
import { paginationSchema } from "@/schemas/pagination";
import type { CostCenterDetail } from "@/types/organizations";
import type { PaginationMeta } from "@/types/shared";
import { getErrorMessage } from "@/utils/api-error";
import { getPaginationMeta } from "@/utils/pagination";

const costCenterFilterSchema = z
	.object({
		q: z.string().max(100).optional(),
	})
	.merge(paginationSchema);

type CostCenterFilter = z.infer<typeof costCenterFilterSchema>;

export const Route = createFileRoute("/app/centros-de-custo/")({
	component: RouteComponent,
	validateSearch: costCenterFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps }) => {
		void queryClient.prefetchQuery({
			queryKey: costCenterKeys.allList(deps.search as Record<string, unknown>),
			queryFn: () => listAllCostCenters(deps.search as AllCostCenterFilter),
		});
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Centros de Custo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const searchParams = useSearch({ from: Route.id }) as CostCenterFilter;
	const navigate = useNavigate({ from: Route.id });
	const [searchInput, setSearchInput] = useState(searchParams.q ?? "");
	const [deleteTarget, setDeleteTarget] = useState<CostCenterDetail | null>(
		null,
	);

	const { data, isLoading, error } = useQuery({
		queryKey: costCenterKeys.allList(searchParams as Record<string, unknown>),
		queryFn: () => listAllCostCenters(searchParams as AllCostCenterFilter),
	});
	const deleteMutation = useMutation({
		mutationFn: (costCenter: CostCenterDetail) =>
			deleteCostCenter(costCenter.organization?.id ?? "", costCenter.id),
		onSuccess: () => {
			toast.success("Centro de custo excluído.");
			setDeleteTarget(null);
			queryClient.invalidateQueries({ queryKey: ["all-cost-centers"] });
			queryClient.invalidateQueries({ queryKey: ["organizations"] });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir centro de custo.")),
	});

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
		navigate({
			search: (prev) => {
				const { q: _, ...rest } = prev as Record<string, unknown>;
				return { ...rest, page: 1 };
			},
		});
	};

	if (isLoading)
		return <LoadingSpinner title="Carregando centros de custo..." />;
	if (error)
		return <ErrorFeedback message="Erro ao carregar centros de custo." />;

	if (!data || data.data.length === 0) {
		return (
			<PageContainer
				DesktopHeader={
					<PageHeader
						eyebrow="Gestão"
						title="Centros de Custo"
						description={
							searchParams.q
								? "Nenhum resultado encontrado."
								: "Nenhum centro de custo cadastrado."
						}
					/>
				}
			>
				<SearchInput
					className="mb-4"
					placeholder="Buscar centros de custo..."
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
							placeholder="Buscar centros de custo..."
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
					icon={<Building2 className="h-12 w-12 text-muted-foreground" />}
					title={
						searchParams.q
							? "Nenhum resultado encontrado"
							: "Nenhum centro de custo encontrado"
					}
					description={
						searchParams.q
							? "Tente ajustar sua busca."
							: "Crie seu primeiro órgão com centros de custo para começar."
					}
					actions={
						searchParams.q
							? undefined
							: [
									{
										label: "Criar centro de custo",
										onClick: () =>
											navigate({ to: "/app/centros-de-custo/new" }),
									},
								]
					}
				/>
			</PageContainer>
		);
	}

	const paginationMeta: PaginationMeta = getPaginationMeta(data);

	const rows = data.data.map((cc: CostCenterDetail) => ({
		id: cc.id,
		name: cc.name,
		organizationId: cc.organization?.id ?? "",
		organizationName: cc.organization?.name ?? "",
		createdAt: cc.createdAt,
	}));

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					eyebrow="Gestão"
					title="Centros de Custo"
					description="Todos os centros de custo cadastrados"
					actions={
						<Link to="/app/centros-de-custo/new">
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Novo Centro
							</Button>
						</Link>
					}
				/>
			}
		>
			<CostCenterTable
				costCenters={rows}
				showParentColumn
				searchValue={searchParams.q ?? ""}
				onSearchChange={(value) => {
					setSearchInput(value);
					handleSearch(value);
				}}
				onDelete={(row) =>
					setDeleteTarget(data.data.find((cc) => cc.id === row.id) ?? null)
				}
			/>
			<PaginationBar meta={paginationMeta} onPageChange={handlePageChange} />
			<ConfirmDialog
				open={!!deleteTarget}
				title="Excluir centro de custo?"
				description="Esta ação não pode ser desfeita. As obras vinculadas seguirão as regras de dependência do backend."
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
