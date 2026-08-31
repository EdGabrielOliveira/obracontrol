import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getBudgetItems, getCurrentCostBudgetItems } from "@/api/budget";
import { getActualCost, updateActualCost } from "@/api/costs";
import { workKeys, workSupplierKeys } from "@/api/query-keys";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { ActualCostForm } from "@/components/organisms/costs/actual-cost-form";
import { queryClient } from "@/lib/query-client";
import type { ActualCostFormValues } from "@/schemas/costs";
import { getErrorMessage } from "@/utils/api-error";
import { parseCurrencyToNumber } from "@/utils/currency";

export const Route = createFileRoute("/app/obras/$workId/custos/$costId/edit")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.costDetail(params.workId, params.costId),
				queryFn: () => getActualCost(params.workId, params.costId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.budget(params.workId),
				queryFn: () =>
					getBudgetItems(params.workId, { includePhysicalFinancial: false }),
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
	const [submitting, setSubmitting] = useState(false);

	const costQuery = useQuery({
		queryKey: workKeys.costDetail(workId, costId),
		queryFn: () => getActualCost(workId, costId),
	});
	const budgetQuery = useQuery({
		queryKey: workKeys.budget(workId),
		queryFn: () =>
			getBudgetItems(workId, { includePhysicalFinancial: false }),
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
		mutationFn: (values: ActualCostFormValues) =>
			updateActualCost(workId, costId, {
				budgetVersionItemId: values.budgetVersionItemId,
				costDate: values.costDate,
				category: values.category,
				categoryDetail: values.categoryDetail,
				description: values.description,
				amount: parseCurrencyToNumber(values.amount) ?? 0,
				costType: values.costType,
				supplierId: values.supplierId || null,
				paymentStatus: values.paymentStatus,
			}),
		onSuccess: () => {
			toast.success("Custo atualizado com sucesso!");
			client.invalidateQueries({
				queryKey: workKeys.costDetail(workId, costId),
			});
			client.invalidateQueries({ queryKey: workKeys.costs(workId) });
			client.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			navigate({
				to: "/app/obras/$workId/custos/$costId",
				params: { workId, costId },
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar custo.")),
		onSettled: () => setSubmitting(false),
	});

	if (
		costQuery.isLoading ||
		budgetQuery.isLoading ||
		costBudgetQuery.isLoading ||
		suppliersQuery.isLoading
	)
		return <LoadingSpinner title="Carregando custo..." />;
	if (costQuery.error || !costQuery.data) return <ErrorFeedback />;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Custos realizados"
				title="Editar custo"
				description={
					costQuery.data.description || "Atualize os dados do custo."
				}
			/>
			<ActualCostForm
				workId={workId}
				cost={costQuery.data}
				budgetItems={budgetQuery.data?.items}
				costBudgetItems={costBudgetQuery.data}
				suppliers={suppliersQuery.data}
				submitting={submitting}
				onSubmit={(values) => {
					setSubmitting(true);
					mutation.mutate(values);
				}}
				onCancel={() =>
					navigate({
						to: "/app/obras/$workId/custos/$costId",
						params: { workId, costId },
					})
				}
			/>
		</PageContainer>
	);
}
