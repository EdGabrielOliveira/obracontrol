import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ListTree } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getBudgetItems, updateBudgetItem } from "@/api/budget";
import { budgetVersionKeys, workKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/atoms/page-container";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { PageHeader } from "@/components/atoms/page-header";
import { BudgetItemEditSelector } from "@/components/organisms/budget/budget-item-edit-selector";
import {
	BudgetItemEditor,
	flattenEditableBudgetItems,
} from "@/components/organisms/budget/budget-item-editor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import type { UpdateBudgetItemInput } from "@/types/budget";
import { getErrorMessage } from "@/utils/api-error";

export const Route = createFileRoute("/app/obras/$workId/orcamento/editar")({
	loader: async ({ params }) =>
		await queryClient.prefetchQuery({
			queryKey: workKeys.budget(params.workId),
			queryFn: () => getBudgetItems(params.workId),
		}),
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar orçamento - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workId } = useParams({
		from: "/app/obras/$workId/orcamento/editar",
	});
	const { role } = useAuth();
	const canWrite = role !== null;

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: workKeys.budget(workId),
		queryFn: () => getBudgetItems(workId),
	});

	const items = useMemo(
		() => flattenEditableBudgetItems(data?.items ?? []),
		[data?.items],
	);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

	useEffect(() => {
		if (items.length === 0) {
			setSelectedItemId(null);
			return;
		}
		setSelectedItemId((current) =>
			current && items.some((item) => item.id === current)
				? current
				: items[0].id,
		);
	}, [items]);

	const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
	const editMutation = useMutation({
		mutationFn: ({
			itemId,
			input,
		}: {
			itemId: string;
			input: UpdateBudgetItemInput;
		}) => updateBudgetItem(workId, itemId, input),
		onSuccess: () => {
			toast.success("Item do orçamento atualizado!");
			queryClient.invalidateQueries({ queryKey: workKeys.budget(workId) });
			queryClient.invalidateQueries({
				queryKey: budgetVersionKeys.history(workId),
			});
			queryClient.invalidateQueries({
				queryKey: budgetVersionKeys.all(workId),
			});
			queryClient.invalidateQueries({ queryKey: workKeys.schedule(workId) });
			queryClient.invalidateQueries({ queryKey: workKeys.detail(workId) });
		},
		onError: (mutationError) =>
			toast.error(
				getErrorMessage(
					mutationError,
					"Erro ao atualizar o item do orçamento.",
				),
			),
	});

	if (isLoading) return <LoadingSpinner title="Carregando orçamento..." />;
	if (error || !data) {
		return (
			<ErrorFeedback
				message={getErrorMessage(
					error,
					"Não foi possível carregar o orçamento.",
				)}
				onRetry={() => void refetch()}
			/>
		);
	}

	const canEdit = canWrite && !data.governed;

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Obra"
				title="Editar orçamento"
				description="Selecione um item para alterar seus dados e valores."
				actions={
					<Link
						to="/app/obras/$workId/orcamento"
						params={{ workId }}
						search={{ tab: "itens" }}
					>
						<Button variant="outline" size="sm">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Voltar ao orçamento
						</Button>
					</Link>
				}
			/>

			{!canEdit && (
				<ErrorFeedback
					message={
						!canWrite
							? "Você não tem permissão para editar o orçamento."
							: "Este orçamento está governado e não pode ser editado diretamente."
					}
				/>
			)}

			{items.length === 0 ? (
				<EmptyStateCard
					icon={ListTree}
					title="Nenhum item de orçamento"
					description="Importe uma planilha de orçamento antes de editar os itens."
				/>
			) : (
				<div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
					<BudgetItemEditSelector
						workId={workId}
						budgetItems={data.items}
						selectedItemId={selectedItemId}
						onSelect={(item) => setSelectedItemId(item.id)}
						disabled={!canEdit}
					/>

					<BudgetItemEditor
						item={selectedItem}
						submitting={editMutation.isPending || !canEdit}
						onSubmit={(itemId, values) => {
							if (!canEdit) return;
							editMutation.mutate({
								itemId,
								input: {
									index: values.index,
									type: values.type,
									description: values.description,
									unit: values.unit?.trim() || null,
									quantity: values.quantity?.trim()
										? Number(values.quantity)
										: null,
									unitCost: values.unitCost?.trim()
										? Number(values.unitCost)
										: null,
								},
							});
						}}
					/>
				</div>
			)}
		</PageContainer>
	);
}
