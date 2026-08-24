import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { FileSpreadsheet, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { listContractRequests } from "@/api/contract-requests";
import {
	type ContractFilter,
	deleteContract,
	listContracts,
} from "@/api/contracts";
import { exportContratos } from "@/api/export";
import { workKeys } from "@/api/query-keys";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import {
	ContractTable,
	type ContractTableRow,
} from "@/organisms/contracts/contract-table";
import { contractStatusSchema } from "@/schemas/contracts";
import { paginationSchema } from "@/schemas/pagination";
import type { PaginationMeta } from "@/types/shared";
import { getPaginationMeta } from "@/utils/pagination";

const contractFilterSchema = z
	.object({
		q: z.string().max(100).optional(),
		status: contractStatusSchema.optional(),
		supplierName: z.string().optional(),
	})
	.merge(paginationSchema);

type ContractFilterSchema = z.infer<typeof contractFilterSchema>;

export const Route = createFileRoute("/app/obras/$workId/contratos/")({
	validateSearch: contractFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	component: RouteComponent,
	loader: async ({ params, deps }) =>
		await queryClient.prefetchQuery({
			queryKey: workKeys.contractsList(
				params.workId,
				deps.search as Record<string, unknown>,
			),
			queryFn: () =>
				listContracts(params.workId, deps.search as ContractFilter),
		}),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Contratos - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({
		from: "/app/obras/$workId/contratos/",
	});
	const searchParams = useSearch({ from: Route.id }) as ContractFilterSchema;
	const navigate = useNavigate({ from: Route.id });
	const queryClient = useQueryClient();

	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: workKeys.contractsList(
			workId,
			searchParams as Record<string, unknown>,
		),
		queryFn: () => listContracts(workId, searchParams as ContractFilter),
		staleTime: 2 * 60 * 1000,
	});
	const { data: pendingRequests = [] } = useQuery({
		queryKey: ["contract-requests", workId],
		queryFn: () => listContractRequests(workId),
		staleTime: 30_000,
	});

	const handlePageChange = (page: number) => {
		navigate({
			search: (prev) => ({ ...prev, page }),
		});
	};

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteContract(workId, id),
		onSuccess: () => {
			toast.success("Contrato excluído.");
			queryClient.invalidateQueries({ queryKey: workKeys.contracts(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.bi(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.reports(workId) });
			setDeleteId(null);
		},
		onError: () => toast.error("Erro ao excluir contrato."),
	});

	const handleExport = async () => {
		try {
			const blob = await exportContratos(workId);
			downloadBlob(blob, `contratos-${workId}.xlsx`);
			toast.success("Exportação concluída!");
		} catch {
			toast.error("Erro ao exportar contratos.");
		}
	};

	const handleRowClick = (contract: ContractTableRow) => {
		if (contract.isPending) {
			navigate({
				to: "/app/obras/$workId/contratos/$requestId/comparativo",
				params: { workId, requestId: contract.requestId },
			});
			return;
		}
		navigate({
			to: "/app/obras/$workId/contratos/$contractId",
			params: { workId, contractId: contract.id },
		});
	};

	const handleNewContract = () =>
		navigate({
			to: "/app/obras/$workId/contratos/new",
			params: { workId },
		});

	if (isLoading) return <LoadingSpinner title="Carregando contratos..." />;
	if (error || !data) return <ErrorFeedback onRetry={() => refetch()} />;

	const contractList = data.data;
	const pendingRows: ContractTableRow[] = pendingRequests.map((request) => ({
		id: request.id,
		workId,
		supplierName: request.title,
		supplierId: null,
		contractValue: 0,
		serviceType: request.serviceType,
		title: request.title,
		startDate: null,
		endDate: null,
		status: "PENDENTE",
		notes: null,
		createdAt: request.createdAt,
		isPending: true,
		requestId: request.id,
	}));
	const tableRows: ContractTableRow[] = [...contractList, ...pendingRows];
	const totalContractCount = data.total + pendingRows.length;
	const paginationMeta: PaginationMeta = getPaginationMeta(data);

	if (contractList.length === 0 && pendingRequests.length === 0) {
		return (
			<PageContainer>
				<PageHeader
					eyebrow="Obra"
					title="Contratos"
					description="Contratos da obra"
				/>
				<EmptyStateCard
					icon={FolderOpen}
					title="Nenhum contrato"
					description="Crie um contrato, envie o mapa de propostas e escolha o fornecedor vencedor."
					actions={
						<Button variant="default" size="sm" onClick={handleNewContract}>
							<Plus className="mr-2 h-4 w-4" />
							Novo contrato
						</Button>
					}
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Contratos"
				description={`${totalContractCount} contrato(s)`}
				actions={
					<>
						<Button variant="default" size="sm" onClick={handleNewContract}>
							<Plus className="mr-2 h-4 w-4" />
							Novo contrato
						</Button>
						<Button variant="outline" size="sm" onClick={handleExport}>
							<FileSpreadsheet className="mr-2 h-4 w-4" />
							Exportar
						</Button>
					</>
				}
			/>
			{tableRows.length > 0 ? (
				<Card>
					<CardHeaderWithIcon
						icon={FolderOpen}
						title="Lista de Contratos"
						description="Contratos efetivados e solicitações pendentes"
					/>
					<CardContent>
						<ContractTable
							contracts={tableRows}
							workId={workId}
							onDelete={(id) => setDeleteId(id)}
							onRowClick={handleRowClick}
							onPendingClick={(requestId) =>
								navigate({
									to: "/app/obras/$workId/contratos/$requestId/comparativo",
									params: { workId, requestId },
								})
							}
						/>
					</CardContent>
				</Card>
			) : null}

			{contractList.length > 0 ? (
				<PaginationBar meta={paginationMeta} onPageChange={handlePageChange} />
			) : null}

			<ConfirmDialog
				open={!!deleteId}
				title="Excluir contrato?"
				description="Esta ação não pode ser desfeita."
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				onCancel={() => setDeleteId(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
