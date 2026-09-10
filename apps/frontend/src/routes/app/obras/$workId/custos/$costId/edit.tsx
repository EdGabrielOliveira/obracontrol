import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { toast } from "sonner";
import { getCurrentCostBudgetItems } from "@/api/budget";
import {
	type Cost,
	getCost,
	toCostUpdateItem,
	type UpdateActualCostInput,
	updateCost,
} from "@/api/costs";
import { workKeys, workSupplierKeys } from "@/api/query-keys";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CostEditItems } from "@/components/organisms/costs/cost-edit-items";
import { queryClient } from "@/lib/query-client";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/obras/$workId/custos/$costId/edit")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.groupedCostDetail(params.workId, params.costId),
				queryFn: () => getCost(params.workId, params.costId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.costBudgetItems(params.workId),
				queryFn: () => getCurrentCostBudgetItems(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: workSupplierKeys.list(params.workId),
				queryFn: () => listWorkSuppliers(params.workId),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar Custo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, costId } = useParams({
		from: "/app/obras/$workId/custos/$costId/edit",
	});
	const navigate = useNavigate();
	const client = useQueryClient();
	const costQuery = useQuery({
		queryKey: workKeys.groupedCostDetail(workId, costId),
		queryFn: () => getCost(workId, costId),
	});
	const costBudgetQuery = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
	});
	const suppliersQuery = useQuery({
		queryKey: workSupplierKeys.list(workId),
		queryFn: () => listWorkSuppliers(workId),
	});
	const mutation = useMutation({
		mutationFn: ({
			itemId,
			patch,
		}: {
			itemId: string;
			patch: UpdateActualCostInput;
		}) => {
			const current = client.getQueryData<Cost>(
				workKeys.groupedCostDetail(workId, costId),
			);
			if (!current) throw new Error("Custo não carregado");
			return updateCost(workId, costId, {
				title: current.title,
				items: current.items.map((item) =>
					toCostUpdateItem(item, item.id === itemId ? patch : {}),
				),
			});
		},
		onSuccess: (updated) => {
			client.setQueryData<Cost>(
				workKeys.groupedCostDetail(workId, costId),
				updated,
			);
			client.invalidateQueries({ queryKey: workKeys.costs(workId) });
			client.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			client.invalidateQueries({ queryKey: workKeys.bi(workId) });
			client.invalidateQueries({ queryKey: workKeys.management(workId) });
			client.invalidateQueries({ queryKey: workKeys.reports(workId) });
			client.invalidateQueries({
				queryKey: workKeys.groupedCostDetail(workId, costId),
			});
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Erro ao salvar os dados do item."));
			client.invalidateQueries({
				queryKey: workKeys.groupedCostDetail(workId, costId),
			});
		},
	});

	if (
		costQuery.isLoading ||
		costBudgetQuery.isLoading ||
		suppliersQuery.isLoading
	)
		return <LoadingSpinner title="Carregando custo..." />;
	if (
		costQuery.error ||
		!costQuery.data ||
		!costBudgetQuery.data ||
		suppliersQuery.error ||
		!suppliersQuery.data
	)
		return <ErrorFeedback />;
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Custos realizados"
				title="Editar custo"
				description={`Edite categoria, pagamento, tipo, observação e valor de “${costQuery.data.title}” diretamente na listagem. As alterações são salvas automaticamente.`}
			/>
			<CostEditItems
				items={costQuery.data.items}
				budgetItems={costBudgetQuery.data.items}
				suppliers={suppliersQuery.data}
				savingItemId={
					mutation.isPending ? mutation.variables?.itemId : undefined
				}
				disabled={mutation.isPending}
				onItemPatch={(itemId, patch) => mutation.mutate({ itemId, patch })}
			/>
			<button
				type="button"
				className="w-fit text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
				onClick={() =>
					navigate({
						to: "/app/obras/$workId/custos/$costId",
						params: { workId, costId },
					})
				}
			>
				Voltar para o custo
			</button>
		</PageContainer>
	);
}
