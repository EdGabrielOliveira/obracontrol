import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { getContract } from "@/api/contracts";
import { contractKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { ContractModal } from "@/components/organisms/modals/contract-modal";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute(
	"/app/obras/$workId/contratos/$contractId/edit",
)({
	loader: ({ params }) => {
		void queryClient.prefetchQuery({
			queryKey: contractKeys.detail(params.workId, params.contractId),
			queryFn: () => getContract(params.workId, params.contractId),
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId, contractId } = useParams({
		from: "/app/obras/$workId/contratos/$contractId/edit",
	});
	const navigate = useNavigate();
	const contractQuery = useQuery({
		queryKey: contractKeys.detail(workId, contractId),
		queryFn: () => getContract(workId, contractId),
	});
	if (contractQuery.isLoading)
		return <LoadingSpinner title="Carregando edição do contrato..." />;
	if (contractQuery.error) return <ErrorFeedback />;
	if (!contractQuery.data) return <LoadingSpinner />;

	const goBack = () =>
		navigate({
			to: "/app/obras/$workId/contratos/$contractId",
			params: { workId, contractId },
		});

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Contratos"
				title={`Editar contrato ${contractQuery.data.code}`}
				description="Altere título, tipo de serviço, descrição e período de vigência."
			/>
			<ContractModal
				open
				embedded
				onOpenChange={(open) => {
					if (!open) goBack();
				}}
				workId={workId}
				contract={contractQuery.data}
			/>
		</PageContainer>
	);
}
