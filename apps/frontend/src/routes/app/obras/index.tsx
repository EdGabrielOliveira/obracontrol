import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { HardHat, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { governanceKeys, workKeys } from "@/api/query-keys";
import { deleteWork, listWorks } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/query-client";
import { WorkTable } from "@/organisms/works/work-table";
import { paginationSchema } from "@/schemas/pagination";
import type { PaginationMeta } from "@/types/shared";
import { constructionItemStatusSchema } from "@/types/shared";
import type { WorkSummaryWithHierarchy } from "@/types/works";
import { getErrorMessage } from "@/utils/api-error";
import type { WorkListingRow } from "@/utils/hierarchy-listing";
import { getPaginationMeta } from "@/utils/pagination";

const workFilterSchema = z
	.object({
		q: z.string().max(100).optional(),
		status: constructionItemStatusSchema.optional(),
	})
	.merge(paginationSchema);

type WorkFilter = z.infer<typeof workFilterSchema>;

export const Route = createFileRoute("/app/obras/")({
	component: RouteComponent,
	validateSearch: workFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps }) => {
		void queryClient.prefetchQuery({
			queryKey: workKeys.list(deps.search as Record<string, unknown>),
			queryFn: () => listWorks(deps.search as WorkFilter),
		});
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Obras - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const searchParams = useSearch({ from: Route.id }) as WorkFilter;
	const navigate = useNavigate({ from: Route.id });
	const [deleteTarget, setDeleteTarget] = useState<WorkListingRow | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: workKeys.list(searchParams as Record<string, unknown>),
		queryFn: () => listWorks(searchParams as WorkFilter),
	});
	const deleteMutation = useMutation({
		mutationFn: (work: WorkListingRow) => deleteWork(work.id),
		onSuccess: (result, work) => {
			setDeleteTarget(null);
			if (result?.status === "PENDING") {
				toast.success(
					"Solicitação de exclusão enviada para aprovação do Gerente.",
				);
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(work.id),
				});
				return;
			}
			toast.success("Obra excluída.");
			queryClient.invalidateQueries({ queryKey: workKeys.all });
			queryClient.invalidateQueries({ queryKey: workKeys.dashboard });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir obra.")),
	});

	const handlePageChange = (page: number) => {
		navigate({ search: (prev) => ({ ...prev, page }) });
	};
	const handleSearch = (q: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				q: q || undefined,
				page: 1,
			}),
		});
	};

	if (isLoading) return <LoadingSpinner title="Carregando obras..." />;
	if (error) return <ErrorFeedback message="Erro ao carregar obras." />;
	if (!data || data.data.length === 0) {
		return (
			<PageContainer
				DesktopHeader={
					<PageHeader
						eyebrow="Gestão"
						title="Obras"
						description={
							searchParams.q
								? "Nenhum resultado encontrado."
								: "Nenhuma obra cadastrada."
						}
					/>
				}
			>
				<div className="mb-4 flex gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Buscar obras..."
							value={searchParams.q ?? ""}
							onChange={(e) => handleSearch(e.target.value)}
							className="pl-9 pr-9"
						/>
						{searchParams.q && (
							<button
								type="button"
								onClick={() => handleSearch("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
				</div>
				<EmptyStateCard
					icon={HardHat}
					title={
						searchParams.q
							? "Nenhum resultado encontrado"
							: "Nenhuma obra encontrada"
					}
					description={
						searchParams.q
							? "Tente ajustar sua busca."
							: "Crie sua primeira obra em um centro de custo para começar."
					}
					actions={
						searchParams.q ? undefined : (
							<Button
								variant="default"
								size="sm"
								onClick={() => navigate({ to: "/app/obras/new" })}
							>
								<Plus className="mr-2 h-4 w-4" />
								Nova obra
							</Button>
						)
					}
				/>
			</PageContainer>
		);
	}

	const paginationMeta: PaginationMeta = getPaginationMeta(data);
	const rows: WorkListingRow[] = data.data.map(
		(w: WorkSummaryWithHierarchy) => ({
			...w,
			orgId: w.organizationId ?? "",
			ccId: w.costCenterId ?? "",
		}),
	);

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					eyebrow="Gestão"
					title="Obras"
					description="Todas as obras cadastradas"
					actions={
						<Link to="/app/obras/new">
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Nova obra
							</Button>
						</Link>
					}
				/>
			}
		>
			<WorkTable
				works={rows}
				showParentColumns
				pageSize={data.limit}
				searchValue={searchParams.q ?? ""}
				onSearchChange={handleSearch}
				onDelete={setDeleteTarget}
			/>
			<PaginationBar meta={paginationMeta} onPageChange={handlePageChange} />
			<ConfirmDialog
				open={!!deleteTarget}
				title="Excluir obra?"
				description="Esta ação solicitará a exclusão permanente da obra e dos dados vinculados, incluindo orçamento, custos, medições, contratos e histórico operacional. A exclusão pode exigir aprovação; os dados só serão removidos quando a solicitação for executada. Deseja continuar?"
				confirmLabel="Confirmar exclusão"
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
				onCancel={() => setDeleteTarget(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
