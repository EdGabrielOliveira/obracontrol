import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	contractKeys,
	quotationKeys,
	supplierKeys,
	workKeys,
} from "@/api/query-keys";
import {
	addQuotationProposal,
	chooseQuotationWinner,
	getQuotationComparison,
	negotiateQuotationProposal,
	requoteQuotation,
} from "@/api/quotations";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { InputFormField } from "@/components/molecules/FormField";
import { ManualContractRequestProposalDialog } from "@/components/organisms/contracts/manual-contract-request-proposal-dialog";
import { QuotationComparisonView } from "@/components/organisms/contracts/quotation-comparison";
import { SupplierModal } from "@/components/organisms/modals/supplier-modal";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { supplierImportDefaults } from "@/lib/supplier-import-defaults";
import type { ManualContractRequestProposalInput } from "@/types/contract-requests";
import type { QuotationComparisonProposal } from "@/types/quotations";
import { getErrorMessage } from "@/utils/api-error";

const negotiateSchema = z.object({
	value: z.coerce.number().positive("Valor deve ser maior que zero"),
	justification: z.string().trim().min(1, "Justificativa obrigatória"),
});

type NegotiateValues = z.infer<typeof negotiateSchema>;

export function buildContractApprovalPath(workId: string, requestId: string) {
	return `/app/obras/${workId}/contratos/${requestId}/aprovacao`;
}

export function canApproveQuotation(role: string | null | undefined) {
	return (
		role === "ADMIN" ||
		role === "GERENTE" ||
		role === "GESTOR" ||
		role === "SUPERVISOR"
	);
}

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/$requestId/aprovacao/",
)({
	component: RouteComponent,
	loader: ({ params }) => {
		void queryClient.prefetchQuery({
			queryKey: quotationKeys.comparison(params.workId, params.requestId),
			queryFn: () => getQuotationComparison(params.workId, params.requestId),
		}).catch(() => undefined);
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Aprovação do contrato - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, requestId } = useParams({
		from: "/app/obras/$workId/contratos/$requestId/aprovacao/",
	});
	const navigate = useNavigate({ from: Route.id });
	const routeQueryClient = useQueryClient();
	const { role } = useAuth();
	const [registerTarget, setRegisterTarget] =
		useState<QuotationComparisonProposal | null>(null);
	const [isManualProposalDialogOpen, setIsManualProposalDialogOpen] =
		useState(false);
	const [negotiateTarget, setNegotiateTarget] =
		useState<QuotationComparisonProposal | null>(null);

	const comparisonQuery = useQuery({
		queryKey: quotationKeys.comparison(workId, requestId),
		queryFn: () => getQuotationComparison(workId, requestId),
	});

	const invalidateComparison = () => {
		routeQueryClient.invalidateQueries({
			queryKey: quotationKeys.comparison(workId, requestId),
		});
		routeQueryClient.invalidateQueries({
			queryKey: quotationKeys.list(workId),
		});
	};

	const negotiateMutation = useMutation({
		mutationFn: (values: NegotiateValues) => {
			if (!negotiateTarget) throw new Error("Proposta não selecionada");
			return negotiateQuotationProposal(
				workId,
				requestId,
				negotiateTarget.id,
				values,
			);
		},
		onSuccess: () => {
			setNegotiateTarget(null);
			invalidateComparison();
			toast.success("Proposta negociada.");
		},
		onError: () => toast.error("Não foi possível negociar a proposta."),
	});

	const chooseMutation = useMutation({
		mutationFn: (proposalId: string) =>
			chooseQuotationWinner(workId, requestId, proposalId),
		onSuccess: (quotation, proposalId) => {
			invalidateComparison();
			routeQueryClient.invalidateQueries({ queryKey: quotationKeys.all });
			routeQueryClient.invalidateQueries({
				queryKey: workKeys.contracts(workId),
			});
			routeQueryClient.invalidateQueries({
				queryKey: contractKeys.detailBase(workId),
			});
			if (quotation.status === "ESCOLHIDA") {
				toast.success(
					"Fornecedor escolhido. Complete o cadastro para gerar o contrato.",
				);
				setRegisterTarget(
					comparisonQuery.data?.proposals.find(
						(proposal) => proposal.id === proposalId,
					) ?? null,
				);
				return;
			}
			toast.success("Contrato criado em rascunho.");
			if (quotation.contractId) {
				navigate({
					to: "/app/obras/$workId/contratos/$contractId",
					params: { workId, contractId: quotation.contractId },
				});
			}
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível escolher o fornecedor."),
			),
	});

	const requoteMutation = useMutation({
		mutationFn: () => requoteQuotation(workId, requestId),
		onSuccess: () => {
			invalidateComparison();
			toast.success("Nova rodada de cotação aberta.");
		},
		onError: () => toast.error("Não foi possível abrir a recotação."),
	});
	const manualProposalMutation = useMutation({
		mutationFn: (input: ManualContractRequestProposalInput) =>
			addQuotationProposal(workId, requestId, {
				supplierName: input.supplierName,
				supplierDocument: input.cnpj,
				value: input.proposalValue,
				justification: input.notes ?? null,
			}),
		onSuccess: () => {
			setIsManualProposalDialogOpen(false);
			invalidateComparison();
			toast.success("Participante adicionado ao comparativo.");
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível adicionar o participante."),
			),
	});

	if (comparisonQuery.isLoading) {
		return <LoadingSpinner title="Carregando aprovação..." />;
	}
	if (comparisonQuery.error || !comparisonQuery.data) {
		return <ErrorFeedback onRetry={() => void comparisonQuery.refetch()} />;
	}

	const canApprove =
		canApproveQuotation(role) && comparisonQuery.data.status !== "CONTRATADA";

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contratos"
				title="Aprovação do contrato"
				description="Revise os concorrentes, cadastre o vencedor quando necessário e aprove."
				actions={
					<Button
						variant="outline"
						onClick={() =>
							navigate({
								to: "/app/obras/$workId/contratos",
								params: { workId },
							})
						}
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Voltar
					</Button>
				}
			/>
			<QuotationComparisonView
				comparison={comparisonQuery.data}
				canApprove={canApprove}
				isChoosing={chooseMutation.isPending}
				onRequote={() => requoteMutation.mutate()}
				onNegotiate={setNegotiateTarget}
				onChoose={(proposalId) => chooseMutation.mutate(proposalId)}
				onRegisterSupplier={setRegisterTarget}
				onCreateProposal={() => setIsManualProposalDialogOpen(true)}
			/>
			<SupplierModal
				open={registerTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setRegisterTarget(null);
						routeQueryClient.invalidateQueries({ queryKey: supplierKeys.all });
						invalidateComparison();
					}
				}}
				defaultValues={
					registerTarget
						? supplierImportDefaults({
								name: registerTarget.supplierName,
								document: registerTarget.supplierDocument,
								address: registerTarget.supplierAddress,
								phone: registerTarget.supplierPhone,
								email: registerTarget.supplierEmail,
								responsibleName: registerTarget.supplierResponsible,
							})
						: undefined
				}
				onCreated={() => {
					const proposalId = registerTarget?.id;
					setRegisterTarget(null);
					if (proposalId) chooseMutation.mutate(proposalId);
				}}
			/>
			<ManualContractRequestProposalDialog
				open={isManualProposalDialogOpen}
				onOpenChange={setIsManualProposalDialogOpen}
				onSubmit={(input) => manualProposalMutation.mutate(input)}
				isSubmitting={manualProposalMutation.isPending}
			/>
			<NegotiateDialog
				open={negotiateTarget !== null}
				proposal={negotiateTarget}
				onOpenChange={(open) => {
					if (!open) setNegotiateTarget(null);
				}}
				onSubmit={(values) => negotiateMutation.mutate(values)}
				isPending={negotiateMutation.isPending}
			/>
		</PageContainer>
	);
}

function NegotiateDialog({
	open,
	proposal,
	onOpenChange,
	onSubmit,
	isPending,
}: {
	open: boolean;
	proposal: QuotationComparisonProposal | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: NegotiateValues) => void;
	isPending: boolean;
}) {
	const form = useForm<NegotiateValues>({
		resolver: zodResolver(negotiateSchema) as Resolver<NegotiateValues>,
		defaultValues: { value: proposal?.value ?? 0, justification: "" },
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Negociar com {proposal?.supplierName}</DialogTitle>
					<DialogDescription>
						Informe o novo valor e a justificativa da negociação.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
					<Controller
						name="value"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Valor negociado (R$)"
								type="number"
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<Controller
						name="justification"
						control={form.control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Justificativa"
								placeholder="Acordo comercial..."
								field={field}
								fieldState={fieldState}
							/>
						)}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" loading={isPending}>
							Confirmar negociação
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
