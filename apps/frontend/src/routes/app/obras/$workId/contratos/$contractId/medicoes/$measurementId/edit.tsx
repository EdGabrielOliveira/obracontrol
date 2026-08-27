import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
	getContractMeasurement,
	updateContractMeasurementStatus,
} from "@/api/contract-measurements";
import { contractKeys, workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	MEASUREMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { ContractMeasurementEditForm } from "@/components/organisms/contracts/contract-measurement-edit-form";
import { Breadcrumb } from "@/components/organisms/layout/breadcrumb";
import { MeasurementStatusModal } from "@/components/organisms/measurements/measurement-status-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { invalidateContractRelated } from "@/lib/invalidate-contract";
import { queryClient } from "@/lib/query-client";
import { useBreadcrumb } from "@/lib/use-breadcrumb";
import type { ContractMeasurementDetailServiceItem } from "@/types/contracts";
import type { MeasurementLifecycleStatus } from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/$contractId/medicoes/$measurementId/edit",
)({
	loader: async ({ params }) => {
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: contractKeys.measurementDetail(
					params.workId,
					params.contractId,
					params.measurementId,
				),
				queryFn: () =>
					getContractMeasurement(
						params.workId,
						params.contractId,
						params.measurementId,
					),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.detail(params.workId),
				queryFn: () => getWork(params.workId),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar medição - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, contractId, measurementId } = useParams({
		from: "/app/obras/$workId/contratos/$contractId/medicoes/$measurementId/edit",
	});
	const navigate = useNavigate();
	const { role } = useAuth();
	const [statusOpen, setStatusOpen] = useState(false);
	const { data, isLoading, error } = useQuery({
		queryKey: contractKeys.measurementDetail(workId, contractId, measurementId),
		queryFn: () => getContractMeasurement(workId, contractId, measurementId),
	});
	const { data: workData } = useQuery({
		queryKey: workKeys.detail(workId),
		queryFn: () => getWork(workId),
		staleTime: 5 * 60 * 1000,
	});
	const statusMutation = useMutation({
		mutationFn: ({
			status,
			reason,
		}: {
			status: MeasurementLifecycleStatus;
			reason?: string;
		}) =>
			updateContractMeasurementStatus(
				workId,
				contractId,
				measurementId,
				status,
				reason,
			),
		onSuccess: () => {
			setStatusOpen(false);
			toast.success("Status da medição atualizado.");
			invalidateContractRelated(queryClient, workId, contractId);
		},
		onError: (mutationError) =>
			toast.error(
				getErrorMessage(
					mutationError,
					"Não foi possível alterar o status da medição.",
				),
			),
	});
	const breadcrumbItems = useBreadcrumb({
		workName: workData?.name,
		workId,
		contractName: data?.contract?.code
			? `${data.contract.code} - ${data.contract.supplierName}`
			: undefined,
		contractId,
		section: data?.measurement
			? `Editar medição #${data.measurement.number}`
			: "Editar medição",
	});

	if (isLoading)
		return <LoadingSpinner title="Carregando edição da medição..." />;
	if (error) return <ErrorFeedback />;
	if (!data) return <LoadingSpinner />;

	const serviceMap = new Map<
		string,
		{ description: string; quantity: number | null; unit: string | null }
	>();
	const walk = (items: ContractMeasurementDetailServiceItem[]) => {
		for (const item of items) {
			serviceMap.set(item.id, {
				description: item.description,
				quantity: item.quantity,
				unit: item.unit,
			});
			if (item.children) walk(item.children);
		}
	};
	walk(data.serviceTree);

	const goToDetail = () =>
		navigate({
			to: "/app/obras/$workId/contratos/$contractId/medicoes/$measurementId",
			params: { workId, contractId, measurementId },
		});

	return (
		<PageContainer>
			<Breadcrumb items={breadcrumbItems} />
			<PageHeader
				eyebrow="Medição de Contrato"
				title={`Editar medição #${data.measurement.number}`}
				description="Atualize os dados e os itens da medição."
				actions={
					<div className="flex flex-wrap items-center justify-end gap-2">
						<StatusBadge
							status={data.measurement.status ?? "RASCUNHO"}
							map={MEASUREMENT_STATUS_MAP}
						/>
						{role !== "SUPERVISOR" && role !== null ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setStatusOpen(true)}
								title="Alterar status da medição"
							>
								Alterar status
							</Button>
						) : null}
					</div>
				}
			/>
			<MeasurementStatusModal
				open={statusOpen}
				onOpenChange={setStatusOpen}
				currentStatus={data.measurement.status ?? "RASCUNHO"}
				onSave={(status, reason) => statusMutation.mutate({ status, reason })}
				loading={statusMutation.isPending}
			/>
			<ContractMeasurementEditForm
				workId={workId}
				contractId={contractId}
				measurement={data.measurement}
				serviceMap={serviceMap}
				onCancel={goToDetail}
			/>
		</PageContainer>
	);
}
