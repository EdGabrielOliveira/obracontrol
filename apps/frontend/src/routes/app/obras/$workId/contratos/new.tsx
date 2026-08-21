import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { MapPinned } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCurrentCostBudgetItems } from "@/api/budget";
import {
	cancelContractRequest,
	confirmContractRequestQuotationMap,
	createContractRequest,
	downloadContractRequestTemplate,
	uploadContractRequestQuotationMap,
} from "@/api/contract-requests";
import { contractRequestKeys, workKeys } from "@/api/query-keys";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
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

export const Route = createFileRoute("/app/obras/$workId/contratos/new")({
	component: RouteComponent,
	loader: ({ params }) =>
		queryClient.prefetchQuery({
			queryKey: workKeys.costBudgetItems(params.workId),
			queryFn: () => getCurrentCostBudgetItems(params.workId),
		}),
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
	const navigate = useNavigate({ from: Route.id });
	const routeQueryClient = useQueryClient();
	const { requestCreationConfirmation } = useCreationConfirmation();
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
		retry: 1,
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

	if (isLoadingCostItems) {
		return (
			<PageContainer>
				<PageHeader eyebrow="Contratos" title="Novo contrato" />
				<p className="text-sm text-muted-foreground">
					Carregando atividades do orçamento...
				</p>
			</PageContainer>
		);
	}

	if (costItemsError || !costItems) {
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
