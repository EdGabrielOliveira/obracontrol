import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { type CompanyInput, createCompanyWithTemplate } from "@/api/companies";
import { companyKeys } from "@/api/query-keys";
import { AccessDenied } from "@/atoms/access-denied";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CompanyForm } from "@/components/organisms/companies/company-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import type { AddressValue } from "@/types/address";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/empresas/new")({
	beforeLoad: () => requireAuthorizationCapability("canAdministerCompanies"),
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Novo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { capabilities, loading } = useAuth();
	const navigate = useNavigate();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const mutation = useMutation({
		mutationFn: ({
			values,
			template,
			address,
		}: {
			values: CompanyInput;
			template: File | null;
			address: AddressValue | null;
		}) =>
			createCompanyWithTemplate(
				{ ...values, structuredAddress: address },
				template as File,
			),
		onSuccess: () => {
			toast.success("Empresa cadastrada com sucesso.");
			queryClient.invalidateQueries({ queryKey: companyKeys.all });
			navigate({ to: "/app/empresas" });
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível cadastrar a empresa."),
			),
	});

	if (loading) return <LoadingSpinner title="Carregando autorização..." />;
	if (!capabilities?.canAdministerCompanies) return <AccessDenied />;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração"
				title="Nova empresa"
				description="Cadastre os dados da empresa e seu contrato modelo."
			/>
			<CompanyForm
				mode="create"
				submitting={mutation.isPending}
				onError={(message) => toast.error(message)}
				onCancel={() => navigate({ to: "/app/empresas" })}
				onSubmit={(values, template, address) =>
					requestCreationConfirmation(() =>
						mutation.mutate({ values, template, address }),
					)
				}
			/>
		</PageContainer>
	);
}
