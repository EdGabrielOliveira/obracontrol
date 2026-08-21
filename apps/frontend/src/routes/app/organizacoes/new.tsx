import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { listCompanies } from "@/api/companies";
import { createOrganization } from "@/api/organizations";
import { organizationKeys } from "@/api/query-keys";
import { listWorkManagers } from "@/api/works";

import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { queryClient } from "@/lib/query-client";
import { OrgForm } from "@/organisms/organizations/org-form";
import type { CreateOrganizationInput } from "@/types/organizations";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/organizacoes/new")({
	loader: () => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: ["companies"],
				queryFn: listCompanies,
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
			{ title: "Novo Órgão - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { requestCreationConfirmation } = useCreationConfirmation();

	const mutation = useMutation({
		mutationFn: createOrganization,
		onSuccess: () => {
			toast.success("Órgão criado com sucesso!");
			queryClient.invalidateQueries({ queryKey: organizationKeys.all });
			navigate({ to: "/app/organizacoes" });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao criar órgão.")),
	});

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					title="Novo Órgão"
					description="Crie um novo órgão para organizar suas obras."
				/>
			}
		>
			<OrgForm
				mode="create"
				onSubmit={(data: CreateOrganizationInput) =>
					requestCreationConfirmation(() => mutation.mutate(data))
				}
				onCancel={() => navigate({ to: "/app/organizacoes" })}
				loading={mutation.isPending}
			/>
		</PageContainer>
	);
}
