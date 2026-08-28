import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Company, deleteCompany, listCompanies } from "@/api/companies";
import { companyKeys } from "@/api/query-keys";
import { AccessDenied } from "@/atoms/access-denied";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { DataTable } from "@/components/atoms/data-table";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { Button } from "@/components/ui/button";
import { apiErrorStatus } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import { getErrorMessage } from "@/utils/api-error";

const columnHelper = createColumnHelper<Company>();

function displayUnformattedDocument(document: string | null) {
	return document?.replace(/\D/g, "") || "—";
}

export const Route = createFileRoute("/app/empresas/")({
	beforeLoad: () => requireAuthorizationCapability("canManageScopedCompanies"),
	loader: () => {
		void queryClient.prefetchQuery({
			queryKey: companyKeys.all,
			queryFn: listCompanies,
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

function RouteComponent() {
	const { capabilities, loading } = useAuth();
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const {
		data: companies = [],
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: companyKeys.all,
		queryFn: listCompanies,
	});
	const deleteMutation = useMutation({
		mutationFn: (companyId: string) => deleteCompany(companyId),
		onSuccess: () => {
			toast.success("Empresa excluída.");
			setDeleteId(null);
			queryClient.invalidateQueries({ queryKey: companyKeys.all });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir empresa.")),
	});

	if (loading) return <LoadingSpinner title="Carregando autorizacao..." />;
	if (!capabilities?.canManageScopedCompanies) return <AccessDenied />;
	if (isLoading) return <LoadingSpinner title="Carregando empresas..." />;
	if (error)
		return (
			<ErrorFeedback onRetry={() => refetch()} status={apiErrorStatus(error)} />
		);

	const columns = [
		columnHelper.accessor("name", {
			header: "Razão social",
			cell: (info) => (
				<Link
					className="link-navigation font-medium"
					to="/app/empresas/$companyId"
					params={{ companyId: info.row.original.id }}
				>
					{info.getValue()}
				</Link>
			),
			meta: { mobileLabel: "Razão social" },
		}),
		columnHelper.accessor("document", {
			header: "CNPJ",
			cell: (info) => displayUnformattedDocument(info.getValue()),
			meta: { mobileLabel: "CNPJ" },
		}),
		columnHelper.accessor("managerName", {
			header: "Gerente responsável",
			cell: (info) => info.getValue() ?? "—",
			meta: { mobileLabel: "Gerente responsável" },
		}),
		columnHelper.accessor("organizationCount", {
			header: "Organizações",
			cell: (info) => info.getValue(),
			meta: { mobileLabel: "Organizações" },
		}),
		columnHelper.accessor("contractTemplate", {
			header: "Contrato modelo",
			cell: (info) => (info.getValue() ? "Cadastrado" : "Não cadastrado"),
			meta: { mobileLabel: "Contrato modelo" },
		}),
		columnHelper.accessor("contractTemplateVersion", {
			header: "Versão",
			cell: (info) =>
				info.row.original.contractTemplateSha256 ? `v${info.getValue()}` : "—",
		}),
		columnHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => (
				<div className="flex justify-end" data-no-row-click>
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Excluir empresa ${info.row.original.name}`}
						title="Excluir empresa"
						onClick={() => setDeleteId(info.row.original.id)}
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			),
			meta: { mobileLabel: "Ações" },
		}),
	];

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração"
				title="Empresas"
				description="Empresas cadastradas e vinculadas às organizações."
				actions={
					<Link to="/app/empresas/new">
						<Button>
							<Plus className="mr-2 h-4 w-4" /> Nova empresa
						</Button>
					</Link>
				}
			/>
			<DataTable
				columns={columns}
				data={companies}
				searchPlaceholder="Buscar por razão social ou CNPJ..."
				emptyMessage="Nenhuma empresa cadastrada."
			/>
			<ConfirmDialog
				open={!!deleteId}
				title="Excluir empresa?"
				description="Esta ação não pode ser desfeita. Organizações vinculadas permanecerão cadastradas, mas sem empresa associada."
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				onCancel={() => setDeleteId(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
