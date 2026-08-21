import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { workKeys } from "@/api/query-keys";
import { getSchedule, saveManualScheduleItem } from "@/api/schedule";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { ManualScheduleEditor } from "@/components/organisms/schedule/manual-schedule-editor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/obras/$workId/cronograma")({
	loader: async ({ params }) =>
		await queryClient.prefetchQuery({
			queryKey: workKeys.schedule(params.workId),
			queryFn: () => getSchedule(params.workId),
		}),
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar cronograma - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({ from: "/app/obras/$workId/cronograma" });
	const { role } = useAuth();
	const canWrite = role !== null;

	const {
		data: scheduleData,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: workKeys.schedule(workId),
		queryFn: () => getSchedule(workId),
	});

	const saveMutation = useMutation({
		mutationFn: (values: Parameters<typeof saveManualScheduleItem>[1]) =>
			saveManualScheduleItem(workId, values),
		onSuccess: (result) => {
			toast.success(
				result.created
					? "Cronograma manual criado com sucesso!"
					: "Datas do cronograma atualizadas com sucesso!",
			);
			queryClient.invalidateQueries({ queryKey: workKeys.schedule(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.budget(workId) });
		},
		onError: (error) =>
			toast.error(
				getErrorMessage(error, "Erro ao salvar o cronograma manual."),
			),
	});

	if (isLoading) return <LoadingSpinner title="Carregando cronograma..." />;
	if (error) {
		return (
			<ErrorFeedback
				message={getErrorMessage(
					error,
					"Não foi possível carregar o cronograma.",
				)}
				onRetry={() => void refetch()}
			/>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Editar cronograma"
				description="Cadastre datas para itens sem cronograma ou edite as datas existentes."
				actions={
					<Link
						to="/app/obras/$workId/orcamento"
						params={{ workId }}
						search={{ tab: "cronograma" }}
					>
						<Button variant="outline" size="sm">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Voltar ao orçamento
						</Button>
					</Link>
				}
			/>

			{canWrite ? (
				<ManualScheduleEditor
					workId={workId}
					scheduleData={scheduleData}
					onSubmit={(values) => {
						saveMutation.mutate(values);
					}}
					submitting={saveMutation.isPending}
				/>
			) : (
				<ErrorFeedback message="Você não tem permissão para editar o cronograma." />
			)}
		</PageContainer>
	);
}
