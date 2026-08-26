import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { toast } from "sonner";
import {
	type CompanyInput,
	getCompany,
	updateCompany,
	uploadCompanyTemplate,
} from "@/api/companies";
import { companyKeys } from "@/api/query-keys";
import { AccessDenied } from "@/atoms/access-denied";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CompanyForm } from "@/components/organisms/companies/company-form";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import type { AddressValue } from "@/types/address";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/empresas/$companyId/edit")({
	beforeLoad: () => requireAuthorizationCapability("canManageScopedCompanies"),
	loader: ({ params }) => {
		void queryClient.prefetchQuery({
			queryKey: companyKeys.detail(params.companyId),
			queryFn: () => getCompany(params.companyId),
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
	const { companyId } = useParams({ from: "/app/empresas/$companyId/edit" });
	const { capabilities, loading } = useAuth();
	const navigate = useNavigate();
	const query = useQuery({
		queryKey: companyKeys.detail(companyId),
		queryFn: () => getCompany(companyId),
	});
	const mutation = useMutation({
		mutationFn: async ({
			values,
			template,
			address,
		}: {
			values: CompanyInput;
			template: File | null;
			address: AddressValue | null;
		}) => {
			const updated = await updateCompany(companyId, {
				...values,
				structuredAddress: address,
			});
			if (template) await uploadCompanyTemplate(companyId, template);
			return updated;
		},
		onSuccess: () => {
			toast.success("Empresa atualizada.");
			queryClient.invalidateQueries({ queryKey: companyKeys.all });
			queryClient.invalidateQueries({
				queryKey: companyKeys.detail(companyId),
			});
			navigate({ to: "/app/empresas/$companyId", params: { companyId } });
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Não foi possível atualizar a empresa."),
			),
	});

	if (loading) return <LoadingSpinner title="Carregando autorização..." />;
	if (!capabilities?.canManageScopedCompanies) return <AccessDenied />;
	if (query.isLoading) return <LoadingSpinner title="Carregando empresa..." />;
	if (query.error || !query.data)
		return <ErrorFeedback onRetry={() => query.refetch()} />;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração"
				title={`Editar ${query.data.name}`}
				description="Atualize os dados cadastrais e o template da empresa."
			/>
			<CompanyForm
				mode="edit"
				defaultValues={{
					name: query.data.name,
					document: query.data.document ?? undefined,
					tradeName: query.data.tradeName ?? undefined,
					contactEmail: query.data.contactEmail ?? undefined,
					contactPhone: query.data.contactPhone ?? undefined,
					managerName: query.data.managerName ?? undefined,
				}}
				defaultAddress={query.data.structuredAddress}
				submitting={mutation.isPending}
				onError={(message) => toast.error(message)}
				onCancel={() =>
					navigate({ to: "/app/empresas/$companyId", params: { companyId } })
				}
				onSubmit={(values, template, address) =>
					mutation.mutate({ values, template, address })
				}
			/>
		</PageContainer>
	);
}
