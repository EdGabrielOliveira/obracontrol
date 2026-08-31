import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { getBudgetItems } from "@/api/budget";
import { listMeasurementCoverages } from "@/api/measurement-coverage";
import { measurementCoverageKeys, workKeys } from "@/api/query-keys";
import { getWorkMeasurement } from "@/api/work-measurements";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { WorkMeasurementEditModal } from "@/components/organisms/modals/work-measurement-edit-modal";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute(
	"/app/obras/$workId/medicoes/$measurementId/edit",
)({
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.measurementDetail(
					params.workId,
					params.measurementId,
				),
				queryFn: () => getWorkMeasurement(params.workId, params.measurementId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.budget(params.workId),
				queryFn: () =>
					getBudgetItems(params.workId, { includePhysicalFinancial: false }),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, measurementId } = useParams({
		from: "/app/obras/$workId/medicoes/$measurementId/edit",
	});
	const navigate = useNavigate();
	const measurementQuery = useQuery({
		queryKey: workKeys.measurementDetail(workId, measurementId),
		queryFn: () => getWorkMeasurement(workId, measurementId),
	});
	const budgetQuery = useQuery({
		queryKey: workKeys.budget(workId),
		queryFn: () =>
			getBudgetItems(workId, { includePhysicalFinancial: false }),
	});
	const coveragesQuery = useQuery({
		queryKey: measurementCoverageKeys.list(workId),
		queryFn: () => listMeasurementCoverages(workId),
	});
	const coveredItemIds = useMemo(
		() =>
			new Set(
				(coveragesQuery.data ?? []).map(
					(coverage) => coverage.workMeasurementItemId,
				),
			),
		[coveragesQuery.data],
	);

	if (measurementQuery.isLoading || budgetQuery.isLoading)
		return <LoadingSpinner title="Carregando edição da medição..." />;
	if (measurementQuery.error || budgetQuery.error) return <ErrorFeedback />;
	if (!measurementQuery.data) return <LoadingSpinner />;

	const measurement = measurementQuery.data.measurement;
	const budgetItems = budgetQuery.data?.items ?? [];
	const goBack = () =>
		navigate({
			to: "/app/obras/$workId/medicoes/$measurementId",
			params: { workId, measurementId },
		});

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Medições"
				title={`Editar medição #${measurement.number}`}
				description="Atualize os dados e os itens medidos."
			/>
			<Card>
				<CardContent className="pt-6">
					<WorkMeasurementEditModal
						open
						embedded
						onOpenChange={(open) => {
							if (!open) goBack();
						}}
						workId={workId}
						measurement={measurement}
						budgetItems={budgetItems}
						coveredItemIds={coveredItemIds}
						onResult={(result) => {
							if (!result.warnings?.length) return;
							toast.warning(
								result.approvalStatus === "PENDING_APPROVAL"
									? "Medição enviada para aprovação."
									: result.warnings[0].message,
							);
						}}
					/>
				</CardContent>
			</Card>
		</PageContainer>
	);
}
