import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { FileDown, ListChecks, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	downloadContractMeasurementPdf,
	getContractMeasurement,
	updateContractMeasurementStatus,
} from "@/api/contract-measurements";
import { contractKeys, workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { EmptyState } from "@/components/atoms/empty-state";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	MEASUREMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Breadcrumb } from "@/components/organisms/layout/breadcrumb";
import { MeasurementStatusModal } from "@/components/organisms/measurements/measurement-status-modal";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { useBreadcrumb } from "@/lib/use-breadcrumb";
import type { ContractMeasurementDetailServiceItem } from "@/types/contracts";
import type { MeasurementLifecycleStatus } from "@/types/measurements";
import { getErrorMessage } from "@/utils/api-error";
import { formatDate, formatPercentage, formatQuantity } from "@/utils/format";

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/$contractId/medicoes/$measurementId/",
)({
	loader: async ({ params }) =>
		await queryClient.prefetchQuery({
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
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Detalhe da Medição - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, contractId, measurementId } = useParams({
		from: "/app/obras/$workId/contratos/$contractId/medicoes/$measurementId/",
	});
	const navigate = useNavigate();
	const { role } = useAuth();
	const [statusOpen, setStatusOpen] = useState(false);

	const { data: workData } = useQuery({
		queryKey: workKeys.detail(workId),
		queryFn: () => getWork(workId),
		staleTime: 5 * 60 * 1000,
	});

	const { data, isLoading, error } = useQuery({
		queryKey: contractKeys.measurementDetail(workId, contractId, measurementId),
		queryFn: () => getContractMeasurement(workId, contractId, measurementId),
	});

	const measurement = data?.measurement;
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
			toast.success("Status da medição atualizado.");
			setStatusOpen(false);
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementDetail(
					workId,
					contractId,
					measurementId,
				),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementsBase(workId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.aggregate(workId, contractId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Não foi possível alterar o status.")),
	});
	const [downloading, setDownloading] = useState(false);
	const handleDownloadPdf = useCallback(async () => {
		setDownloading(true);
		try {
			const blob = await downloadContractMeasurementPdf(
				workId,
				contractId,
				measurementId,
			);
			downloadBlob(blob, `boletim-medicao-contrato-${measurementId}.pdf`);
		} finally {
			setDownloading(false);
		}
	}, [workId, contractId, measurementId]);

	const serviceMap = useMemo(() => {
		if (!data?.serviceTree) return new Map<string, string>();
		const map = new Map<string, string>();
		function walk(items: ContractMeasurementDetailServiceItem[]) {
			for (const item of items) {
				map.set(item.id, item.description);
				if (item.children) walk(item.children);
			}
		}
		walk(data.serviceTree);
		return map;
	}, [data?.serviceTree]);

	const contractName = data?.contract?.code
		? `${data.contract.code} - ${data.contract.supplierName}`
		: undefined;

	const breadcrumbItems = useBreadcrumb({
		workName: workData?.name,
		workId,
		contractName,
		contractId,
		section: `Medição #${measurement?.number ?? ""}`,
	});

	if (isLoading) return <LoadingSpinner title="Carregando medição..." />;
	if (error) return <ErrorFeedback />;
	if (!data || !measurement) return <LoadingSpinner />;

	return (
		<PageContainer>
			<Breadcrumb items={breadcrumbItems} />
			<PageHeader
				eyebrow="Medição de Contrato"
				title={measurement.title ?? "Medição de contrato"}
				description={`#${measurement.number} - ${formatDate(measurement.date)}`}
				actions={
					<>
						<StatusBadge
							status={measurement.status ?? "RASCUNHO"}
							map={MEASUREMENT_STATUS_MAP}
						/>
						{measurement.approvalStatus === "PENDING_APPROVAL" ? (
							<StatusBadge status="PENDING_APPROVAL" />
						) : null}
						{role !== "SUPERVISOR" && role !== null && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setStatusOpen(true)}
							>
								Alterar status da medição
							</Button>
						)}
						<Button
							variant="outline"
							size="sm"
							disabled={downloading}
							onClick={handleDownloadPdf}
						>
							<FileDown className="mr-2 h-4 w-4" />
							{downloading ? "Baixando..." : "Baixar boletim"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/app/obras/$workId/contratos/$contractId/medicoes/$measurementId/edit",
									params: { workId, contractId, measurementId },
								})
							}
						>
							<Pencil className="mr-2 h-4 w-4" />
							Editar
						</Button>
					</>
				}
			/>
			<MeasurementStatusModal
				open={statusOpen}
				onOpenChange={setStatusOpen}
				currentStatus={measurement.status ?? "RASCUNHO"}
				onSave={(status, reason) => statusMutation.mutate({ status, reason })}
				loading={statusMutation.isPending}
			/>
			{measurement.notes && (
				<div className="mb-6 rounded-lg border p-4">
					<p className="text-sm font-medium text-muted-foreground">Notas</p>
					<p className="text-sm">{measurement.notes}</p>
				</div>
			)}

			<Card>
				<CardHeaderWithIcon
					icon={ListChecks}
					title="Itens da Medição"
					description={`${measurement.items?.length ?? 0} item(ns)`}
				/>
				<CardContent>
					{measurement.items && measurement.items.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Serviço</TableHead>
									<TableHead className="text-right">Qtd Medida</TableHead>
									<TableHead className="text-right">% Medido</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{measurement.items.map((item) => (
									<TableRow key={item.id}>
										<TableCell>
											{serviceMap.get(item.serviceId) ?? item.serviceId}
										</TableCell>
										<TableCell className="text-right">
											{item.measuredQuantity != null
													? formatQuantity(item.measuredQuantity)
													: "—"}
										</TableCell>
										<TableCell className="text-right">
											{item.measuredPercentage != null
												? formatPercentage(item.measuredPercentage)
												: "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<EmptyState
							icon={<ListChecks className="size-10" />}
							title="Nenhum item"
							description="Esta medição não possui itens registrados."
						/>
					)}
				</CardContent>
			</Card>
		</PageContainer>
	);
}
