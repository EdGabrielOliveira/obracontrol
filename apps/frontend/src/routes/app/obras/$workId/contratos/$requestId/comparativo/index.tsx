import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
	getContractRequest,
	getContractRequestComparison,
	negotiateContractRequestProposal,
	selectContractRequestWinner,
} from "@/api/contract-requests";
import {
	contractKeys,
	contractRequestKeys,
	supplierKeys,
} from "@/api/query-keys";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { ContractRequestComparisonView } from "@/components/organisms/contracts/contract-request-comparison";
import { SupplierModal } from "@/components/organisms/modals/supplier-modal";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/query-client";
import { supplierImportDefaults } from "@/lib/supplier-import-defaults";
import type { ContractRequestComparison } from "@/types/contract-requests";
import { getErrorMessage } from "@/utils/api-error";
import { createIdempotencyKey } from "@/utils/idempotency-key";

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/$requestId/comparativo/",
)({
	loader: ({ params }) => {
		void queryClient.prefetchQuery({
			queryKey: contractRequestKeys.comparison(params.workId, params.requestId),
			queryFn: () =>
				getContractRequestComparison(params.workId, params.requestId),
		});
	},
	component: ComparisonRouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Comparativo - ObraControl" },
		],
	}),
});

function ComparisonRouteComponent() {
	const { workId, requestId } = useParams({
		from: "/app/obras/$workId/contratos/$requestId/comparativo/",
	});
	const navigate = useNavigate({ from: Route.id });
	const queryClient = useQueryClient();
	const [registerTarget, setRegisterTarget] = useState<
		ContractRequestComparison["proposals"][number] | null
	>(null);

	const {
		data: comparison,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: contractRequestKeys.comparison(workId, requestId),
		queryFn: () => getContractRequestComparison(workId, requestId),
	});

	const selectMutation = useMutation({
		mutationFn: (proposalId: string) =>
			selectContractRequestWinner(
				workId,
				requestId,
				proposalId,
				createIdempotencyKey("proposal-selection"),
			),
		onSuccess: async (selection) => {
			if (selection.status === "PENDING") {
				const approverLabel =
					selection.requiredApproverRole === "GESTOR"
						? "Gestor"
						: selection.requiredApproverRole === "GERENTE"
							? "Gerente"
							: "responsável definido pelo fluxo";
				toast.success(
					`Fornecedor selecionado. Aguardando aprovação do ${approverLabel}.`,
				);
			} else {
				toast.success("Aprovação concluída. Contrato criado.");
			}
			queryClient.invalidateQueries({
				queryKey: contractRequestKeys.all(workId),
			});
			queryClient.invalidateQueries({
				queryKey: contractKeys.detailBase(workId),
			});
			const contractId =
				selection.contractId ??
				selection.data?.id ??
				(selection.status === "EXECUTED"
					? (await getContractRequest(workId, requestId)).contractId
					: null);
			if (contractId) {
				await navigate({
					to: "/app/obras/$workId/contratos/$contractId",
					params: { workId, contractId },
				});
			}
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao selecionar a proposta.")),
	});
	const negotiateMutation = useMutation({
		mutationFn: ({
			proposalId,
			value,
			reason,
		}: {
			proposalId: string;
			value: number;
			reason: string;
		}) =>
			negotiateContractRequestProposal(
				workId,
				requestId,
				proposalId,
				value,
				reason,
			),
		onSuccess: () => {
			toast.success("Valor negociado atualizado.");
			queryClient.invalidateQueries({
				queryKey: contractRequestKeys.comparison(workId, requestId),
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao negociar proposta.")),
	});

	if (isLoading) return <LoadingSpinner title="Carregando comparativo..." />;
	if (error || !comparison)
		return (
			<PageContainer>
				<PageHeader eyebrow="Contratos" title="Comparativo" />
				<p className="text-sm text-destructive">
					Não foi possível carregar o comparativo.
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Tentar novamente
				</Button>
			</PageContainer>
		);

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contratos"
				title={comparison.request.title}
				description="Compare as propostas com o orçamento e aceite o fornecedor vencedor."
			/>
			<ContractRequestComparisonView
				comparison={comparison}
				isAccepting={selectMutation.isPending}
				onAccept={(proposalId) => selectMutation.mutate(proposalId)}
				onRegisterSupplier={setRegisterTarget}
				isNegotiating={negotiateMutation.isPending}
				onNegotiate={(proposalId, value, reason) =>
					negotiateMutation.mutate({ proposalId, value, reason })
				}
			/>
			<SupplierModal
				open={registerTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setRegisterTarget(null);
						queryClient.invalidateQueries({ queryKey: supplierKeys.all });
						queryClient.invalidateQueries({
							queryKey: contractRequestKeys.comparison(workId, requestId),
						});
					}
				}}
				defaultValues={
					registerTarget
						? supplierImportDefaults({
								name: registerTarget.supplier.name,
								document: registerTarget.supplier.cnpj,
								address: registerTarget.supplier.address,
								phone: registerTarget.supplier.phone,
								email: registerTarget.supplier.email,
								responsibleName: registerTarget.supplier.responsibleName,
							})
						: undefined
				}
				onCreated={() => {
					const proposalId = registerTarget?.id;
					setRegisterTarget(null);
					if (proposalId) selectMutation.mutate(proposalId);
				}}
			/>
		</PageContainer>
	);
}
