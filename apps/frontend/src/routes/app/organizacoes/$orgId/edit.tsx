import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
	deleteOrganization,
	getOrganization,
	updateOrganization,
} from "@/api/organizations";
import { organizationKeys } from "@/api/query-keys";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { AccessDenied } from "@/components/atoms/access-denied";
import { PageHeader } from "@/components/atoms/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import { OrgForm } from "@/organisms/organizations/org-form";
import type { CreateOrganizationInput } from "@/types/organizations";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/organizacoes/$orgId/edit")({
	beforeLoad: () => requireAuthorizationCapability("canAdministerCompanies"),
	loader: async ({ params }) =>
		await queryClient.prefetchQuery({
			queryKey: organizationKeys.detail(params.orgId),
			queryFn: () => getOrganization(params.orgId),
		}),
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
	const { orgId } = useParams({ from: "/app/organizacoes/$orgId/edit" });
	const navigate = useNavigate();
	const client = useQueryClient();
	const { role, capabilities, loading: authorizationLoading } = useAuth();
	const canEditOrganization =
		role === "ADMIN" || capabilities?.canAdministerCompanies === true;
	const [showDelete, setShowDelete] = useState(false);
	const query = useQuery({
		queryKey: organizationKeys.detail(orgId),
		queryFn: () => getOrganization(orgId),
	});
	const updateMutation = useMutation({
		mutationFn: (values: CreateOrganizationInput) =>
			updateOrganization(orgId, values),
		onSuccess: () => {
			toast.success("Organização atualizada!");
			client.invalidateQueries({ queryKey: organizationKeys.detail(orgId) });
			client.invalidateQueries({ queryKey: organizationKeys.all });
			navigate({ to: "/app/organizacoes/$orgId", params: { orgId } });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar organização.")),
	});
	const deleteMutation = useMutation({
		mutationFn: () => deleteOrganization(orgId),
		onSuccess: () => {
			toast.success("Organização excluída.");
			client.invalidateQueries({ queryKey: organizationKeys.all });
			navigate({ to: "/app/organizacoes" });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir organização.")),
	});

	if (authorizationLoading)
		return <LoadingSpinner title="Carregando autorização..." />;
	if (!canEditOrganization) return <AccessDenied />;
	if (query.isLoading)
		return <LoadingSpinner title="Carregando organização..." />;
	if (query.error || !query.data) return <ErrorFeedback />;
	const org = query.data;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Organizações"
				title="Editar organização"
				description={org.name}
			/>
			<OrgForm
				mode="edit"
				defaultValues={{
					name: org.name,
					companyId: org.companyId ?? "",
					managerName: org.managerName ?? undefined,
					structuredAddress: org.structuredAddress,
				}}
				onSubmit={(values) => updateMutation.mutate(values)}
				onCancel={() =>
					navigate({ to: "/app/organizacoes/$orgId", params: { orgId } })
				}
				loading={updateMutation.isPending}
			/>
			<div className="mt-6 flex justify-end">
				<Button variant="destructive" onClick={() => setShowDelete(true)}>
					Excluir organização
				</Button>
			</div>
			<ConfirmDialog
				open={showDelete}
				title="Excluir organização?"
				description="A organização só poderá ser excluída conforme as regras de vínculos do backend."
				onConfirm={() => deleteMutation.mutate()}
				onCancel={() => setShowDelete(false)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
