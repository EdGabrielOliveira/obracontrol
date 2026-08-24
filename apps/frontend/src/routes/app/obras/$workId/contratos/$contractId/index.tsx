import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import {
	BarChart3,
	Building2,
	ClipboardList,
	DollarSign,
	Download,
	FilePlus2,
	FileText,
	Pencil,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	getBudgetVersion,
	getEffectiveBudgetVersion,
	listBudgetVersions,
} from "@/api/budget";
import type { ContractArtifact } from "@/api/contract-artifacts";
import {
	downloadContractArtifact,
	generateContractArtifact,
	getContractInstrumentReadiness,
} from "@/api/contract-artifacts";
import {
	createContractMeasurement,
	deleteContractMeasurement,
	getContractAggregate,
	listContractMeasurements,
	updateContractMeasurement,
	updateContractMeasurementItems,
} from "@/api/contract-measurements";
import {
	createContractPayment,
	deleteContractPayment,
	listContractPayments,
} from "@/api/contract-payments";
import { revertContractRequestAcceptance } from "@/api/contract-requests";
import { listContractServices } from "@/api/contract-services";
import {
	createContractAmendment,
	decideContractAmendment,
	deleteContractAmendment,
	getContract,
	listContractAmendments,
	updateContractAmendment,
} from "@/api/contracts";
import {
	budgetVersionKeys,
	contractKeys,
	contractRequestKeys,
	governanceKeys,
	workKeys,
} from "@/api/query-keys";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { KpiCard } from "@/atoms/kpi-card";
import { KpiGrid } from "@/atoms/kpi-grid";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	CONTRACT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { AmendmentsTab } from "@/components/organisms/contracts/amendments-tab";
import { ContractMeasurementImportAction } from "@/components/organisms/contracts/contract-measurement-import-action";
import { ContractReportTab } from "@/components/organisms/contracts/contract-report-tab";
import { InstrumentReadinessCard } from "@/components/organisms/contracts/instrument-readiness-card";
import { MeasurementsTab } from "@/components/organisms/contracts/measurements-tab";
import { PaymentsTab } from "@/components/organisms/contracts/payments-tab";
import { ServicesTab } from "@/components/organisms/contracts/services-tab";
import { SupplierSummaryCard } from "@/components/organisms/contracts/supplier-summary-card";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildVersionChangeMap } from "@/lib/budget-version-diff";
import { invalidateContractRelated } from "@/lib/invalidate-contract";
import { queryClient } from "@/lib/query-client";
import { contractPaymentCreateSchema } from "@/schemas/contracts";
import type { PaymentStatus } from "@/types/contracts";
import { getErrorMessage } from "@/utils/api-error";
import { parseCurrencyToNumber } from "@/utils/currency";
import { formatCurrency } from "@/utils/format";
import { getPaginationMeta } from "@/utils/pagination";

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/$contractId/",
)({
	validateSearch: z.object({
		tab: z
			.enum([
				"servicos",
				"medicoes",
				"pagamentos",
				"aditivos",
				"fornecedor",
				"relatorio",
			])
			.optional()
			.default("servicos"),
	}),
	loader: ({ params }) => {
		const { workId, contractId } = params;
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: contractKeys.detail(workId, contractId),
				queryFn: () => getContract(workId, contractId),
			}),
			queryClient.prefetchQuery({
				queryKey: workKeys.budgetVersion(workId),
				queryFn: () => getEffectiveBudgetVersion(workId),
			}),
			queryClient.prefetchQuery({
				queryKey: contractKeys.amendments(workId, contractId),
				queryFn: () => listContractAmendments(workId, contractId),
			}),
			queryClient.prefetchQuery({
				queryKey: contractKeys.services(workId, contractId),
				queryFn: () => listContractServices(workId, contractId),
			}),
			queryClient.prefetchQuery({
				queryKey: contractKeys.measurementsList(workId, contractId, {
					page: 1,
					limit: 10,
				}),
				queryFn: () =>
					listContractMeasurements(workId, contractId, { page: 1, limit: 10 }),
			}),
			queryClient.prefetchQuery({
				queryKey: contractKeys.paymentsList(workId, contractId, {
					page: 1,
					limit: 10,
				}),
				queryFn: () =>
					listContractPayments(workId, contractId, { page: 1, limit: 10 }),
			}),
			queryClient.prefetchQuery({
				queryKey: contractKeys.aggregate(workId, contractId),
				queryFn: () => getContractAggregate(workId, contractId),
			}),
			queryClient.prefetchQuery({
				queryKey: contractKeys.instrumentReadiness(workId, contractId),
				queryFn: () => getContractInstrumentReadiness(workId, contractId),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Contrato - ObraControl" },
		],
	}),
});

async function downloadArtifactFile(
	workId: string,
	contractId: string,
	artifact: ContractArtifact,
) {
	const blob = await downloadContractArtifact(workId, contractId, artifact.id);
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = artifact.filename;
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RouteComponent() {
	const { requestCreationConfirmation } = useCreationConfirmation();
	const { workId, contractId } = useParams({
		from: "/app/obras/$workId/contratos/$contractId/",
	});
	const searchParams = useSearch({ from: Route.id });
	const navigate = Route.useNavigate();

	const [revertDialogOpen, setRevertDialogOpen] = useState(false);
	const [hasCheckedBeforeDownload, setHasCheckedBeforeDownload] =
		useState(false);
	const [artifactError, setArtifactError] = useState<string | null>(null);
	const [measPage, setMeasPage] = useState(1);
	const [payPage, setPayPage] = useState(1);
	const [measurementWarnings, setMeasurementWarnings] = useState<
		Array<{
			code: string;
			severity: "warning";
			message: string;
			measurementDate?: string;
			periodStart?: string | null;
			periodEnd?: string | null;
		}>
	>([]);
	const measFilter = { page: measPage, limit: 10 };
	const payFilter = { page: payPage, limit: 10 };
	const handleMeasPageChange = useCallback((p: number) => setMeasPage(p), []);
	const handlePayPageChange = useCallback((p: number) => setPayPage(p), []);

	const { data: contract, isLoading } = useQuery({
		queryKey: contractKeys.detail(workId, contractId),
		queryFn: () => getContract(workId, contractId),
	});
	const readinessQuery = useQuery({
		queryKey: contractKeys.instrumentReadiness(workId, contractId),
		queryFn: () => getContractInstrumentReadiness(workId, contractId),
	});
	const artifactMutation = useMutation({
		mutationFn: () => generateContractArtifact(workId, contractId),
		onSuccess: async (artifact) => {
			try {
				await downloadArtifactFile(workId, contractId, artifact);
				toast.success("PDF do contrato gerado e baixado.");
			} catch (error) {
				toast.error(
					getErrorMessage(error, "PDF gerado, mas não foi possível baixá-lo."),
				);
			}
			queryClient.invalidateQueries({
				queryKey: contractKeys.artifacts(workId, contractId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.instrumentReadiness(workId, contractId),
			});
		},
		onError: (error) => {
			const message = getErrorMessage(
				error,
				"Não foi possível gerar o instrumento.",
			);
			setArtifactError(message);
		},
	});
	const handleGenerateArtifact = async () => {
		setArtifactError(null);
		if (!hasCheckedBeforeDownload) {
			const result = await readinessQuery.refetch();
			if (result.error) return;
			setHasCheckedBeforeDownload(true);
			if (!result.data?.ready) return;
		}
		artifactMutation.mutate();
	};

	const revertAcceptanceMutation = useMutation({
		mutationFn: () => {
			if (!contract?.contractRequestId) {
				throw new Error("Este contrato não veio de uma cotação.");
			}
			return revertContractRequestAcceptance(
				workId,
				contract.contractRequestId,
			);
		},
		onSuccess: (result) => {
			setRevertDialogOpen(false);
			toast.success("Aceite revertido. A cotação voltou para comparação.");
			queryClient.invalidateQueries({
				queryKey: contractKeys.detailBase(workId),
			});
			queryClient.invalidateQueries({
				queryKey: contractRequestKeys.all(workId),
			});
			queryClient.invalidateQueries({
				queryKey: workKeys.contracts(workId),
			});
			navigate({
				to: "/app/obras/$workId/contratos/$requestId/comparativo",
				params: { workId, requestId: result.requestId },
			});
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível reverter o aceite."),
			),
	});

	const { data: services, isLoading: isServicesLoading } = useQuery({
		queryKey: contractKeys.services(workId, contractId),
		queryFn: () => listContractServices(workId, contractId),
		staleTime: 2 * 60 * 1000,
	});

	const {
		data: measurements,
		isLoading: isMeasurementsLoading,
		error: measurementsError,
		refetch: refetchMeasurements,
	} = useQuery({
		queryKey: contractKeys.measurementsList(workId, contractId, measFilter),
		queryFn: () => listContractMeasurements(workId, contractId, measFilter),
		staleTime: 2 * 60 * 1000,
	});

	const { data: payments, isLoading: isPaymentsLoading } = useQuery({
		queryKey: contractKeys.paymentsList(workId, contractId, payFilter),
		queryFn: () => listContractPayments(workId, contractId, payFilter),
		staleTime: 2 * 60 * 1000,
	});

	const { data: paymentMeasurements } = useQuery({
		queryKey: contractKeys.measurementsList(workId, contractId, {
			page: 1,
			limit: 100,
		}),
		queryFn: () =>
			listContractMeasurements(workId, contractId, { page: 1, limit: 100 }),
		staleTime: 2 * 60 * 1000,
	});

	const { data: effectiveBudgetVersion } = useQuery({
		queryKey: workKeys.budgetVersion(workId),
		queryFn: () => getEffectiveBudgetVersion(workId),
	});

	const activeBudgetVersionQuery = useQuery({
		queryKey: budgetVersionKeys.history(workId),
		queryFn: () => listBudgetVersions(workId),
		staleTime: 5 * 60 * 1000,
	});

	const activeBudgetVersion = useMemo(
		() =>
			(activeBudgetVersionQuery.data ?? []).find((version) => version.isActive),
		[activeBudgetVersionQuery.data],
	);

	const activeBudgetDetailQuery = useQuery({
		queryKey: activeBudgetVersion
			? budgetVersionKeys.detail(workId, activeBudgetVersion.id)
			: ["budget-versions", workId, "no-active"],
		queryFn: () => {
			if (!activeBudgetVersion) return Promise.resolve(null);
			return getBudgetVersion(workId, activeBudgetVersion.id);
		},
		enabled: !!activeBudgetVersion,
	});

	const sourceBudgetDetailQuery = useQuery({
		queryKey: activeBudgetVersion?.sourceVersionId
			? budgetVersionKeys.detail(workId, activeBudgetVersion.sourceVersionId)
			: ["budget-versions", workId, "no-source"],
		queryFn: () => {
			if (!activeBudgetVersion?.sourceVersionId) return Promise.resolve(null);
			return getBudgetVersion(workId, activeBudgetVersion.sourceVersionId);
		},
		enabled: !!activeBudgetVersion?.sourceVersionId,
	});

	const budgetVersionChanges = useMemo(() => {
		if (
			!activeBudgetVersion?.sourceVersionId ||
			!activeBudgetDetailQuery.data ||
			!sourceBudgetDetailQuery.data
		) {
			return undefined;
		}
		return buildVersionChangeMap(
			activeBudgetDetailQuery.data.items,
			sourceBudgetDetailQuery.data.items,
		);
	}, [
		activeBudgetVersion,
		activeBudgetDetailQuery.data,
		sourceBudgetDetailQuery.data,
	]);

	const { data: aggregate, isLoading: isAggregateLoading } = useQuery({
		queryKey: contractKeys.aggregate(workId, contractId),
		queryFn: () => getContractAggregate(workId, contractId),
		staleTime: 2 * 60 * 1000,
	});

	const { data: amendments, isLoading: isAmendmentsLoading } = useQuery({
		queryKey: contractKeys.amendments(workId, contractId),
		queryFn: () => listContractAmendments(workId, contractId),
		staleTime: 2 * 60 * 1000,
	});

	const hasAmendments = (amendments?.length ?? 0) > 0;

	const invalidatePayments = () =>
		invalidateContractRelated(queryClient, workId, contractId);

	const createPaymentMutation = useMutation({
		mutationFn: (values: {
			date: string;
			value: number;
			paidValue: number;
			measurementId?: string;
			description?: string;
			retentionValue?: number;
			discountValue?: number;
			status?: PaymentStatus;
			balanceOverride?: boolean;
			reason?: string;
		}) => createContractPayment(workId, contractId, values),
		onSuccess: () => {
			toast.success("Pagamento criado!");
			invalidatePayments();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar pagamento.")),
	});

	const deletePaymentMutation = useMutation({
		mutationFn: (id: string) => deleteContractPayment(workId, contractId, id),
		onSuccess: () => {
			toast.success("Pagamento excluído.");
			invalidatePayments();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir pagamento.")),
	});

	const handleCreatePayment = (values: {
		date: string;
		value: string;
		paidValue: string;
		measurementId?: string;
		description?: string;
		retentionValue?: string;
		discountValue?: string;
		status?: PaymentStatus;
		balanceOverride?: boolean;
		reason?: string;
	}) => {
		const parsed = contractPaymentCreateSchema.safeParse(values);
		if (!parsed.success) {
			toast.error("Dados inválidos.");
			return;
		}
		requestCreationConfirmation(() =>
			createPaymentMutation.mutate({
				date: parsed.data.date,
				value: parseCurrencyToNumber(parsed.data.value) ?? 0,
				paidValue: parseCurrencyToNumber(parsed.data.paidValue) ?? 0,
				measurementId: parsed.data.measurementId || undefined,
				description: parsed.data.description || undefined,
				retentionValue: parsed.data.retentionValue
					? (parseCurrencyToNumber(parsed.data.retentionValue) ?? 0)
					: undefined,
				discountValue: parsed.data.discountValue
					? (parseCurrencyToNumber(parsed.data.discountValue) ?? 0)
					: undefined,
				status: parsed.data.status || undefined,
				balanceOverride: parsed.data.balanceOverride,
				reason: parsed.data.balanceOverride
					? parsed.data.reason?.trim() || undefined
					: undefined,
			}),
		);
	};

	const invalidateContract = () => {
		invalidateContractRelated(queryClient, workId, contractId);
		queryClient.invalidateQueries({
			queryKey: governanceKeys.pendingApprovals(workId),
		});
	};

	const createMeasMutation = useMutation({
		mutationFn: (input: Parameters<typeof createContractMeasurement>[2]) =>
			createContractMeasurement(workId, contractId, input),
		onSuccess: (result) => {
			toast.success("Medição criada!");
			if (result.warnings?.length) {
				setMeasurementWarnings(result.warnings);
				toast.warning(
					result.approvalStatus === "PENDING_APPROVAL"
						? "Medição enviada para aprovação."
						: result.warnings[0].message,
				);
			}
			invalidateContract();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar medição.")),
	});

	const editMeasMutation = useMutation({
		mutationFn: ({
			id,
			values,
		}: {
			id: string;
			values: {
				title: string;
				date: string;
			};
		}) =>
			updateContractMeasurement(workId, contractId, id, {
				title: values.title,
				date: values.date,
			}),
		onSuccess: () => {
			toast.success("Medição atualizada!");
			invalidateContract();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar medição.")),
	});

	const deleteMeasMutation = useMutation({
		mutationFn: (id: string) =>
			deleteContractMeasurement(workId, contractId, id),
		onSuccess: () => {
			toast.success("Medição excluída.");
			invalidateContract();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir medição.")),
	});

	const updateMeasItemsMutation = useMutation({
		mutationFn: ({
			measurementId,
			items,
		}: {
			measurementId: string;
			items: Parameters<typeof updateContractMeasurementItems>[3];
		}) =>
			updateContractMeasurementItems(workId, contractId, measurementId, items),
		onSuccess: () => {
			toast.success("Item atualizado!");
			invalidateContract();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar item.")),
	});

	const invalidateAmendments = () => {
		queryClient.invalidateQueries({
			queryKey: contractKeys.amendments(workId, contractId),
		});
		queryClient.invalidateQueries({
			queryKey: contractKeys.detail(workId, contractId),
		});
		queryClient.invalidateQueries({
			queryKey: contractKeys.aggregate(workId, contractId),
		});
		queryClient.invalidateQueries({
			queryKey: contractKeys.report(workId, contractId),
		});
		queryClient.invalidateQueries({ queryKey: workKeys.contracts(workId) });
		queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
		queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
	};

	const createAmendmentMutation = useMutation({
		mutationFn: (input: Parameters<typeof createContractAmendment>[2]) =>
			createContractAmendment(workId, contractId, input),
		onSuccess: () => {
			toast.success("Aditivo criado!");
			invalidateAmendments();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar aditivo.")),
	});

	const updateAmendmentMutation = useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: Parameters<typeof updateContractAmendment>[3];
		}) => updateContractAmendment(workId, contractId, id, input),
		onSuccess: () => {
			toast.success("Aditivo atualizado!");
			invalidateAmendments();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar aditivo.")),
	});

	const deleteAmendmentMutation = useMutation({
		mutationFn: (id: string) => deleteContractAmendment(workId, contractId, id),
		onSuccess: () => {
			toast.success("Aditivo excluído.");
			invalidateAmendments();
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir aditivo.")),
	});
	const decideAmendmentMutation = useMutation({
		mutationFn: ({
			id,
			decision,
		}: {
			id: string;
			decision: "APPROVE" | "REJECT";
		}) => decideContractAmendment(workId, contractId, id, { decision }),
		onSuccess: () => {
			toast.success("Revisão do aditivo registrada.");
			invalidateAmendments();
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível revisar o aditivo."),
			),
	});

	if (isLoading) return <LoadingSpinner title="Carregando..." />;
	if (!contract) return null;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contrato"
				title={contract.code}
				description={`Fornecedor: ${contract.supplierName}`}
				actions={
					<>
						<StatusBadge status={contract.status} map={CONTRACT_STATUS_MAP} />
						<Button
							variant="outline"
							size="sm"
							disabled={
								artifactMutation.isPending ||
								readinessQuery.isLoading ||
								!readinessQuery.data?.ready
							}
							title={
								readinessQuery.data?.ready
									? "Gerar instrumento do contrato"
									: "Complete os requisitos indicados para gerar o contrato"
							}
							onClick={() => void handleGenerateArtifact()}
						>
							<FileText className="mr-1 h-4 w-4" />
							{artifactMutation.isPending
								? "Gerando e baixando..."
								: "Gerar e baixar PDF"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/app/obras/$workId/contratos/$contractId/edit",
									params: { workId, contractId },
								})
							}
						>
							<Pencil className="h-4 w-4 mr-1" />
							Editar
						</Button>
						{contract.contractRequestId && contract.status === "RASCUNHO" ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setRevertDialogOpen(true)}
							>
								Voltar para cotação
							</Button>
						) : null}
					</>
				}
			/>
			<InstrumentReadinessCard
				readiness={readinessQuery.data}
				isLoading={readinessQuery.isLoading || readinessQuery.isFetching}
				error={
					artifactError ??
					(readinessQuery.error
						? getErrorMessage(
								readinessQuery.error,
								"Não foi possível verificar os requisitos do contrato.",
							)
						: null)
				}
			/>
			{hasAmendments && (
				<div className="mb-4">
					<KpiGrid>
						<KpiCard
							title="Valor total do contrato"
							value={formatCurrency(contract.totalValue)}
							tone="default"
						/>
						<KpiCard
							title="Valor base"
							value={formatCurrency(contract.contractValue)}
							tone="default"
						/>
						<KpiCard
							title="Aditivos"
							value={formatCurrency(contract.amendmentTotal)}
							tone="default"
						/>
					</KpiGrid>
					<p className="mt-2 text-xs text-muted-foreground">
						Valor total consolidado pelo backend (base + aditivos registrados).
					</p>
				</div>
			)}

			<Tabs
				value={searchParams.tab ?? "servicos"}
				onValueChange={(tab) =>
					navigate({
						search: {
							tab: tab as
								| "servicos"
								| "medicoes"
								| "pagamentos"
								| "aditivos"
								| "fornecedor"
								| "relatorio",
						},
					})
				}
			>
				<TabsList className="w-full justify-start mb-4">
					<TabsTrigger value="servicos" className="gap-1.5">
						<FileText className="h-4 w-4" />
						Serviços
					</TabsTrigger>
					<TabsTrigger value="medicoes" className="gap-1.5">
						<ClipboardList className="h-4 w-4" />
						Medições
					</TabsTrigger>
					<TabsTrigger value="pagamentos" className="gap-1.5">
						<DollarSign className="h-4 w-4" />
						Pagamentos
					</TabsTrigger>
					<TabsTrigger value="aditivos" className="gap-1.5">
						<FilePlus2 className="h-4 w-4" />
						Aditivos
					</TabsTrigger>
					<TabsTrigger value="fornecedor" className="gap-1.5">
						<Building2 className="h-4 w-4" />
						Fornecedor
					</TabsTrigger>
					<TabsTrigger value="relatorio" className="gap-1.5">
						<BarChart3 className="h-4 w-4" />
						Relatório
					</TabsTrigger>
				</TabsList>

				<TabsContent value="servicos">
					<ServicesTab
						workId={workId}
						contractId={contractId}
						services={services}
						isLoading={isServicesLoading}
						budgetVersionChanges={budgetVersionChanges}
						contractValue={contract.contractValue}
						quotation={contract.quotation}
					/>
				</TabsContent>
				<TabsContent value="medicoes">
					<MeasurementsTab
						workId={workId}
						contractId={contractId}
						measurements={measurements?.data ?? []}
						services={services ?? []}
						effectiveBudgetVersionId={effectiveBudgetVersion?.budgetVersionId}
						isLoading={isMeasurementsLoading}
						isError={!!measurementsError}
						isCreatingMeasurement={createMeasMutation.isPending}
						isEditingMeasurement={editMeasMutation.isPending}
						isUpdatingItems={updateMeasItemsMutation.isPending}
						onRetry={() => refetchMeasurements()}
						onOpenServices={() => navigate({ search: { tab: "servicos" } })}
						onCreateMeasurement={(input) =>
							requestCreationConfirmation(() =>
								createMeasMutation.mutate(input),
							)
						}
						onEditMeasurement={(id, values) =>
							editMeasMutation.mutate({ id, values })
						}
						onDeleteMeasurement={(id) => deleteMeasMutation.mutate(id)}
						onUpdateMeasurementItems={(measurementId, items) =>
							updateMeasItemsMutation.mutate({ measurementId, items })
						}
						warnings={measurementWarnings}
						onDismissWarnings={() => setMeasurementWarnings([])}
					/>
					{measurements && (
						<PaginationBar
							meta={getPaginationMeta(measurements)}
							onPageChange={handleMeasPageChange}
						/>
					)}
				</TabsContent>
				<TabsContent value="pagamentos">
					<PaymentsTab
						workId={workId}
						contractId={contractId}
						payments={payments?.data}
						measurements={paymentMeasurements?.data}
						isLoading={isPaymentsLoading}
						isCreatingPayment={createPaymentMutation.isPending}
						onCreatePayment={handleCreatePayment}
						onDeletePayment={(id) => deletePaymentMutation.mutate(id)}
					/>
					{payments && (
						<PaginationBar
							meta={getPaginationMeta(payments)}
							onPageChange={handlePayPageChange}
						/>
					)}
				</TabsContent>
				<TabsContent value="aditivos">
					<AmendmentsTab
						amendments={amendments}
						measurements={measurements?.data ?? []}
						isLoading={isAmendmentsLoading}
						isSaving={
							createAmendmentMutation.isPending ||
							updateAmendmentMutation.isPending
						}
						isDeleting={deleteAmendmentMutation.isPending}
						onCreate={(input) =>
							requestCreationConfirmation(() =>
								createAmendmentMutation.mutate(input),
							)
						}
						onUpdate={(id, input) =>
							updateAmendmentMutation.mutate({ id, input })
						}
						onDelete={(id) => deleteAmendmentMutation.mutate(id)}
						onDecide={(id, decision) =>
							decideAmendmentMutation.mutate({ id, decision })
						}
					/>
				</TabsContent>
				<TabsContent value="fornecedor">
					<SupplierSummaryCard supplier={contract.supplier} />
				</TabsContent>
				<TabsContent value="relatorio">
					{isAggregateLoading ? (
						<LoadingSpinner title="Carregando relatório..." />
					) : !aggregate ? (
						<ErrorFeedback />
					) : (
						<ContractReportTab aggregate={aggregate} />
					)}
				</TabsContent>
			</Tabs>

			<ConfirmDialog
				open={revertDialogOpen}
				title="Voltar para a cotação?"
				description="O contrato RASCUNHO será removido e a solicitação voltará para a comparação. Essa ação só é permitida enquanto não houver medições, pagamentos, documentos ou aditivos cadastrados."
				confirmLabel="Voltar para cotação"
				onConfirm={() => revertAcceptanceMutation.mutate()}
				onCancel={() => setRevertDialogOpen(false)}
				loading={revertAcceptanceMutation.isPending}
			/>
		</PageContainer>
	);
}
