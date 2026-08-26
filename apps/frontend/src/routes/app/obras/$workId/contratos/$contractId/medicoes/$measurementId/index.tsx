import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { FileDown, Gauge, ListChecks, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Controller, type Path, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	downloadContractMeasurementPdf,
	getContractMeasurement,
	updateContractMeasurementItems,
} from "@/api/contract-measurements";
import { getGovernanceRecord } from "@/api/governance";
import { contractKeys, governanceKeys, workKeys } from "@/api/query-keys";
import { getWork } from "@/api/works";
import { EmptyState } from "@/components/atoms/empty-state";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { InputFormField } from "@/components/molecules/FormField";
import {
	GovernanceStatusBadge,
	GovernanceStatusModal,
} from "@/components/organisms/governance/governance-status-modal";
import { Breadcrumb } from "@/components/organisms/layout/breadcrumb";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import type {
	ContractMeasurementDetailServiceItem,
	ContractMeasurementItem,
} from "@/types/contracts";
import { parseCurrencyToNumber } from "@/utils/currency";
import { formatCurrency, formatDate, formatPercentage } from "@/utils/format";

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
	const { role } = useAuth();
	const [governanceOpen, setGovernanceOpen] = useState(false);
	const governanceQuery = useQuery({
		queryKey: governanceKeys.detail(
			"CONTRACT_MEASUREMENT_STATUS",
			measurementId,
		),
		queryFn: () =>
			getGovernanceRecord("CONTRACT_MEASUREMENT_STATUS", measurementId),
	});

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
	const [downloading, setDownloading] = useState(false);
	const [editOpen, setEditOpen] = useState(false);

	const updateItemsMutation = useMutation({
		mutationFn: (items: Parameters<typeof updateContractMeasurementItems>[3]) =>
			updateContractMeasurementItems(workId, contractId, measurementId, items),
		onSuccess: () => {
			toast.success("Medição atualizada!");
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurements(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementDetail(
					workId,
					contractId,
					measurementId,
				),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.measurementMap(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.aggregate(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.report(workId, contractId),
			});
			setEditOpen(false);
		},
		onError: () => toast.error("Erro ao atualizar medição."),
	});

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
						<GovernanceStatusBadge record={governanceQuery.data} />
						{role !== "SUPERVISOR" && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setGovernanceOpen(true)}
							>
								Alterar status
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
							onClick={() => setEditOpen(true)}
						>
							<Pencil className="mr-2 h-4 w-4" />
							Editar
						</Button>
					</>
				}
			/>
			<GovernanceStatusModal
				open={governanceOpen}
				onOpenChange={setGovernanceOpen}
				entityType="CONTRACT_MEASUREMENT_STATUS"
				entityId={measurementId}
				current={governanceQuery.data}
				onChanged={() => governanceQuery.refetch()}
			/>
			<div className="mb-6 flex flex-wrap items-center gap-3">
				{data.totals.contractValue > 0 && (
					<span className="text-sm text-muted-foreground">
						Valor do contrato: {formatCurrency(data.totals.contractValue)}
					</span>
				)}
				{measurement.discountValue != null && (
					<span className="text-sm text-muted-foreground">
						Desconto: {formatCurrency(measurement.discountValue)}
					</span>
				)}
				{measurement.retentionValue != null && (
					<span className="text-sm text-muted-foreground">
						Retenção: {formatCurrency(measurement.retentionValue)}
					</span>
				)}
			</div>
			<Card className="mb-6">
				<CardHeaderWithIcon
					icon={Gauge}
					title="Indicadores"
					description="Totais da medição."
				/>
				<CardContent>
					<div className="flex flex-wrap gap-4">
						<div className="flex-1 min-w-[150px]">
							<p className="text-xs text-muted-foreground">Medido (atual)</p>
							<p className="text-lg font-bold">
								{formatCurrency(data.totals.measuredCurrent)}
							</p>
						</div>
						<div className="flex-1 min-w-[150px]">
							<p className="text-xs text-muted-foreground">
								Medido (acumulado)
							</p>
							<p className="text-lg font-bold">
								{formatCurrency(data.totals.measuredAccumulated)}
							</p>
						</div>
						<div className="flex-1 min-w-[150px]">
							<p className="text-xs text-muted-foreground">Saldo</p>
							<p className="text-lg font-bold">
								{formatCurrency(data.totals.balance)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

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
									<TableHead className="text-right">Valor Medido</TableHead>
									<TableHead className="text-right">% Medido</TableHead>
									<TableHead className="text-right">Qtd Acumulada</TableHead>
									<TableHead className="text-right">Valor Acumulado</TableHead>
									<TableHead className="text-right">% Acumulado</TableHead>
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
												? String(item.measuredQuantity)
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{item.measuredValue != null
												? formatCurrency(item.measuredValue)
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{item.measuredPercentage != null
												? formatPercentage(item.measuredPercentage)
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{item.accumulatedQuantity != null
												? item.accumulatedQuantity
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{item.accumulatedValue != null
												? formatCurrency(item.accumulatedValue)
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{item.accumulatedPercentage != null
												? formatPercentage(item.accumulatedPercentage)
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
			{editOpen && measurement.items && measurement.items.length > 0 && (
				<ContractMeasurementItemsEditModal
					open={editOpen}
					onOpenChange={setEditOpen}
					items={measurement.items}
					serviceMap={serviceMap}
					isPending={updateItemsMutation.isPending}
					onUpdateItems={(items) => updateItemsMutation.mutate(items)}
				/>
			)}
		</PageContainer>
	);
}

const contractMeasurementItemsEditSchema = z.object({
	items: z.array(
		z.object({
			id: z.string().optional(),
			serviceId: z.string().min(1, "Serviço obrigatório"),
			measuredQuantity: z.string().optional(),
			measuredValue: z.string().optional(),
			measuredPercentage: z.string().optional(),
		}),
	),
});

type ContractMeasurementItemsEditValues = z.infer<
	typeof contractMeasurementItemsEditSchema
>;

interface ContractMeasurementItemsEditModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: ContractMeasurementItem[];
	serviceMap: Map<string, string>;
	isPending?: boolean;
	onUpdateItems: (
		items: Parameters<typeof updateContractMeasurementItems>[3],
	) => void;
}

function ContractMeasurementItemsEditModal({
	open,
	onOpenChange,
	items,
	serviceMap,
	isPending,
	onUpdateItems,
}: ContractMeasurementItemsEditModalProps) {
	const { control, handleSubmit } = useForm<ContractMeasurementItemsEditValues>(
		{
			resolver: zodResolver(contractMeasurementItemsEditSchema),
			defaultValues: {
				items: items.map((item) => ({
					id: item.id,
					serviceId: item.serviceId,
					measuredQuantity:
						item.measuredQuantity != null ? String(item.measuredQuantity) : "",
					measuredValue:
						item.measuredValue != null ? String(item.measuredValue) : "",
					measuredPercentage:
						item.measuredPercentage != null
							? String(item.measuredPercentage)
							: "",
				})),
			},
		},
	);

	const { fields } = useFieldArray({ control, name: "items" });

	const onSubmit = (values: ContractMeasurementItemsEditValues) => {
		onUpdateItems(
			values.items.map((item) => ({
				id: item.id || undefined,
				serviceId: item.serviceId,
				measuredQuantity: item.measuredQuantity
					? Number(item.measuredQuantity)
					: undefined,
				measuredValue: item.measuredValue
					? (parseCurrencyToNumber(item.measuredValue) ?? undefined)
					: undefined,
				measuredPercentage: item.measuredPercentage
					? Number(item.measuredPercentage)
					: undefined,
			})),
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Editar Itens da Medição</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="max-h-96 space-y-3 overflow-y-auto pr-1">
						{fields.map((fieldItem, index) => (
							<div
								key={fieldItem.id}
								className="rounded-lg border border-border p-3"
							>
								<p className="mb-2 truncate text-sm font-medium">
									{serviceMap.get(fieldItem.serviceId) ?? fieldItem.serviceId}
								</p>
								<div className="grid grid-cols-3 gap-3">
									<Controller
										name={
											`items.${index}.measuredQuantity` as Path<ContractMeasurementItemsEditValues>
										}
										control={control}
										render={({ field, fieldState }) => (
											<InputFormField
												label="Quantidade Medida"
												field={field}
												fieldState={fieldState}
												type="number"
												step="0.0001"
												placeholder="0"
											/>
										)}
									/>
									<Controller
										name={
											`items.${index}.measuredValue` as Path<ContractMeasurementItemsEditValues>
										}
										control={control}
										render={({ field, fieldState }) => (
											<InputFormField
												label="Valor Medido"
												field={field}
												fieldState={fieldState}
												mode="currency"
												placeholder="0.00"
											/>
										)}
									/>
									<Controller
										name={
											`items.${index}.measuredPercentage` as Path<ContractMeasurementItemsEditValues>
										}
										control={control}
										render={({ field, fieldState }) => (
											<InputFormField
												label="% Medido"
												field={field}
												fieldState={fieldState}
												type="number"
												min="0"
												max="100"
												step="0.01"
												placeholder="0"
											/>
										)}
									/>
								</div>
							</div>
						))}
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" loading={isPending}>
							Salvar
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
