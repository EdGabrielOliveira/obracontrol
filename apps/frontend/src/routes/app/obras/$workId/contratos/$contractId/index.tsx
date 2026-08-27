import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	BarChart3,
	Building2,
	ClipboardList,
	DollarSign,
	FilePlus2,
	FileText,
	Pencil,
	RefreshCw,
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
	updateContractMeasurementStatus,
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
	linkContractSupplier,
	listContractAmendments,
	updateContract,
	updateContractAmendment,
} from "@/api/contracts";
import {
	budgetVersionKeys,
	contractKeys,
	contractRequestKeys,
	governanceKeys,
	quotationKeys,
	workKeys,
} from "@/api/query-keys";
import { revertQuotationContract } from "@/api/quotations";
import { linkSupplierToWork } from "@/api/work-suppliers";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	CONTRACT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { AmendmentsTab } from "@/components/organisms/contracts/amendments-tab";
import { ContractReportTab } from "@/components/organisms/contracts/contract-report-tab";
import { ContractStatusModal } from "@/components/organisms/contracts/contract-status-modal";
import { InstrumentReadinessCard } from "@/components/organisms/contracts/instrument-readiness-card";
import { MeasurementsTab } from "@/components/organisms/contracts/measurements-tab";
import { PaymentsTab } from "@/components/organisms/contracts/payments-tab";
import { ServicesTab } from "@/components/organisms/contracts/services-tab";
import { MeasurementStatusModal } from "@/components/organisms/measurements/measurement-status-modal";
import { SupplierSummaryCard } from "@/components/organisms/contracts/supplier-summary-card";
import { SupplierModal } from "@/components/organisms/modals/supplier-modal";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { buildVersionChangeMap } from "@/lib/budget-version-diff";
import { invalidateContractRelated } from "@/lib/invalidate-contract";
import { queryClient } from "@/lib/query-client";
import { supplierImportDefaults } from "@/lib/supplier-import-defaults";
import { contractPaymentCreateSchema } from "@/schemas/contracts";
import type {
	ContractMeasurement,
	ContractStatus,
	PaymentStatus,
} from "@/types/contracts";
import type { MeasurementLifecycleStatus } from "@/types/measurements";
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
	const { role } = useAuth();
	const { workId, contractId } = useParams({
		from: "/app/obras/$workId/contratos/$contractId/",
	});
	const searchParams = useSearch({ from: Route.id });
	const navigate = Route.useNavigate();

	const [revertDialogOpen, setRevertDialogOpen] = useState(false);
	const [statusModalOpen, setStatusModalOpen] = useState(false);
	const [measurementStatusTarget, setMeasurementStatusTarget] =
		useState<ContractMeasurement | null>(null);
	const [supplierModalOpen, setSupplierModalOpen] = useState(false);
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
	const statusMutation = useMutation({
		mutationFn: ({
			status,
			reason,
		}: {
			status: ContractStatus;
			reason?: string;
		}) => updateContract(workId, contractId, { status, statusReason: reason }),
		onSuccess: (result) => {
			setStatusModalOpen(false);
			if (result.status === "PENDING") {
				const approver =
					result.approvalRequest.requiredApproverRole === "GESTOR"
						? "Gestor"
						: "Gerente";
				toast.success(
					`Alteração de status enviada para aprovação do ${approver}.`,
				);
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(workId),
				});
				return;
			}
			toast.success("Status do contrato atualizado.");
			invalidateContractRelated(queryClient, workId, contractId);
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(
					error,
					"Não foi possível alterar o status do contrato.",
				),
			),
	});
	const measurementStatusMutation = useMutation({
		mutationFn: ({
			measurementId,
			status,
			reason,
		}: {
			measurementId: string;
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
			setMeasurementStatusTarget(null);
			toast.success("Status da medição atualizado.");
			invalidateContractRelated(queryClient, workId, contractId);
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível alterar o status da medição."),
			),
	});
	const readinessQuery = useQuery({
		queryKey: contractKeys.instrumentReadiness(workId, contractId),
		queryFn: () => getContractInstrumentReadiness(workId, contractId),
	});
	const linkSupplierMutation = useMutation({
		mutationFn: async (supplierId: string) => {
			await linkSupplierToWork(workId, supplierId);
			return linkContractSupplier(workId, contractId, supplierId);
		},
		onSuccess: (result) => {
			if (result.status === "PENDING") {
				const approver =
					result.approvalRequest.requiredApproverRole === "GESTOR"
						? "Gestor"
						: "Gerente";
				toast.success(`Vínculo enviado para aprovação do ${approver}.`);
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(workId),
				});
				return;
			}
			toast.success("Fornecedor cadastrado e vinculado ao contrato.");
			invalidateContractRelated(queryClient, workId, contractId);
			queryClient.invalidateQueries({
				queryKey: contractKeys.instrumentReadiness(workId, contractId),
			});
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível vincular o fornecedor."),
			),
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
		mutationFn: async () => {
			if (contract?.contractRequestId) {
				const result = await revertContractRequestAcceptance(
					workId,
					contract.contractRequestId,
				);
				return { source: "contract-request" as const, id: result.requestId };
			}
			if (contract?.quotationId) {
				const quotation = await revertQuotationContract(
					workId,
					contract.quotationId,
				);
				return { source: "quotation" as const, id: quotation.id };
			}
			throw new Error("Este contrato não veio de uma cotação.");
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
			queryClient.invalidateQueries({ queryKey: quotationKeys.all });
			queryClient.invalidateQueries({
				queryKey: workKeys.contracts(workId),
			});
			if (result.source === "contract-request") {
				navigate({
					to: "/app/obras/$workId/contratos/$requestId/comparativo",
					params: { workId, requestId: result.id },
				});
			} else {
				navigate({
					to: "/app/obras/$workId/contratos/$requestId/aprovacao",
					params: { workId, requestId: result.id },
				});
			}
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
			<div className="mb-3">
				<Link
					to="/app/obras/$workId/contratos"
					params={{ workId }}
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Voltar para contratos
				</Link>
			</div>
			<PageHeader
				eyebrow="Contrato"
				title={contract.title?.trim() || contract.code}
				description={`${contract.code} · ${contract.supplierName}`}
				actions={
					<div className="flex flex-wrap justify-end gap-2">
						<StatusBadge status={contract.status} map={CONTRACT_STATUS_MAP} />
						{role !== "SUPERVISOR" && role !== null && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setStatusModalOpen(true)}
								title="Alterar status do contrato"
							>
								<RefreshCw className="h-4 w-4" />
								<span className="hidden sm:inline">Status</span>
							</Button>
						)}
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
							<FileText className="h-4 w-4" />
							<span className="hidden sm:inline">
								{artifactMutation.isPending ? "Gerando..." : "PDF"}
							</span>
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
							<Pencil className="h-4 w-4" />
							<span className="hidden sm:inline">Editar</span>
						</Button>
						{(contract.contractRequestId || contract.quotationId) &&
						contract.status === "RASCUNHO" ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setRevertDialogOpen(true)}
							>
								Voltar para cotação
							</Button>
						) : null}
					</div>
				}
			/>
			<ContractStatusModal
				open={statusModalOpen}
				onOpenChange={setStatusModalOpen}
				currentStatus={contract.status}
				onSave={(status, reason) => statusMutation.mutate({ status, reason })}
				loading={statusMutation.isPending}
			/>
			<MeasurementStatusModal
				open={measurementStatusTarget !== null}
				onOpenChange={(open) => {
					if (!open) setMeasurementStatusTarget(null);
				}}
				currentStatus={measurementStatusTarget?.status ?? "RASCUNHO"}
				onSave={(status, reason) => {
					if (!measurementStatusTarget) return;
					measurementStatusMutation.mutate({
						measurementId: measurementStatusTarget.id,
						status,
						reason,
					});
				}}
				loading={measurementStatusMutation.isPending}
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
						isLoading={isMeasurementsLoading}
						isError={!!measurementsError}
						isCreatingMeasurement={createMeasMutation.isPending}
						onRetry={() => refetchMeasurements()}
						onCreateMeasurement={(input) =>
							requestCreationConfirmation(() =>
								createMeasMutation.mutate(input),
							)
						}
						onDeleteMeasurement={(id) => deleteMeasMutation.mutate(id)}
						canChangeMeasurementStatus={
							role !== null && role !== "SUPERVISOR"
						}
						onOpenMeasurementStatus={setMeasurementStatusTarget}
						isUpdatingMeasurementStatus={
							measurementStatusMutation.isPending
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
					<SupplierSummaryCard
						supplier={contract.supplier}
						candidate={contract.supplierCandidate}
						onRegister={
							contract.supplierCandidate
								? () => setSupplierModalOpen(true)
								: undefined
						}
						isRegistering={linkSupplierMutation.isPending}
					/>
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
				description="O contrato RASCUNHO será removido e a cotação voltará para comparação e negociação. Essa ação só é permitida enquanto não houver medições, pagamentos, documentos ou aditivos cadastrados."
				confirmLabel="Voltar para cotação"
				onConfirm={() => revertAcceptanceMutation.mutate()}
				onCancel={() => setRevertDialogOpen(false)}
				loading={revertAcceptanceMutation.isPending}
			/>
			<SupplierModal
				open={supplierModalOpen}
				onOpenChange={setSupplierModalOpen}
				defaultValues={
					contract.supplierCandidate
						? supplierImportDefaults(contract.supplierCandidate)
						: undefined
				}
				onCreated={async (supplier) => {
					await linkSupplierMutation.mutateAsync(supplier.id);
				}}
			/>
		</PageContainer>
	);
}
