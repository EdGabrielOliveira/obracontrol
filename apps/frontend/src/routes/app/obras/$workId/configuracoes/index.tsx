import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { AlertTriangle, Settings, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { governanceKeys, workKeys } from "@/api/query-keys";
import { deleteWork, getWork, updateWork } from "@/api/works";
import { ConfirmDialog } from "@/atoms/confirm-dialog";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { WorkReportsTab } from "@/components/organisms/works/work-reports-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient as prefetchClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";
import { WorkForm } from "@/organisms/works/work-form";
import type { WorkFormValues } from "@/schemas/works";
import { getErrorMessage, normalizePortugueseText } from "@/utils/api-error";

const settingsSearchSchema = z.object({
	tab: z.enum(["geral", "relatorios"]).optional().default("geral"),
	asOfDate: z.string().optional(),
});

export const Route = createFileRoute("/app/obras/$workId/configuracoes/")({
	beforeLoad: requireManagementAccess,
	validateSearch: settingsSearchSchema,
	loader: async ({ params }) =>
		await prefetchClient.prefetchQuery({
			queryKey: workKeys.detail(params.workId),
			queryFn: () => getWork(params.workId),
		}),
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Configurações da obra - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({
		from: "/app/obras/$workId/configuracoes/",
	});
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const search = useSearch({ from: Route.id });
	const [showDelete, setShowDelete] = useState(false);

	const {
		data: work,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: workKeys.detail(workId),
		queryFn: () => getWork(workId),
	});

	const updateMutation = useMutation({
		mutationFn: (input: Parameters<typeof updateWork>[1]) =>
			updateWork(workId, input),
		onSuccess: () => {
			toast.success("Obra atualizada!");
			queryClient.invalidateQueries({ queryKey: workKeys.detail(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.allList });
			queryClient.invalidateQueries({ queryKey: workKeys.dashboard });
			navigate({
				to: "/app/obras/$workId/configuracoes",
				params: { workId },
			});
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao atualizar obra.")),
	});

	const deleteMutation = useMutation({
		mutationFn: () => deleteWork(workId),
		onSuccess: (result) => {
			if (result?.status === "PENDING") {
				toast.success(
					"Solicitação de exclusão enviada para aprovação do Gerente.",
				);
				queryClient.invalidateQueries({
					queryKey: governanceKeys.pendingApprovals(workId),
				});
				setShowDelete(false);
				return;
			}
			toast.success("Obra excluída.");
			queryClient.invalidateQueries({ queryKey: workKeys.all });
			queryClient.invalidateQueries({ queryKey: workKeys.allList });
			queryClient.invalidateQueries({ queryKey: workKeys.dashboard });
			navigate({ to: "/app/obras" });
		},
		onError: (error) => {
			const data = isAxiosError<{
				message?: string;
				errors?: Array<{ message?: string }>;
			}>(error)
				? error.response?.data
				: undefined;
			if (data?.message) {
				const details = (data.errors ?? [])
					.map((entry) => entry.message)
					.filter((message): message is string => Boolean(message));
				toast.error(
					details.length > 0
						? `${normalizePortugueseText(data.message)}: ${details.map(normalizePortugueseText).join(", ")}`
						: normalizePortugueseText(data.message),
				);
				return;
			}
			toast.error("Erro ao excluir obra.");
		},
	});

	const updateSearch = (patch: Partial<typeof search>) => {
		navigate({
			search: (previous) => ({ ...previous, ...patch }),
		});
	};

	if (isLoading) return <LoadingSpinner title="Carregando configurações..." />;
	if (error || !work) {
		return (
			<ErrorFeedback
				message={getErrorMessage(error, "Obra não encontrada.")}
				onRetry={() => refetch()}
			/>
		);
	}

	const handleSubmit = (formData: WorkFormValues) => {
		updateMutation.mutate({
			code: formData.code,
			name: formData.name,
			clientName: formData.clientName || undefined,
			plannedStart: formData.plannedStart
				? `${formData.plannedStart}T00:00:00.000Z`
				: undefined,
			plannedEnd: formData.plannedEnd
				? `${formData.plannedEnd}T00:00:00.000Z`
				: undefined,
			areaM2: formData.areaM2 ? Number(formData.areaM2) : undefined,
			responsibleName: formData.responsibleName || undefined,
			operationalStatus: formData.operationalStatus,
			statusReason: formData.statusReason?.trim() || undefined,
			structuredAddress: formData.structuredAddress,
		});
	};

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title={`Configurações: ${work.name}`}
				description="Edite os dados da obra, exclua o cadastro ou baixe seus relatórios."
			/>

			<Tabs
				value={search.tab}
				onValueChange={(tab) =>
					updateSearch({ tab: tab as "geral" | "relatorios" })
				}
			>
				<TabsList className="mb-6">
					<TabsTrigger value="geral" className="gap-1.5">
						<Settings className="h-4 w-4" />
						Dados da obra
					</TabsTrigger>
					<TabsTrigger value="relatorios" className="gap-1.5">
						<SlidersHorizontal className="h-4 w-4" />
						Relatórios
					</TabsTrigger>
				</TabsList>

				<TabsContent value="geral">
					<WorkForm
						mode="edit"
						costCenterId={work.costCenterId ?? ""}
						costCenterName={work.costCenterName ?? undefined}
						defaultValues={{
							code: work.code,
							name: work.name,
							clientName: work.clientName ?? undefined,
							plannedStart: work.plannedStart ?? undefined,
							plannedEnd: work.plannedEnd ?? undefined,
							areaM2: work.areaM2 ?? undefined,
							responsibleName: work.responsibleName ?? undefined,
							operationalStatus: work.operationalStatus ?? "NOT_STARTED",
							statusReason: work.statusReason ?? undefined,
							structuredAddress: work.structuredAddress,
						}}
						onSubmit={handleSubmit}
						onCancel={() =>
							navigate({
								to: "/app/obras/$workId",
								params: { workId },
							})
						}
						loading={updateMutation.isPending}
					/>
					<Card className="mt-4">
						<CardHeaderWithIcon
							icon={AlertTriangle}
							title="Zona de perigo"
							description="Ações irreversíveis que afetam permanentemente esta obra"
						/>
						<CardContent>
							<Button variant="destructive" onClick={() => setShowDelete(true)}>
								Excluir obra
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="relatorios">
					<WorkReportsTab workId={workId} asOfDate={search.asOfDate} />
				</TabsContent>
			</Tabs>

			<ConfirmDialog
				open={showDelete}
				title="Excluir obra?"
				description="Esta ação solicitará a exclusão permanente da obra e dos dados vinculados, incluindo orçamento, custos, medições, contratos e histórico operacional. A exclusão pode exigir aprovação; os dados só serão removidos quando a solicitação for executada. Deseja continuar?"
				confirmLabel="Confirmar exclusão"
				onConfirm={() => deleteMutation.mutate()}
				onCancel={() => setShowDelete(false)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
