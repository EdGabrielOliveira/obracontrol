import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { organizationKeys } from "@/api/query-keys";
import { downloadOrgPdf, getOrgReport } from "@/api/reports";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";
import { OrganizationReport } from "@/organisms/organizations/organization-report";

export const Route = createFileRoute("/app/organizacoes/$orgId/relatorios/")({
	beforeLoad: requireManagementAccess,
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Relatório da Organização - ObraControl" },
		],
	}),
	loader: async ({ params }) =>
		await queryClient.prefetchQuery({
			queryKey: organizationKeys.report(params.orgId),
			queryFn: () => getOrgReport(params.orgId),
		}),
});

function RouteComponent() {
	const { orgId } = useParams({
		from: "/app/organizacoes/$orgId/relatorios/",
	});

	const { data, isLoading, error } = useQuery({
		queryKey: organizationKeys.report(orgId),
		queryFn: () => getOrgReport(orgId),
	});

	if (isLoading) return <LoadingSpinner title="Carregando relatório..." />;
	if (error || !data) return <ErrorFeedback />;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Organização"
				title="Relatório da Organização"
				description="Resumo consolidado da organização."
			/>
			<div className="mb-6 flex justify-end">
				<Button
					onClick={async () => {
						try {
							const blob = await downloadOrgPdf(orgId);
							downloadBlob(blob, `relatorio-organizacao-${orgId}.pdf`);
							toast.success("PDF gerado com sucesso!");
						} catch {
							toast.error("Erro ao gerar PDF.");
						}
					}}
				>
					<Download className="mr-2 h-4 w-4" />
					Baixar PDF
				</Button>
			</div>
			<OrganizationReport data={data} />
		</PageContainer>
	);
}
