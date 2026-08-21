import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getBudgetItems, getCurrentCostBudgetItems } from "@/api/budget";
import { createActualCost } from "@/api/costs";
import { workKeys, workSupplierKeys } from "@/api/query-keys";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { ActualCostForm } from "@/components/organisms/costs/actual-cost-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { queryClient } from "@/lib/query-client";
import type { ActualCostFormValues } from "@/schemas/costs";
import { getErrorMessage } from "@/utils/api-error";
import { parseCurrencyToNumber } from "@/utils/currency";

export const Route = createFileRoute("/app/obras/$workId/custos/new")({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.budget(params.workId),
				queryFn: () => getBudgetItems(params.workId),
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
			{ title: "Novo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({ from: "/app/obras/$workId/custos/new" });
	const navigate = useNavigate();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const [submitting, setSubmitting] = useState(false);
	const budget = useQuery({
		queryKey: workKeys.budget(workId),
		queryFn: () => getBudgetItems(workId),
	});
	const costBudget = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
	});
	const suppliers = useQuery({
		queryKey: workSupplierKeys.list(workId),
		queryFn: () => listWorkSuppliers(workId),
	});
	const mutation = useMutation({
		mutationFn: (values: ActualCostFormValues) =>
			createActualCost(workId, {
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
			toast.success("Custo criado com sucesso!");
			navigate({ to: "/app/obras/$workId/custos", params: { workId } });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar custo.")),
		onSettled: () => setSubmitting(false),
	});
	if (budget.isLoading || costBudget.isLoading || suppliers.isLoading)
		return <LoadingSpinner title="Carregando orçamento..." />;
	if (
		budget.error ||
		costBudget.error ||
		!budget.data ||
		!costBudget.data ||
		!suppliers.data
	)
		return <ErrorFeedback />;
	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Novo custo"
				description="Cadastre um custo associado às atividades do orçamento."
			/>

			<ActualCostForm
				workId={workId}
				budgetItems={budget.data?.items}
				costBudgetItems={costBudget.data}
				suppliers={suppliers.data}
				submitting={submitting}
				onSubmit={(values) => {
					requestCreationConfirmation(() => {
						setSubmitting(true);
						mutation.mutate(values);
					});
				}}
				onCancel={() =>
					navigate({ to: "/app/obras/$workId/custos", params: { workId } })
				}
			/>
		</PageContainer>
	);
}
