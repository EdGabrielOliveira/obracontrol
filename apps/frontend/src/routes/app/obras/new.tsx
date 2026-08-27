import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { listAllCostCenters } from "@/api/organizations";
import { costCenterKeys, workKeys } from "@/api/query-keys";
import { downloadTemplate, TEMPLATE_FILENAMES } from "@/api/templates";
import { createWorkWithBudget, listWorkManagers } from "@/api/works";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { WorkForm } from "@/components/organisms/works/work-form";
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { downloadBlob } from "@/lib/download";
import { queryClient } from "@/lib/query-client";
import type { WorkFormValues } from "@/schemas/works";
import type { WorkCreateInput } from "@/types/works";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/obras/new")({
	loader: () => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: costCenterKeys.allList({ limit: 100 }),
				queryFn: () => listAllCostCenters({ limit: 100 }),
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
			{ title: "Nova Obra - ObraControl" },
		],
	}),
});

function toCreateInput(values: WorkFormValues): WorkCreateInput {
	return {
		name: values.name,
		costCenterId: values.costCenterId,
		structuredAddress: values.structuredAddress,
		plannedStart: values.plannedStart || undefined,
		plannedEnd: values.plannedEnd || undefined,
		responsibleName: values.responsibleName || undefined,
		operationalStatus: values.operationalStatus,
	};
}

function RouteComponent() {
	const navigate = useNavigate();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const [downloadingTemplate, setDownloadingTemplate] = useState(false);
	const costCentersQuery = useQuery({
		queryKey: costCenterKeys.allList({ limit: 100 }),
		queryFn: () => listAllCostCenters({ limit: 100 }),
	});
	const usersQuery = useQuery({
		queryKey: ["work-managers"],
		queryFn: listWorkManagers,
	});

	const mutation = useMutation({
		mutationFn: async ({
			input,
			file,
		}: {
			input: WorkCreateInput;
			file: File | null;
		}) => {
			return createWorkWithBudget(input, file ?? undefined);
		},
		onSuccess: (result, variables) => {
			if (result.status === "IMPORT_REJECTED") {
				toast.warning(
					"Obra criada, mas o orçamento foi rejeitado. Corrija o arquivo e tente novamente.",
				);
			} else {
				toast.success(
					variables.file
						? "Obra e orçamento criados com sucesso."
						: "Obra criada com sucesso.",
				);
			}
			queryClient.invalidateQueries({ queryKey: workKeys.all });
			navigate({
				to: "/app/obras/$workId",
				params: { workId: result.work.id },
			});
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(
					error,
					"Não foi possível criar a obra ou importar o orçamento.",
				),
			),
	});

	if (costCentersQuery.isLoading || usersQuery.isLoading) {
		return <LoadingSpinner title="Carregando opções da obra..." />;
	}
	if (costCentersQuery.error || usersQuery.error) {
		return (
			<ErrorFeedback
				message="Não foi possível carregar os centros de custo e gestores."
				onRetry={() => {
					void costCentersQuery.refetch();
					void usersQuery.refetch();
				}}
			/>
		);
	}

	const handleDownloadTemplate = async () => {
		setDownloadingTemplate(true);
		try {
			const blob = await downloadTemplate("orcamento");
			downloadBlob(blob, TEMPLATE_FILENAMES.orcamento);
		} catch {
			toast.error("Não foi possível baixar o modelo padrão do orçamento.");
		} finally {
			setDownloadingTemplate(false);
		}
	};

	const costCenterOptions =
		costCentersQuery.data?.data.map((cc) => ({
			id: cc.id,
			value: cc.id,
			label: `${cc.organization?.name ?? ""} / ${cc.name}`,
		})) ?? [];
	const managerOptions =
		usersQuery.data?.map((user) => ({
			id: user.id,
			value: user.name,
			label: user.name,
		})) ?? [];

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obras"
				title="Nova Obra"
				description="Preencha os dados principais para cadastrar a obra."
			/>

			<WorkForm
				mode="create"
				costCenterId=""
				costCenterOptions={costCenterOptions}
				managerOptions={managerOptions}
				loading={mutation.isPending}
				onDownloadTemplate={handleDownloadTemplate}
				downloadingTemplate={downloadingTemplate}
				onSubmit={(data, file) =>
					requestCreationConfirmation(() =>
						mutation.mutate({ input: toCreateInput(data), file }),
					)
				}
				onCancel={() => navigate({ to: "/app/obras" })}
			/>
		</PageContainer>
	);
}
