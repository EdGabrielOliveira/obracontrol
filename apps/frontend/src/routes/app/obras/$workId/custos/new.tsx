import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getBudgetItems, getCurrentCostBudgetItems } from "@/api/budget";
import { createCost } from "@/api/costs";
import { workKeys, workSupplierKeys } from "@/api/query-keys";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CostForm } from "@/components/organisms/costs/cost-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { queryClient } from "@/lib/query-client";
import type { CostFormValues } from "@/schemas/costs";
import { getErrorMessage } from "@/utils/api-error";
import { parseCurrencyToNumber } from "@/utils/currency";

export const Route = createFileRoute("/app/obras/$workId/custos/new")({
	loader: ({ params }) => {
		void Promise.all([
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
		queryFn: () => getBudgetItems(workId, { includePhysicalFinancial: false }),
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
		mutationFn: (values: CostFormValues) =>
			createCost(workId, {
				title: values.title,
				items: values.items.map((item) => ({
					budgetVersionItemId: item.budgetVersionItemId,
					costDate: item.costDate,
					category: item.category,
					categoryDetail: item.categoryDetail,
					description: item.description,
					amount: parseCurrencyToNumber(item.amount) ?? 0,
					costType: item.costType,
					supplierId: item.supplierId || null,
					paymentStatus: item.paymentStatus,
				})),
			}),
		onSuccess: () => {
			toast.success("Custo criado com sucesso!");
			// The costs page keeps its result fresh for two minutes. Invalidate it
			// before navigating so a newly created cost is visible immediately.
			queryClient.invalidateQueries({ queryKey: workKeys.costs(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.costsList(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.management(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
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
				description="Crie um custo com um ou mais itens associados ao orçamento."
			/>

			<CostForm
				workId={workId}
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
