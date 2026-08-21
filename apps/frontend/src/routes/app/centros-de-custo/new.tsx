import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { createCostCenter, listOrganizations } from "@/api/organizations";
import { costCenterKeys, organizationKeys } from "@/api/query-keys";
import { listWorkManagers } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CostCenterEditor } from "@/components/organisms/organizations/cost-center-editor";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { queryClient } from "@/lib/query-client";
import type { CostCenterEditValues } from "@/schemas/organizations";
import { getErrorMessage } from "@/utils/api-error";

const newCostCenterSearchSchema = z.object({
	organizationId: z.string().optional(),
});

export const Route = createFileRoute("/app/centros-de-custo/new")({
	validateSearch: newCostCenterSearchSchema,
	loader: () => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: organizationKeys.list({ limit: 100 }),
				queryFn: () => listOrganizations({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["work-managers"],
				queryFn: listWorkManagers,
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Novo Centro de Custo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const client = useQueryClient();
	const { organizationId } = Route.useSearch();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const organizationsQuery = useQuery({
		queryKey: organizationKeys.list({ limit: 100 }),
		queryFn: () => listOrganizations({ limit: 100 }),
	});
	const managersQuery = useQuery({
		queryKey: ["work-managers"],
		queryFn: listWorkManagers,
	});
	const mutation = useMutation({
		mutationFn: (values: CostCenterEditValues) =>
			createCostCenter(values.organizationId, {
				name: values.name,
				managerName: values.managerName || undefined,
				structuredAddress: values.structuredAddress,
			}),
		onSuccess: (created) => {
			toast.success("Centro de custo criado com sucesso!");
			client.invalidateQueries({ queryKey: costCenterKeys.allList() });
			client.invalidateQueries({ queryKey: organizationKeys.all });
			navigate({
				to: "/app/centros-de-custo/$ccId",
				params: { ccId: created.id },
			});
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível criar o centro de custo."),
			),
	});

	if (organizationsQuery.isLoading || managersQuery.isLoading) {
		return <LoadingSpinner title="Carregando opções..." />;
	}
	if (organizationsQuery.error || managersQuery.error) {
		return (
			<ErrorFeedback
				message="Não foi possível carregar as opções do centro de custo."
				onRetry={() => {
					void organizationsQuery.refetch();
					void managersQuery.refetch();
				}}
			/>
		);
	}

	const organizations = (organizationsQuery.data?.data ?? []).map((item) => ({
		id: item.id,
		value: item.id,
		label: item.name,
	}));
	const managerOptions = (managersQuery.data ?? []).map((item) => ({
		id: item.id,
		value: item.name,
		label: item.name,
	}));

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Gestão"
				title="Novo Centro de Custo"
				description="Cadastre um centro de custo dentro de uma organização."
			/>
			<CostCenterEditor
				mode="create"
				organizations={organizations}
				managers={managerOptions}
				defaultValues={{ organizationId: organizationId ?? "" }}
				submitting={mutation.isPending}
				onSubmit={(values) =>
					requestCreationConfirmation(() => mutation.mutate(values))
				}
				onCancel={() => navigate({ to: "/app/centros-de-custo" })}
			/>
		</PageContainer>
	);
}
