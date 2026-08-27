import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import {
	Building2,
	FileText,
	Mail,
	MapPin,
	Phone,
	Trash2,
	UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCompany, getCompany } from "@/api/companies";
import { companyKeys } from "@/api/query-keys";
import { AccessDenied } from "@/atoms/access-denied";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/empresas/$companyId/")({
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
			{ title: "Empresas - ObraControl" },
		],
	}),
});

function DetailRow({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Building2;
	label: string;
	value: string | number | null | undefined;
}) {
	return (
		<div className="flex items-start gap-3">
			<Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
			<div className="min-w-0">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="break-words font-medium">{value || "Não informado"}</p>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { companyId } = useParams({ from: "/app/empresas/$companyId/" });
	const { capabilities, loading } = useAuth();
	const navigate = useNavigate();
	const [showDelete, setShowDelete] = useState(false);
	const query = useQuery({
		queryKey: companyKeys.detail(companyId),
		queryFn: () => getCompany(companyId),
	});
	const deleteMutation = useMutation({
		mutationFn: () => deleteCompany(companyId),
		onSuccess: () => {
			toast.success("Empresa excluída.");
			queryClient.invalidateQueries({ queryKey: companyKeys.all });
			navigate({ to: "/app/empresas" });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir empresa.")),
	});
	if (loading) return <LoadingSpinner title="Carregando autorização..." />;
	if (!capabilities?.canManageScopedCompanies) return <AccessDenied />;
	if (query.isLoading) return <LoadingSpinner title="Carregando empresa..." />;
	if (query.error || !query.data)
		return <ErrorFeedback onRetry={() => query.refetch()} />;

	const company = query.data;
	const address = company.structuredAddress;
	const addressText = address
		? [
				[address.street, address.number].filter(Boolean).join(", "),
				address.district,
				[address.city, address.state].filter(Boolean).join(" - "),
			]
				.filter(Boolean)
				.join(" · ")
		: [company.addressCity, company.addressState].filter(Boolean).join(" - ");

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração"
				title={company.name}
				description="Dados cadastrais e informações da empresa."
				actions={
					<div className="flex flex-wrap justify-end gap-2">
						<Link to="/app/empresas/$companyId/edit" params={{ companyId }}>
							<Button>Editar empresa</Button>
						</Link>
						<Button variant="destructive" onClick={() => setShowDelete(true)}>
							<Trash2 className="mr-2 h-4 w-4" />
							Excluir empresa
						</Button>
					</div>
				}
			/>
			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeaderWithIcon
						icon={Building2}
						title="Dados cadastrais"
						description="Informações principais da empresa."
					/>
					<CardContent className="grid gap-5 sm:grid-cols-2">
						<DetailRow
							icon={Building2}
							label="Razão social"
							value={company.name}
						/>
						<DetailRow
							icon={Building2}
							label="Nome fantasia"
							value={company.tradeName}
						/>
						<DetailRow icon={FileText} label="CNPJ" value={company.document} />
						<DetailRow
							icon={UserRound}
							label="Gerente responsável"
							value={company.managerName}
						/>
						<DetailRow
							icon={Mail}
							label="E-mail"
							value={company.contactEmail}
						/>
						<DetailRow
							icon={Phone}
							label="Telefone"
							value={company.contactPhone}
						/>
						<DetailRow icon={MapPin} label="Endereço" value={addressText} />
					</CardContent>
				</Card>
				<Card>
					<CardHeaderWithIcon
						icon={FileText}
						title="Template de contrato"
						description="Documento usado na geração de instrumentos."
					/>
					<CardContent className="space-y-4">
						<div>
							<p className="text-sm text-muted-foreground">Status</p>
							<Badge
								variant="tag"
								tone={company.contractTemplateSha256 ? "success" : "neutral"}
							>
								{company.contractTemplateSha256
									? "Cadastrado"
									: "Não cadastrado"}
							</Badge>
						</div>
						<DetailRow
							icon={FileText}
							label="Versão"
							value={
								company.contractTemplateSha256
									? `v${company.contractTemplateVersion}`
									: null
							}
						/>
						<DetailRow
							icon={Building2}
							label="Organizações vinculadas"
							value={company.organizationCount}
						/>
					</CardContent>
				</Card>
			</div>
			<ConfirmDialog
				open={showDelete}
				title="Excluir empresa?"
				description="Esta ação não pode ser desfeita. Organizações vinculadas permanecerão cadastradas, mas sem empresa associada."
				onConfirm={() => deleteMutation.mutate()}
				onCancel={() => setShowDelete(false)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
