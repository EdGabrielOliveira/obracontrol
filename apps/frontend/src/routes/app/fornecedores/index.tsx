import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supplierKeys } from "@/api/query-keys";
import {
	deleteSupplier,
	listSuppliers,
	type SupplierFilter,
} from "@/api/suppliers";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { DataState } from "@/components/atoms/data-state";
import { DataTable } from "@/components/atoms/data-table";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	StatusBadge,
	SUPPLIER_STATUS_MAP,
} from "@/components/atoms/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import type { Supplier } from "@/types/suppliers";
import { getErrorMessage } from "@/utils/api-error";

const supplierFilterSchema = z.object({
	q: z.string().max(100).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

type SupplierFilterSchema = z.infer<typeof supplierFilterSchema>;

const supplierColumnHelper = createColumnHelper<Supplier>();

export const Route = createFileRoute("/app/fornecedores/")({
	validateSearch: supplierFilterSchema,
	loaderDeps: ({ search }) => ({ search }),
	component: RouteComponent,
	loader: ({ deps }) => {
		void queryClient.prefetchQuery({
			queryKey: supplierKeys.list(deps.search as Record<string, unknown>),
			queryFn: () => listSuppliers(deps.search as SupplierFilter),
		});
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Fornecedores - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate({ from: Route.id });
	const searchParams = useSearch({ from: Route.id }) as SupplierFilterSchema;
	const { role } = useAuth();
	const canWrite = role !== null;

	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: supplierKeys.list(searchParams as Record<string, unknown>),
		queryFn: () => listSuppliers(searchParams as SupplierFilter),
		staleTime: 2 * 60 * 1000,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteSupplier(id),
		onSuccess: () => {
			toast.success("Fornecedor excluído.");
			queryClient.invalidateQueries({ queryKey: supplierKeys.all });
			setDeleteId(null);
		},
		onError: (error) =>
			toast.error(getErrorMessage(error, "Erro ao excluir fornecedor.")),
	});

	const updateSearch = (patch: Partial<SupplierFilterSchema>) => {
		navigate({
			search: (prev) => ({ ...prev, ...patch }),
		});
	};

	const handleSearch = (value: string) => {
		updateSearch({ q: value || undefined, page: 1 });
	};

	if (isLoading) return <LoadingSpinner title="Carregando fornecedores..." />;
	if (error || !data) return <ErrorFeedback onRetry={() => refetch()} />;

	const supplierList = data.data;

	const supplierColumns = [
		supplierColumnHelper.accessor("name", {
			header: "Nome",
			cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			meta: { mobileLabel: "Nome" },
		}),
		supplierColumnHelper.accessor("document", {
			header: "Documento",
			cell: (info) => (
				<span className="font-mono text-xs">{info.getValue() ?? "—"}</span>
			),
			meta: { mobileLabel: "Documento" },
		}),
		supplierColumnHelper.accessor("contact", {
			header: "Contato",
			cell: (info) => info.getValue() ?? "—",
			meta: { mobileLabel: "Contato" },
		}),
		supplierColumnHelper.accessor("status", {
			header: "Status",
			cell: (info) => (
				<StatusBadge status={info.getValue()} map={SUPPLIER_STATUS_MAP} />
			),
			meta: { mobileLabel: "Status" },
		}),
		supplierColumnHelper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => (
				<div className="flex justify-end gap-1" data-no-row-click>
					{canWrite && (
						<>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Editar fornecedor ${info.row.original.name}`}
								title="Editar fornecedor"
								onClick={() =>
									navigate({
										to: "/app/fornecedores/$supplierId/edit",
										params: { supplierId: info.row.original.id },
									})
								}
							>
								<Pencil className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Excluir fornecedor ${info.row.original.name}`}
								title="Excluir fornecedor"
								onClick={() => setDeleteId(info.row.original.id)}
							>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						</>
					)}
				</div>
			),
			meta: { hideOnMobile: true },
		}),
	];

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Cadastros"
				title="Fornecedores"
				description="Fornecedores cadastrados na plataforma"
				actions={
					canWrite ? (
						<Link to="/app/fornecedores/new">
							<Button size="sm">
								<Plus className="mr-2 h-4 w-4" />
								Novo fornecedor
							</Button>
						</Link>
					) : undefined
				}
			/>

			<DataState
				empty={supplierList.length === 0 && !searchParams.q}
				emptyIcon={<Truck className="h-12 w-12" />}
				emptyTitle="Nenhum fornecedor encontrado"
				emptyDescription="Cadastre fornecedores para vincular a contratos e custos."
			>
				<DataTable
					columns={supplierColumns}
					data={supplierList}
					onRowClick={(supplier) =>
						navigate({
							to: "/app/fornecedores/$supplierId",
							params: { supplierId: supplier.id },
						})
					}
					searchPlaceholder="Buscar por nome ou documento..."
					searchValue={searchParams.q ?? ""}
					onSearchChange={handleSearch}
					emptyMessage="Nenhum fornecedor encontrado"
				/>
			</DataState>

			<ConfirmDialog
				open={!!deleteId}
				title="Excluir fornecedor?"
				description="Esta ação não pode ser desfeita."
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				onCancel={() => setDeleteId(null)}
				loading={deleteMutation.isPending}
			/>
		</PageContainer>
	);
}
