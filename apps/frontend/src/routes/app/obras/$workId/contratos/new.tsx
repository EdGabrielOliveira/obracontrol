import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { FileText, MapPinned } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getCurrentCostBudgetItems } from "@/api/budget";
import {
	cancelContractRequest,
	confirmContractRequestQuotationMap,
	createContractRequest,
	downloadContractRequestTemplate,
	uploadContractRequestQuotationMap,
} from "@/api/contract-requests";
import { createContract } from "@/api/contracts";
import {
	contractRequestKeys,
	governanceKeys,
	supplierKeys,
	workKeys,
	workSupplierKeys,
} from "@/api/query-keys";
import { listSuppliers } from "@/api/suppliers";
import { listWorkSuppliers } from "@/api/work-suppliers";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { ContractForm } from "@/components/organisms/contracts/contract-form";
import { ContractRequestForm } from "@/components/organisms/contracts/contract-request-form";
import { QuotationMapPreview } from "@/components/organisms/contracts/quotation-map-preview";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import type { QuotationRequestValues } from "@/schemas/quotation-request";
import type { ContractRequestDetail } from "@/types/contract-requests";
import type { ImportPreviewPage } from "@/types/import";
import { getErrorMessage } from "@/utils/api-error";
import { createIdempotencyKey } from "@/utils/idempotency-key";

export function buildContractRequestPath(workId: string) {
	return `/app/obras/${workId}/contratos/new`;
}

const contractCreationSearchSchema = z.object({
	mode: z.enum(["new", "in-progress"]).optional(),
});

export const Route = createFileRoute("/app/obras/$workId/contratos/new")({
	validateSearch: contractCreationSearchSchema,
	component: RouteComponent,
	loader: ({ params }) =>
		Promise.all([
			queryClient.prefetchQuery({
				queryKey: workKeys.costBudgetItems(params.workId),
				queryFn: () => getCurrentCostBudgetItems(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: workSupplierKeys.list(params.workId),
				queryFn: () => listWorkSuppliers(params.workId),
			}),
			queryClient.prefetchQuery({
				queryKey: supplierKeys.list({ pageSize: 100 }),
				queryFn: () => listSuppliers({ pageSize: 100 }),
			}),
		]),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Novo contrato - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({
		from: "/app/obras/$workId/contratos/new",
	});
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate({ from: Route.id });
	const routeQueryClient = useQueryClient();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const [flow, setFlow] = useState<"choice" | "quotation" | "manual">(() =>
		search.mode === "in-progress"
			? "manual"
			: search.mode === "new"
				? "quotation"
				: "choice",
	);
	const [request, setRequest] = useState<ContractRequestDetail | null>(null);
	const [preview, setPreview] = useState<ImportPreviewPage | null>(null);
	const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
	const confirmedRef = useRef(false);

	useEffect(() => {
		return () => {
			if (request && !confirmedRef.current) {
				void cancelContractRequest(workId, request.id);
			}
		};
	}, [request, workId]);

	const {
		data: costItems,
		isLoading: isLoadingCostItems,
		error: costItemsError,
		refetch: refetchCostItems,
	} = useQuery({
		queryKey: workKeys.costBudgetItems(workId),
		queryFn: () => getCurrentCostBudgetItems(workId),
		enabled: flow !== "choice",
	});
	const linkedSuppliersQuery = useQuery({
		queryKey: workSupplierKeys.list(workId),
		queryFn: () => listWorkSuppliers(workId),
		enabled: flow === "manual",
	});
	const suppliersQuery = useQuery({
		queryKey: supplierKeys.list({ pageSize: 100 }),
		queryFn: () => listSuppliers({ pageSize: 100 }),
		enabled: flow === "manual",
	});

	const createMutation = useMutation({
		mutationFn: async ({
			values,
			file,
		}: {
			values: QuotationRequestValues;
			file: File;
		}) => {
			const created = await createContractRequest(workId, {
				title: values.title,
				serviceType: values.serviceType,
				description: values.description,
				startDate: values.startDate,
				endDate: values.endDate,
				items: values.items,
			});
			const uploadedPreview = await uploadContractRequestQuotationMap(
				workId,
				created.id,
				file,
			);
			return { created, uploadedPreview };
		},
		onSuccess: ({ created, uploadedPreview }) => {
			setRequest(created);
			setPreview(uploadedPreview);
			setSelectedRowIds(
				uploadedPreview.rows
					.filter((row) => row.status !== "INVALID")
					.map((row) => row.id),
			);
			routeQueryClient.setQueryData(
				contractRequestKeys.detail(workId, created.id),
				created,
			);
			toast.success("Solicitação criada. Revise o mapa de cotação.");
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar a solicitação.")),
	});

	const directCreateMutation = useMutation({
		mutationFn: (values: Parameters<typeof createContract>[1]) =>
			createContract(workId, values),
		onSuccess: (result) => {
			if (result.status === "PENDING") {
				const approver =
					result.approvalRequest.requiredApproverRole === "GESTOR"
						? "Gestor"
						: "Gerente";
				 toast.success(
					`Solicitação de criação enviada para aprovação do ${approver}.`,
				);
				routeQueryClient.invalidateQueries({
					queryKey: governanceKeys.mine(workId),
				});
				routeQueryClient.invalidateQueries({
					queryKey: workKeys.contracts(workId),
				});
				navigate({
					to: "/app/obras/$workId/contratos",
					params: { workId },
				});
				return;
			}
			toast.success("Contrato criado com sucesso.");
			routeQueryClient.invalidateQueries({
				queryKey: workKeys.contracts(workId),
			});
			routeQueryClient.invalidateQueries({
				queryKey: workKeys.contractsSummary(workId),
			});
			navigate({
				to: "/app/obras/$workId/contratos/$contractId",
				params: { workId, contractId: result.data.id },
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar contrato.")),
	});

	const confirmMutation = useMutation({
		mutationFn: () => {
			if (!request || !preview) throw new Error("Prévia do mapa indisponível.");
			return confirmContractRequestQuotationMap(
				workId,
				request.id,
				preview.batchId,
				createIdempotencyKey("contract-request"),
				selectedRowIds,
			);
		},
		onSuccess: () => {
			if (!request) return;
			confirmedRef.current = true;
			toast.success(
				"Mapa confirmado. Abra o comparativo para escolher o fornecedor.",
			);
			navigate({
				to: "/app/obras/$workId/contratos/$requestId/comparativo",
				params: { workId, requestId: request.id },
			});
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Erro ao confirmar o mapa de cotação."),
			),
	});

	const handleDownloadTemplate = async () => {
		try {
			const blob = await downloadContractRequestTemplate();
			downloadBlob(blob, "modelo-mapa-cotacao.xlsx");
		} catch {
			toast.error("Não foi possível baixar o modelo de cotação.");
		}
	};

	if (flow === "choice") {
		return (
			<PageContainer>
				<PageHeader
					eyebrow="Contratos"
					title="Novo contrato"
					description="Escolha como deseja cadastrar este contrato."
				/>
				<div className="grid gap-4 md:grid-cols-2">
					<button
						type="button"
						className="text-left transition-transform hover:-translate-y-0.5"
						onClick={() => setFlow("quotation")}
					>
						<Card className="h-full hover:border-primary/50">
							<CardHeaderWithIcon
								icon={MapPinned}
								title="Contrato novo"
								description="Envie o mapa de cotação, compare propostas e escolha o fornecedor vencedor."
							/>
							<CardContent>
								<span className="text-sm font-medium text-primary">
									Continuar com cotação →
								</span>
							</CardContent>
						</Card>
					</button>
					<button
						type="button"
						className="text-left transition-transform hover:-translate-y-0.5"
						onClick={() => setFlow("manual")}
					>
						<Card className="h-full hover:border-primary/50">
							<CardHeaderWithIcon
								icon={FileText}
								title="Contrato em andamento"
								description="Cadastre um contrato já existente sem passar pelo mapa de cotação ou comparativo."
							/>
							<CardContent>
								<span className="text-sm font-medium text-primary">
									Continuar com cadastro manual →
								</span>
							</CardContent>
						</Card>
					</button>
				</div>
				<Button
					variant="outline"
					className="mt-4"
					onClick={() =>
						navigate({
							to: "/app/obras/$workId/contratos",
							params: { workId },
						})
					}
				>
					Cancelar
				</Button>
			</PageContainer>
		);
	}

	if (flow === "quotation" && isLoadingCostItems) {
		return (
			<PageContainer>
				<PageHeader eyebrow="Contratos" title="Novo contrato" />
				<p className="text-sm text-muted-foreground">
					Carregando atividades do orçamento...
				</p>
			</PageContainer>
		);
	}

	if (flow === "quotation" && (costItemsError || !costItems)) {
		return (
			<PageContainer>
				<PageHeader eyebrow="Contratos" title="Novo contrato" />
				<p className="text-sm text-destructive">
					Não foi possível carregar as atividades do orçamento.
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void refetchCostItems()}
				>
					Tentar novamente
				</Button>
			</PageContainer>
		);
	}

	if (
		flow === "manual" &&
		(suppliersQuery.isLoading || linkedSuppliersQuery.isLoading)
	) {
		return <LoadingSpinner title="Carregando fornecedores..." />;
	}
	if (flow === "manual" && (suppliersQuery.error || linkedSuppliersQuery.error)) {
		return (
			<ErrorFeedback
				onRetry={() => {
					void suppliersQuery.refetch();
					void linkedSuppliersQuery.refetch();
				}}
			/>
		);
	}

	if (flow === "manual") {
		return (
			<PageContainer>
				<PageHeader
					eyebrow="Contratos"
					title="Contrato em andamento"
					description="Informe fornecedor, valor, itens e os demais dados do contrato já existente."
				/>
				<ContractForm
					mode="create"
					defaultValues={{ status: "EM_ANDAMENTO" }}
					workId={workId}
					effectiveBudgetItems={costItems}
					showServices
					submitLabel="Criar contrato"
					contractValueLabel="Valor do fornecedor"
					suppliers={linkedSuppliersQuery.data?.map((link) => link.supplier) ?? []}
					linkedSupplierIds={linkedSuppliersQuery.data?.map(
						(link) => link.supplierId,
					)}
					loading={directCreateMutation.isPending}
					onCancel={() => setFlow("choice")}
					onSubmit={(values) =>
						requestCreationConfirmation(() =>
							directCreateMutation.mutate(values),
						)
					}
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contratos"
				title="Novo contrato"
				description="Informe os dados do contrato, selecione os itens do orçamento e envie o mapa de cotação."
			/>
			{request && preview ? (
				<Card>
					<CardHeaderWithIcon
						icon={MapPinned}
						title="Revise o mapa de cotação"
						description="Confira os dados antes de criar o contrato."
					/>
					<CardContent className="space-y-4">
						<QuotationMapPreview
							preview={preview}
							selectedRowIds={selectedRowIds}
							onSelectionChange={setSelectedRowIds}
						/>
						<div className="flex justify-end gap-3">
							<Button
								variant="outline"
								onClick={() => {
									void cancelContractRequest(workId, request.id);
									setRequest(null);
									setPreview(null);
									setSelectedRowIds([]);
								}}
							>
								Recomeçar
							</Button>
							<Button
								loading={confirmMutation.isPending}
								disabled={
									selectedRowIds.length === 0 || confirmMutation.isPending
								}
								onClick={() => confirmMutation.mutate()}
							>
								Confirmar mapa ({selectedRowIds.length})
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<ContractRequestForm
					workId={workId}
					budgetItems={undefined}
					effectiveBudgetItems={costItems}
					isSubmitting={createMutation.isPending}
					onDownloadTemplate={() => void handleDownloadTemplate()}
					onCancel={() =>
						navigate({
							to: "/app/obras/$workId/contratos",
							params: { workId },
						})
					}
					onSubmit={(values, file) =>
						requestCreationConfirmation(() =>
							createMutation.mutate({ values, file }),
						)
					}
				/>
			)}
		</PageContainer>
	);
}
