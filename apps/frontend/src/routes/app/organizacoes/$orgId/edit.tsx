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
import type { AddressValue } from "@/types/address";
import type {
	CreateOrganizationInput,
	UpdateOrganizationInput,
} from "@/types/organizations";
import { getErrorMessage } from "@/utils/api-error";

function completeAddress(address: AddressValue | null | undefined) {
	if (!address) return null;
	const zipCode = address.zipCode.replace(/\D/g, "");
	return zipCode.length === 8 &&
		address.city.trim() &&
		address.state.length === 2
		? address
		: null;
}

export const Route = createFileRoute("/app/organizacoes/$orgId/edit")({
	beforeLoad: () => requireAuthorizationCapability("canManageStructure"),
	loader: ({ params }) => {
		void queryClient
			.prefetchQuery({
				queryKey: organizationKeys.detail(params.orgId),
				queryFn: () => getOrganization(params.orgId),
			})
			.catch(() => undefined);
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
	const { orgId } = useParams({ from: "/app/organizacoes/$orgId/edit" });
	const navigate = useNavigate();
	const client = useQueryClient();
	const { capabilities, loading: authorizationLoading } = useAuth();
	const canEditOrganization = capabilities?.canManageStructure === true;
	const [showDelete, setShowDelete] = useState(false);
	const query = useQuery({
		queryKey: organizationKeys.detail(orgId),
		queryFn: () => getOrganization(orgId),
	});
	const updateMutation = useMutation({
		mutationFn: (values: CreateOrganizationInput) => {
			const current = query.data;
			if (!current) throw new Error("Organização não encontrada.");

			// A PATCH should only carry fields the user changed. Older organizations
			// can have an incomplete legacy address; resending it used to make a
			// simple name change fail client/server validation before the request.
			const input: UpdateOrganizationInput = { name: values.name.trim() };
			if (values.companyId !== (current.companyId ?? "")) {
				input.companyId = values.companyId;
			}
			if ((values.managerName ?? "") !== (current.managerName ?? "")) {
				input.managerName = values.managerName;
			}
			if (
				JSON.stringify(values.structuredAddress ?? null) !==
				JSON.stringify(completeAddress(current.structuredAddress))
			) {
				input.structuredAddress = values.structuredAddress ?? null;
			}

			return updateOrganization(orgId, input);
		},
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
					structuredAddress: completeAddress(org.structuredAddress),
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
