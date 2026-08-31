import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getBudgetItems, getCurrentCostBudgetItems } from "@/api/budget";
import { workKeys } from "@/api/query-keys";
import {
	createWorkMeasurement,
	getWorkMeasurementMap,
} from "@/api/work-measurements";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { WorkMeasurementCreateForm } from "@/components/organisms/measurements/work-measurement-create-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { queryClient } from "@/lib/query-client";
import { invalidateWorkMeasurementQueries } from "@/lib/work-measurement-invalidation";
import { buildWorkMeasurementPayload } from "@/lib/work-measurement-payload";
import type { MeasurementCreateValues } from "@/schemas/measurements";
import type { MeasurementTreeItem } from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/obras/$workId/medicoes/new")({
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
				queryKey: workKeys.measurementMap(params.workId),
				queryFn: () => getWorkMeasurementMap(params.workId),
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
	const { workId } = useParams({ from: "/app/obras/$workId/medicoes/new" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const [submitting, setSubmitting] = useState(false);
	const budget = useQuery({
		queryKey: workKeys.budget(workId),
		queryFn: () =>
			getBudgetItems(workId, { includePhysicalFinancial: false }),
	});
	const effectiveBudget = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
	});
	const map = useQuery({
		queryKey: workKeys.measurementMap(workId),
		queryFn: () => getWorkMeasurementMap(workId),
	});
	const available = useMemo(() => {
		const result: Record<string, number> = {};
		const visit = (items: MeasurementTreeItem[]) =>
			items.forEach((item) => {
				result[item.id] = Math.max(
					item.quantity - (item.measuredAccumulated?.quantity ?? 0),
					0,
				);
				if (item.children?.length) visit(item.children);
			});
		visit(map.data?.items ?? []);
		return result;
	}, [map.data]);
	const mutation = useMutation({
		mutationFn: (values: MeasurementCreateValues) =>
			createWorkMeasurement(workId, buildWorkMeasurementPayload(values)),
		onSuccess: () => {
			toast.success("Medição criada com sucesso!");
			invalidateWorkMeasurementQueries(queryClient, workId);
			navigate({ to: "/app/obras/$workId/medicoes", params: { workId } });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar medição.")),
		onSettled: () => setSubmitting(false),
	});
	if (budget.isLoading || effectiveBudget.isLoading)
		return <LoadingSpinner title="Carregando orçamento..." />;
	if (
		budget.error ||
		effectiveBudget.error ||
		!budget.data ||
		!effectiveBudget.data
	)
		return <ErrorFeedback />;
	return (
		<PageContainer className="h-min">
			<PageHeader
				eyebrow="Obra"
				title="Nova medição"
				description="Registre quantidades medidas a partir do orçamento vigente."
			/>

			<WorkMeasurementCreateForm
				workId={workId}
				budgetItems={budget.data.items}
				effectiveBudgetItems={effectiveBudget.data}
				availableQuantities={available}
				submitting={submitting}
				onSubmit={(values) => {
					requestCreationConfirmation(() => {
						setSubmitting(true);
						mutation.mutate(values);
					});
				}}
				onCancel={() =>
					navigate({
						to: "/app/obras/$workId/medicoes",
						params: { workId },
					})
				}
			/>
		</PageContainer>
	);
}
