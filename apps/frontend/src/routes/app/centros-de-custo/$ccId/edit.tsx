import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
	deleteCostCenter,
	getCostCenterById,
	listOrganizations,
	updateCostCenter,
} from "@/api/organizations";
import { costCenterKeys, organizationKeys } from "@/api/query-keys";
import { listWorkManagers } from "@/api/works";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CostCenterEditor } from "@/components/organisms/organizations/cost-center-editor";
import { queryClient } from "@/lib/query-client";
import type { CostCenterEditValues } from "@/schemas/organizations";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/centros-de-custo/$ccId/edit")({
	loader: async ({ params }) => {
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: costCenterKeys.globalDetail(params.ccId),
				queryFn: () => getCostCenterById(params.ccId),
			}),
			queryClient.prefetchQuery({
				queryKey: organizationKeys.list({ limit: 100 }),
				queryFn: () => listOrganizations({ limit: 100 }),
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar Centro de Custo - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { ccId } = useParams({ from: "/app/centros-de-custo/$ccId/edit" });
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [showDelete, setShowDelete] = useState(false);
	const ccQuery = useQuery({
		queryKey: costCenterKeys.globalDetail(ccId),
		queryFn: () => getCostCenterById(ccId),
	});
	const organizationsQuery = useQuery({
		queryKey: organizationKeys.list({ limit: 100 }),
		queryFn: () => listOrganizations({ limit: 100 }),
	});
	const managersQuery = useQuery({
		queryKey: ["work-managers"],
		queryFn: listWorkManagers,
	});
	const oldOrgId = ccQuery.data?.organization?.id ?? "";
	const updateMutation = useMutation({
		mutationFn: (values: CostCenterEditValues) =>
			updateCostCenter(ccId, values),
		onSuccess: (_data, values) => {
			toast.success("Centro de custo atualizado!");
			qc.invalidateQueries({ queryKey: costCenterKeys.globalDetail(ccId) });
			qc.invalidateQueries({ queryKey: costCenterKeys.allList() });
			qc.invalidateQueries({ queryKey: costCenterKeys.all(oldOrgId) });
			if (values.organizationId !== oldOrgId) {
				qc.invalidateQueries({
					queryKey: costCenterKeys.all(values.organizationId),
				});
				qc.invalidateQueries({ queryKey: organizationKeys.detail(oldOrgId) });
				qc.invalidateQueries({
					queryKey: organizationKeys.detail(values.organizationId),
				});
			}
			navigate({ to: "/app/centros-de-custo/$ccId", params: { ccId } });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar centro de custo.")),
	});
	const deleteMutation = useMutation({
		mutationFn: () => deleteCostCenter(oldOrgId, ccId),
		onSuccess: () => {
			toast.success("Centro de custo excluído.");
			navigate({ to: "/app/centros-de-custo" });
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir centro de custo.")),
	});

	if (
		ccQuery.isLoading ||
		organizationsQuery.isLoading ||
		managersQuery.isLoading
	)
		return <LoadingSpinner title="Carregando centro de custo..." />;
	if (ccQuery.error || !ccQuery.data) return <ErrorFeedback />;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Centros de custo"
				title="Editar centro de custo"
				description={ccQuery.data.name}
			/>
			<CostCenterEditor
				mode="edit"
				organizations={(organizationsQuery.data?.data ?? []).map((item) => ({
					id: item.id,
					value: item.id,
					label: item.name,
				}))}
				managers={(managersQuery.data ?? []).map((item) => ({
					id: item.id,
					value: item.name,
					label: item.name,
				}))}
				defaultValues={{
					name: ccQuery.data.name,
					organizationId: ccQuery.data.organization?.id ?? "",
					managerName: ccQuery.data.managerName ?? "",
					structuredAddress: ccQuery.data.structuredAddress,
				}}
				submitting={updateMutation.isPending}
				onSubmit={(values) => updateMutation.mutate(values)}
				onCancel={() =>
					navigate({ to: "/app/centros-de-custo/$ccId", params: { ccId } })
				}
			/>
			<div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/20 p-6">
				<div>
					<p className="font-medium">Excluir centro de custo</p>
					<p className="text-sm text-muted-foreground">
						Esta ação remove o centro de custo e suas obras.
					</p>
				</div>
				<button
					type="button"
					className="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
					onClick={() => setShowDelete(true)}
				>
					Excluir
				</button>
			</div>
			<ConfirmDialog
				open={showDelete}
				title="Excluir centro de custo?"
				description="Esta ação não pode ser desfeita. Todas as obras vinculadas serão removidas ou ficarão órfãs conforme regra do backend."
				onConfirm={() => deleteMutation.mutate()}
				onCancel={() => setShowDelete(false)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
